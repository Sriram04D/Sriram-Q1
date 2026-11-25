
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.project import Project
from models.milestone import Milestone
from security import require_roles
from audit import record_audit


router = APIRouter(
    prefix="/milestones",
    tags=["Project Milestones"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class MilestoneCreate(BaseModel):
    project_id: int
    title: str = Field(min_length=1, max_length=150)
    deadline: date


class MilestoneStatusUpdate(BaseModel):
    status: str


def milestone_response(milestone):
    return {
        "id": milestone.id,
        "project_id": milestone.project_id,
        "project_name": milestone.project.name,
        "title": milestone.title,
        "deadline": milestone.deadline,
        "status": milestone.status
    }


@router.post("/", status_code=201)
def create_milestone(
    data: MilestoneCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    project = db.query(Project).filter(
        Project.id == data.project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    milestone = Milestone(
        project_id=data.project_id,
        title=data.title,
        deadline=data.deadline,
        status="Pending"
    )

    db.add(milestone)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Milestone",
        entity_id=milestone.id
    )

    db.commit()
    db.refresh(milestone)

    return milestone_response(milestone)


@router.get("/")
def list_milestones(
    project_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    query = db.query(Milestone)

    if project_id is not None:
        query = query.filter(
            Milestone.project_id == project_id
        )

    milestones = query.order_by(
        Milestone.deadline.asc(),
        Milestone.id.asc()
    ).all()

    return [
        milestone_response(milestone)
        for milestone in milestones
    ]


@router.put("/{milestone_id}/status")
def update_milestone_status(
    milestone_id: int,
    data: MilestoneStatusUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "Project Manager")
    )
):
    if data.status not in ("Pending", "Completed"):
        raise HTTPException(
            status_code=400,
            detail="Status must be Pending or Completed"
        )

    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id
    ).first()

    if not milestone:
        raise HTTPException(
            status_code=404,
            detail="Milestone not found"
        )

    milestone.status = data.status

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Milestone",
        entity_id=milestone.id
    )

    db.commit()
    db.refresh(milestone)

    return milestone_response(milestone)
