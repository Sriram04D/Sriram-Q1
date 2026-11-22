
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.team import Team
from models.department import Department
from models.employee import Employee
from models.team_member import TeamMember
from security import require_roles
from audit import record_audit

router = APIRouter(prefix="/teams", tags=["Teams"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None
    department_id: int
    team_lead_id: int | None = None


class TeamMemberCreate(BaseModel):
    employee_id: int


class TeamUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )
    description: str | None = None
    team_lead_id: int | None = None
    is_active: bool | None = None


# CREATE TEAM
@router.post("/", status_code=201)
def create_team(
    data: TeamCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    department = db.query(Department).filter(
        Department.id == data.department_id,
        Department.is_active.is_(True)
    ).first()

    if not department:
        raise HTTPException(
            status_code=400,
            detail="Department not found or inactive"
        )

    if data.team_lead_id is not None:
        lead = db.query(Employee).filter(
            Employee.id == data.team_lead_id,
            Employee.is_active.is_(True),
            Employee.department_id == data.department_id
        ).first()

        if not lead:
            raise HTTPException(
                status_code=400,
                detail="Team leader must be an active employee in this department"
            )

    existing = db.query(Team).filter(
        Team.name == data.name,
        Team.department_id == data.department_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Team already exists in this department"
        )

    team = Team(**data.model_dump())

    db.add(team)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Team",
        entity_id=team.id
    )

    db.commit()
    db.refresh(team)

    return {
        "message": "Team created successfully",
        "id": team.id,
        "name": team.name,
        "department_id": team.department_id,
        "team_lead_id": team.team_lead_id,
        "is_active": team.is_active
    }


# LIST TEAMS
@router.get("/")
def list_teams(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    teams = db.query(Team).all()

    return [
        {
            "id": team.id,
            "name": team.name,
            "description": team.description,
            "department_id": team.department_id,
            "department_name": team.department.name,
            "team_lead_id": team.team_lead_id,
            "team_lead_name": (
                team.team_lead.full_name
                if team.team_lead else None
            ),
            "is_active": team.is_active
        }
        for team in teams
    ]


# ADD TEAM MEMBER
@router.post("/{team_id}/members", status_code=201)
def add_team_member(
    team_id: int,
    data: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    team = db.query(Team).filter(
        Team.id == team_id,
        Team.is_active.is_(True)
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Active team not found"
        )

    employee = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.is_active.is_(True)
    ).first()

    if not employee:
        raise HTTPException(
            status_code=400,
            detail="Employee not found or inactive"
        )

    if employee.department_id != team.department_id:
        raise HTTPException(
            status_code=400,
            detail="Employee must belong to the team's department"
        )

    existing = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.employee_id == data.employee_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Employee is already assigned to this team"
        )

    member = TeamMember(
        team_id=team_id,
        employee_id=data.employee_id
    )

    db.add(member)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="ADD_MEMBER",
        entity_type="Team",
        entity_id=team_id
    )

    db.commit()
    db.refresh(member)

    return {
        "message": "Employee assigned to team successfully",
        "team_id": team_id,
        "employee_id": member.employee_id
    }


# LIST TEAM MEMBERS
@router.get("/{team_id}/members")
def list_team_members(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    members = db.query(TeamMember).filter(
        TeamMember.team_id == team_id
    ).all()

    return {
        "team_id": team.id,
        "team_name": team.name,
        "total_members": len(members),
        "members": [
            {
                "employee_id": member.employee.id,
                "employee_code": member.employee.employee_code,
                "full_name": member.employee.full_name,
                "designation": member.employee.designation,
                "is_active": member.employee.is_active,
                "joined_at": member.joined_at
            }
            for member in members
        ]
    }


# REMOVE TEAM MEMBER
@router.delete("/{team_id}/members/{employee_id}")
def remove_team_member(
    team_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    member = db.query(TeamMember).filter(
        TeamMember.team_id == team_id,
        TeamMember.employee_id == employee_id
    ).first()

    if not member:
        raise HTTPException(
            status_code=404,
            detail="Employee is not assigned to this team"
        )

    db.delete(member)

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="REMOVE_MEMBER",
        entity_type="Team",
        entity_id=team_id
    )

    db.commit()

    return {
        "message": "Employee removed from team successfully",
        "team_id": team_id,
        "employee_id": employee_id
    }


# UPDATE TEAM
@router.put("/{team_id}")
def update_team(
    team_id: int,
    data: TeamUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    updates = data.model_dump(exclude_unset=True)

    if "name" in updates:
        if updates["name"] is None:
            raise HTTPException(
                status_code=422,
                detail="Team name cannot be null"
            )

        duplicate = db.query(Team).filter(
            Team.name == updates["name"],
            Team.department_id == team.department_id,
            Team.id != team_id
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Team name already exists in this department"
            )

    if (
        "team_lead_id" in updates
        and updates["team_lead_id"] is not None
    ):
        lead = db.query(Employee).filter(
            Employee.id == updates["team_lead_id"],
            Employee.is_active.is_(True),
            Employee.department_id == team.department_id
        ).first()

        if not lead:
            raise HTTPException(
                status_code=400,
                detail="Team leader must be an active employee in this department"
            )

    if updates.get("is_active") is True:
        department = db.query(Department).filter(
            Department.id == team.department_id,
            Department.is_active.is_(True)
        ).first()

        if not department:
            raise HTTPException(
                status_code=400,
                detail="Cannot activate a team in an inactive department"
            )

    for field, value in updates.items():
        setattr(team, field, value)

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Team",
        entity_id=team.id
    )

    db.commit()
    db.refresh(team)

    return {
        "message": "Team updated successfully",
        "id": team.id,
        "name": team.name,
        "description": team.description,
        "department_id": team.department_id,
        "team_lead_id": team.team_lead_id,
        "is_active": team.is_active
    }


# DEACTIVATE TEAM (SOFT DELETE)
@router.delete("/{team_id}")
def deactivate_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    team = db.query(Team).filter(
        Team.id == team_id
    ).first()

    if not team:
        raise HTTPException(
            status_code=404,
            detail="Team not found"
        )

    if not team.is_active:
        raise HTTPException(
            status_code=400,
            detail="Team is already inactive"
        )

    team.is_active = False

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="DELETE",
        entity_type="Team",
        entity_id=team.id
    )

    db.commit()

    return {
        "message": "Team deactivated successfully",
        "team_id": team.id
    }
