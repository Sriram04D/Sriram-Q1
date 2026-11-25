
from typing import Literal
from models.milestone import Milestone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from models.project_resource import ProjectResource
from database import SessionLocal
from models.employee import Employee
from models.project import Project
from models.project_team import ProjectTeam
from models.team import Team
from security import require_roles
from audit import record_audit


router = APIRouter(
    prefix="/projects",
    tags=["Project Management"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None
    team_ids: list[int] = Field(default_factory=list)


class ProjectAllocation(BaseModel):
    team_ids: list[int] = Field(min_length=1)


class ProjectManagerAssignment(BaseModel):
    manager_id: int


class ProjectStatusUpdate(BaseModel):
    status: Literal[
        "Not Started",
        "In Progress",
        "On Hold",
        "Completed"
    ]
class ResourceAllocation(BaseModel):
    employee_ids: list[int] = Field(min_length=1)

def validate_teams(db: Session, team_ids: list[int]):
    if len(team_ids) != len(set(team_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate team IDs are not allowed"
        )

    teams = db.query(Team).filter(
        Team.id.in_(team_ids),
        Team.is_active.is_(True)
    ).all() if team_ids else []

    if len(teams) != len(team_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more active teams not found"
        )

    return teams
def calculate_project_progress(db: Session, project_id: int):
    total = db.query(Milestone).filter(
        Milestone.project_id == project_id
    ).count()

    completed = db.query(Milestone).filter(
        Milestone.project_id == project_id,
        Milestone.status == "Completed"
    ).count()

    progress = round((completed / total) * 100, 2) if total else 0

    return {
        "total_milestones": total,
        "completed_milestones": completed,
        "progress": progress
    }

def project_response(db: Session, project: Project):
    allocations = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == project.id
    ).all()

    team_ids = [item.team_id for item in allocations]

    teams = db.query(Team).filter(
        Team.id.in_(team_ids)
    ).all() if team_ids else []

    team_names = {
        team.id: team.name
        for team in teams
    }

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "team_ids": team_ids,
        "teams": [
            {
                "id": team_id,
                "name": team_names.get(team_id)
            }
            for team_id in team_ids
        ],
        "manager_id": project.manager_id,
        "manager_code": (
            project.manager.employee_code
            if project.manager else None
        ),
        "manager_name": (
            project.manager.full_name
            if project.manager else None
        ),
        "status": project.status,
        **calculate_project_progress(db, project.id)
    }


@router.post("/", status_code=201)
def create_project(
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    validate_teams(db, data.team_ids)

    project = Project(
        name=data.name,
        description=data.description
    )

    db.add(project)
    db.flush()

    for team_id in data.team_ids:
        db.add(
            ProjectTeam(
                project_id=project.id,
                team_id=team_id
            )
        )

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Project",
        entity_id=project.id
    )

    db.commit()

    return project_response(db, project)


@router.get("/")
def list_projects(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    projects = db.query(Project).order_by(
        Project.id.desc()
    ).all()

    return [
        project_response(db, project)
        for project in projects
    ]


@router.put("/{project_id}/allocate")
def allocate_project(
    project_id: int,
    data: ProjectAllocation,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    validate_teams(db, data.team_ids)

    db.query(ProjectTeam).filter(
        ProjectTeam.project_id == project_id
    ).delete(synchronize_session=False)

    for team_id in data.team_ids:
        db.add(
            ProjectTeam(
                project_id=project_id,
                team_id=team_id
            )
        )

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Project",
        entity_id=project_id
    )

    db.commit()

    return {
        "message": "Project teams updated successfully",
        **project_response(db, project)
    }


@router.put("/{project_id}/manager")
def assign_project_manager(
    project_id: int,
    data: ProjectManagerAssignment,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    employee = db.query(Employee).filter(
        Employee.id == data.manager_id,
        Employee.is_active.is_(True)
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Active employee not found"
        )

    project.manager_id = employee.id

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Project",
        entity_id=project.id
    )

    db.commit()
    db.refresh(project)

    return {
        "message": "Project manager assigned successfully",
        "project_id": project.id,
        "manager_id": employee.id,
        "manager_code": employee.employee_code,
        "manager_name": employee.full_name
    }


@router.put("/{project_id}/status")
def update_project_status(
    project_id: int,
    data: ProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    project.status = data.status

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Project",
        entity_id=project.id
    )

    db.commit()
    db.refresh(project)

    return {
        "message": "Project status updated successfully",
        "project_id": project.id,
        "status": project.status
    }


@router.post("/{project_id}/resources", status_code=201)
def allocate_resources(
    project_id: int,
    data: ResourceAllocation,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    if len(data.employee_ids) != len(set(data.employee_ids)):
        raise HTTPException(
            status_code=400,
            detail="Duplicate employee IDs are not allowed"
        )

    employees = db.query(Employee).filter(
        Employee.id.in_(data.employee_ids),
        Employee.is_active.is_(True)
    ).all()

    if len(employees) != len(data.employee_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more active employees not found"
        )

    existing = db.query(ProjectResource).filter(
        ProjectResource.project_id == project_id,
        ProjectResource.employee_id.in_(data.employee_ids)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="One or more employees already allocated"
        )

    for employee_id in data.employee_ids:
        db.add(
            ProjectResource(
                project_id=project_id,
                employee_id=employee_id
            )
        )

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Project",
        entity_id=project_id
    )

    db.commit()

    return {
        "message": "Resources allocated successfully",
        "project_id": project_id,
        "employee_ids": data.employee_ids
    }

@router.get("/{project_id}/resources")
def list_project_resources(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    project = db.query(Project).filter(
        Project.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    resources = db.query(ProjectResource).filter(
        ProjectResource.project_id == project_id
    ).all()

    return [
        {
            "id": resource.id,
            "project_id": resource.project_id,
            "employee_id": resource.employee_id,
            "employee_code": resource.employee.employee_code,
            "employee_name": resource.employee.full_name,
            "designation": resource.employee.designation
        }
        for resource in resources
    ]

@router.delete("/{project_id}/resources/{employee_id}")
def remove_project_resource(
    project_id: int,
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    resource = db.query(ProjectResource).filter(
        ProjectResource.project_id == project_id,
        ProjectResource.employee_id == employee_id
    ).first()

    if not resource:
        raise HTTPException(
            status_code=404,
            detail="Resource allocation not found"
        )

    db.delete(resource)

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Project",
        entity_id=project_id
    )

    db.commit()

    return {
        "message": "Resource removed successfully"
    }
