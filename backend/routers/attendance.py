
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import SessionLocal
from models.employee import Employee
from models.attendance import Attendance
from security import require_roles
from audit import record_audit

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

INDIA_TZ = ZoneInfo("Asia/Kolkata")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_time():
    return datetime.now(INDIA_TZ).replace(tzinfo=None)


class AttendanceRequest(BaseModel):
    employee_id: int


# CHECK IN
@router.post("/check-in", status_code=201)
def check_in(
    data: AttendanceRequest,
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

    now = current_time()

    existing = db.query(Attendance).filter(
        Attendance.employee_id == data.employee_id,
        Attendance.attendance_date == now.date()
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Employee already checked in today"
        )

    attendance = Attendance(
        employee_id=data.employee_id,
        attendance_date=now.date(),
        check_in=now
    )

    db.add(attendance)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CHECK_IN",
        entity_type="Attendance",
        entity_id=attendance.id
    )

    db.commit()
    db.refresh(attendance)

    return {
        "message": "Check-in successful",
        "attendance_id": attendance.id,
        "employee_id": attendance.employee_id,
        "check_in": attendance.check_in
    }


# CHECK OUT
@router.post("/check-out")
def check_out(
    data: AttendanceRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    attendance = db.query(Attendance).filter(
        Attendance.employee_id == data.employee_id,
        Attendance.check_out.is_(None)
    ).order_by(
        Attendance.check_in.desc()
    ).first()

    if not attendance:
        raise HTTPException(
            status_code=404,
            detail="No active check-in found"
        )

    now = current_time()

    duration = now - attendance.check_in

    if duration.total_seconds() < 0:
        raise HTTPException(
            status_code=400,
            detail="Invalid check-out time"
        )

    attendance.check_out = now
    attendance.working_hours = round(
        duration.total_seconds() / 3600,
        2
    )

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CHECK_OUT",
        entity_type="Attendance",
        entity_id=attendance.id
    )

    db.commit()
    db.refresh(attendance)

    return {
        "message": "Check-out successful",
        "employee_id": attendance.employee_id,
        "check_in": attendance.check_in,
        "check_out": attendance.check_out,
        "working_hours": attendance.working_hours
    }


# VIEW ATTENDANCE
@router.get("/")
def list_attendance(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    query = db.query(Attendance)

    if employee_id is not None:
        query = query.filter(
            Attendance.employee_id == employee_id
        )

    records = query.order_by(
        Attendance.attendance_date.desc()
    ).all()

    return [
        {
            "id": record.id,
            "employee_id": record.employee_id,
            "employee_name": record.employee.full_name,
            "attendance_date": record.attendance_date,
            "check_in": record.check_in,
            "check_out": record.check_out,
            "working_hours": record.working_hours
        }
        for record in records
    ]
