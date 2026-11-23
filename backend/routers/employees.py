
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import SessionLocal
from models.employee import Employee
from models.department import Department
from security import require_roles
from audit import record_audit

router = APIRouter(
    prefix="/employees",
    tags=["Employees"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class EmployeeCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    phone: str | None = None
    designation: str | None = None
    joining_date: date | None = None
    department_id: int


class EmployeeUpdate(BaseModel):
    full_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150
    )
    phone: str | None = None
    designation: str | None = None
    joining_date: date | None = None
    department_id: int | None = None


def generate_employee_code(db: Session):
    """
    Generate the next employee code based on existing EMP codes.
    Existing records are preserved.
    """

    codes = db.query(Employee.employee_code).filter(
        Employee.employee_code.like("EMP%")
    ).all()

    highest_number = 0

    for (code,) in codes:
        suffix = code[3:]

        if suffix.isdigit():
            highest_number = max(
                highest_number,
                int(suffix)
            )

    return f"EMP{highest_number + 1:03d}"


# CREATE EMPLOYEE
@router.post("/", status_code=201)
def create_employee(
    data: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
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

    employee_code = generate_employee_code(db)

    employee = Employee(
        employee_code=employee_code,
        **data.model_dump()
    )

    db.add(employee)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Employee",
        entity_id=employee.id
    )

    db.commit()
    db.refresh(employee)

    return {
        "id": employee.id,
        "employee_code": employee.employee_code,
        "full_name": employee.full_name,
        "department_id": employee.department_id,
        "message": "Employee created successfully"
    }


# LIST EMPLOYEES
@router.get("/")
def list_employees(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    employees = db.query(Employee).all()

    return [
        {
            "id": employee.id,
            "employee_code": employee.employee_code,
            "full_name": employee.full_name,
            "phone": employee.phone,
            "designation": employee.designation,
            "joining_date": employee.joining_date,
            "department_id": employee.department_id,
            "user_id": employee.user_id,
            "is_active": employee.is_active
        }
        for employee in employees
    ]


# SEARCH EMPLOYEES
@router.get("/search")
def search_employees(
    name: str | None = None,
    employee_code: str | None = None,
    department_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    query = db.query(Employee)

    if name:
        query = query.filter(
            Employee.full_name.ilike(f"%{name}%")
        )

    if employee_code:
        query = query.filter(
            Employee.employee_code.ilike(
                f"%{employee_code}%"
            )
        )

    if department_id is not None:
        query = query.filter(
            Employee.department_id == department_id
        )

    employees = query.all()

    return [
        {
            "id": employee.id,
            "employee_code": employee.employee_code,
            "full_name": employee.full_name,
            "designation": employee.designation,
            "department_id": employee.department_id,
            "is_active": employee.is_active
        }
        for employee in employees
    ]


# UPDATE EMPLOYEE
@router.put("/{employee_id}")
def update_employee(
    employee_id: int,
    data: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    updates = data.model_dump(exclude_unset=True)

    if (
        "full_name" in updates
        and updates["full_name"] is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Employee name cannot be null"
        )

    if "department_id" in updates:
        department_id = updates["department_id"]

        if department_id is None:
            raise HTTPException(
                status_code=422,
                detail="Department ID cannot be null"
            )

        department = db.query(Department).filter(
            Department.id == department_id,
            Department.is_active.is_(True)
        ).first()

        if not department:
            raise HTTPException(
                status_code=400,
                detail="Department not found or inactive"
            )

    for field, value in updates.items():
        setattr(employee, field, value)

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Employee",
        entity_id=employee.id
    )

    db.commit()
    db.refresh(employee)

    return {
        "message": "Employee updated successfully",
        "id": employee.id,
        "employee_code": employee.employee_code,
        "full_name": employee.full_name,
        "phone": employee.phone,
        "designation": employee.designation,
        "joining_date": employee.joining_date,
        "department_id": employee.department_id,
        "is_active": employee.is_active
    }


# DEACTIVATE EMPLOYEE
@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    employee = db.query(Employee).filter(
        Employee.id == employee_id
    ).first()

    if not employee:
        raise HTTPException(
            status_code=404,
            detail="Employee not found"
        )

    if not employee.is_active:
        raise HTTPException(
            status_code=400,
            detail="Employee is already inactive"
        )

    employee.is_active = False

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="DELETE",
        entity_type="Employee",
        entity_id=employee.id
    )

    db.commit()

    return {
        "message": "Employee deactivated successfully",
        "employee_id": employee.id
    }
