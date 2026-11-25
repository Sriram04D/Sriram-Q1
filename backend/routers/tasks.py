
from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from models.role import Role
from database import SessionLocal
from models.task import Task
from models.work_log import WorkLog
from models.project import Project
from models.employee import Employee
from security import require_roles
from audit import record_audit


router = APIRouter(
    prefix="/tasks",
    tags=["Task Management"]
)

access = require_roles("Admin", "Project Manager")
employee_access = require_roles(
    "Admin", "Project Manager", "Employee"
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class TaskCreate(BaseModel):
    project_id: int
    employee_id: int
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    priority: Literal["Low", "Medium", "High"] = "Medium"
    deadline: date


class TaskUpdate(BaseModel):
    status: Literal["Pending", "In Progress", "Completed"]
    priority: Literal["Low", "Medium", "High"]


class ApprovalUpdate(BaseModel):
    approval_status: Literal["Approved", "Rejected"]


class WorkLogCreate(BaseModel):
    work_date: date
    hours: float = Field(gt=0, le=24)
    description: str | None = Field(default=None, max_length=255)


def get_task(db, task_id):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    return task
def validate_task_access(db, task, current_user):
    role = db.query(Role).filter(
        Role.id == current_user["role_id"]
    ).first()

    if role and role.name in ["Admin", "Project Manager"]:
        return

    employee = db.query(Employee).filter(
        Employee.user_id == current_user["id"],
        Employee.is_active.is_(True)
    ).first()

    if not employee or task.employee_id != employee.id:
        raise HTTPException(
            403, "You can only access your assigned tasks"
        )

def task_response(db, task):
    logs = db.query(WorkLog).filter(
        WorkLog.task_id == task.id
    ).all()

    reminder = None

    if task.status != "Completed":
        if task.deadline < date.today():
            reminder = "Overdue"
        elif task.deadline == date.today():
            reminder = "Due Today"
        elif task.deadline <= date.today() + timedelta(days=3):
            reminder = "Due Soon"

    return {
        "id": task.id,
        "project_id": task.project_id,
        "project_name": task.project.name,
        "employee_id": task.employee_id,
        "employee_name": task.employee.full_name,
        "title": task.title,
        "description": task.description,
        "priority": task.priority,
        "status": task.status,
        "deadline": task.deadline,
        "approval_status": task.approval_status,
        "reminder": reminder,
        "total_hours": round(sum(log.hours for log in logs), 2)
    }


# 1. Task creation and assignment

@router.post("/", status_code=201)
def create_task(
    data: TaskCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    project = db.query(Project).filter(
        Project.id == data.project_id
    ).first()

    if not project:
        raise HTTPException(404, "Project not found")

    employee = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.is_active.is_(True)
    ).first()

    if not employee:
        raise HTTPException(404, "Active employee not found")

    task = Task(
        **data.model_dump(),
        status="Pending",
        approval_status="Pending"
    )

    db.add(task)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Task",
        entity_id=task.id
    )

    db.commit()
    db.refresh(task)

    return task_response(db, task)


# 2. Task listing, deadlines and Kanban data

@router.get("/")
def list_tasks(
    project_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(employee_access)
):
    query = db.query(Task)

    role = db.query(Role).filter(
        Role.id == current_user["role_id"]
    ).first()

    if role.name == "Employee":
        employee = db.query(Employee).filter(
            Employee.user_id == current_user["id"],
            Employee.is_active.is_(True)
        ).first()

        if not employee:
            return []

        query = query.filter(
            Task.employee_id == employee.id
        )

    if project_id is not None:
        query = query.filter(Task.project_id == project_id)

    tasks = query.order_by(Task.deadline.asc()).all()

    return [task_response(db, task) for task in tasks]


# 3. Priority and status management

@router.put("/{task_id}")
def update_task(
    task_id: int,
    data: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(employee_access)
):
    task = get_task(db, task_id)
    validate_task_access(db, task, current_user)

    if task.status != data.status:
        task.approval_status = "Pending"

    task.status = data.status
    task.priority = data.priority

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Task",
        entity_id=task.id
    )

    db.commit()

    return task_response(db, task)


# 4. Work logs and time tracking

@router.post("/{task_id}/work-logs", status_code=201)
def create_work_log(
    task_id: int,
    data: WorkLogCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(employee_access)
):
    task = get_task(db, task_id)
    validate_task_access(db, task, current_user)

    if data.work_date > date.today():
        raise HTTPException(400, "Work date cannot be in the future")

    log = WorkLog(
        task_id=task.id,
        employee_id=task.employee_id,
        **data.model_dump()
    )

    db.add(log)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="WorkLog",
        entity_id=log.id
    )

    db.commit()
    db.refresh(log)

    return {
        "message": "Work log created successfully",
        "id": log.id,
        "hours": log.hours
    }


@router.get("/{task_id}/work-logs")
def list_work_logs(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(employee_access)
):
    
    task = get_task(db, task_id)
    validate_task_access(db, task, current_user)

    logs = db.query(WorkLog).filter(
        WorkLog.task_id == task_id
    ).order_by(WorkLog.work_date.desc()).all()

    return [
        {
            "id": log.id,
            "employee_name": log.employee.full_name,
            "work_date": log.work_date,
            "hours": log.hours,
            "description": log.description
        }
        for log in logs
    ]


# 5. Task approval workflow

@router.put("/{task_id}/approval")
def approve_task(
    task_id: int,
    data: ApprovalUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    task = get_task(db, task_id)

    if task.status != "Completed":
        raise HTTPException(
            400,
            "Only completed tasks can be reviewed"
        )

    task.approval_status = data.approval_status

    if data.approval_status == "Rejected":
        task.status = "In Progress"

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Task",
        entity_id=task.id
    )

    db.commit()

    return task_response(db, task)
