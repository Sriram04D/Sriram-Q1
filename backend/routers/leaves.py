
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.employee import Employee
from models.leave import LeaveRequest
from security import require_roles
from audit import record_audit

router = APIRouter(
    prefix="/leaves",
    tags=["Leave Management"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class LeaveCreate(BaseModel):
    employee_id: int
    leave_type: str = Field(min_length=2, max_length=50)
    start_date: date
    end_date: date
    reason: str | None = None


class LeaveDecision(BaseModel):
    status: str


# APPLY FOR LEAVE
@router.post("/", status_code=201)
def apply_leave(
    data: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    employee = db.query(Employee).filter(
        Employee.id == data.employee_id,
        Employee.is_active.is_(True)
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Active employee not found"
        )

    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=400,
            detail="End date cannot be before start date"
        )

    overlapping = db.query(LeaveRequest).filter(
        LeaveRequest.employee_id == data.employee_id,
        LeaveRequest.status.in_(["Pending", "Approved"]),
        LeaveRequest.start_date <= data.end_date,
        LeaveRequest.end_date >= data.start_date
    ).first()

    if overlapping:
        raise HTTPException(
            status_code=400,
            detail="Employee already has a pending or approved leave for these dates"
        )

    leave = LeaveRequest(**data.model_dump())

    db.add(leave)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="APPLY",
        entity_type="LeaveRequest",
        entity_id=leave.id
    )

    db.commit()
    db.refresh(leave)

    return {
        "message": "Leave request submitted successfully",
        "id": leave.id,
        "employee_id": leave.employee_id,
        "status": leave.status
    }


# VIEW LEAVE REQUESTS
@router.get("/")
def list_leaves(
    employee_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    query = db.query(LeaveRequest)

    if employee_id is not None:
        query = query.filter(
            LeaveRequest.employee_id == employee_id
        )

    if status:
        query = query.filter(
            LeaveRequest.status == status
        )

    leaves = query.order_by(
        LeaveRequest.created_at.desc(),
        LeaveRequest.id.desc()
    ).all()

    return [
        {
            "id": leave.id,
            "employee_id": leave.employee_id,
            "employee_name": leave.employee.full_name,
            "employee_code": leave.employee.employee_code,
            "leave_type": leave.leave_type,
            "start_date": leave.start_date,
            "end_date": leave.end_date,
            "reason": leave.reason,
            "status": leave.status,
            "created_at": leave.created_at
        }
        for leave in leaves
    ]


# APPROVE OR REJECT LEAVE
@router.put("/{leave_id}/decision")
def decide_leave(
    leave_id: int,
    data: LeaveDecision,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    if data.status not in ["Approved", "Rejected"]:
        raise HTTPException(
            status_code=400,
            detail="Status must be Approved or Rejected"
        )

    leave = db.query(LeaveRequest).filter(
        LeaveRequest.id == leave_id
    ).first()

    if not leave:
        raise HTTPException(
            status_code=404,
            detail="Leave request not found"
        )

    if leave.status != "Pending":
        raise HTTPException(
            status_code=400,
            detail="Only pending leave requests can be approved or rejected"
        )

    leave.status = data.status

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="APPROVE" if data.status == "Approved" else "REJECT",
        entity_type="LeaveRequest",
        entity_id=leave.id
    )

    db.commit()
    db.refresh(leave)

    return {
        "message": f"Leave request {leave.status.lower()} successfully",
        "leave_id": leave.id,
        "status": leave.status
    }
