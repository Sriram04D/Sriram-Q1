
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.department import Department
from security import require_roles
from audit import record_audit

router = APIRouter(
    prefix="/departments",
    tags=["Departments"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(
        default=None,
        min_length=2,
        max_length=100
    )
    description: str | None = None
    is_active: bool | None = None


# CREATE DEPARTMENT
@router.post("/", status_code=201)
def create_department(
    data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("Admin"))
):
    existing = db.query(Department).filter(
        Department.name == data.name
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Department already exists"
        )

    department = Department(
        name=data.name,
        description=data.description
    )

    db.add(department)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Department",
        entity_id=department.id
    )

    db.commit()
    db.refresh(department)

    return {
        "id": department.id,
        "name": department.name,
        "description": department.description,
        "is_active": department.is_active
    }


# LIST DEPARTMENTS
@router.get("/")
def list_departments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("Admin"))
):
    departments = db.query(Department).all()

    return [
        {
            "id": department.id,
            "name": department.name,
            "description": department.description,
            "is_active": department.is_active
        }
        for department in departments
    ]


# UPDATE DEPARTMENT
@router.put("/{department_id}")
def update_department(
    department_id: int,
    data: DepartmentUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("Admin"))
):
    department = db.query(Department).filter(
        Department.id == department_id
    ).first()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found"
        )

    updates = data.model_dump(exclude_unset=True)

    if "name" in updates:
        if updates["name"] is None:
            raise HTTPException(
                status_code=422,
                detail="Name cannot be null"
            )

        duplicate = db.query(Department).filter(
            Department.name == updates["name"],
            Department.id != department_id
        ).first()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Department name already exists"
            )

    for field, value in updates.items():
        setattr(department, field, value)

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Department",
        entity_id=department.id
    )

    db.commit()
    db.refresh(department)

    return {
        "message": "Department updated successfully",
        "id": department.id,
        "name": department.name,
        "description": department.description,
        "is_active": department.is_active
    }


# DELETE (SOFT DELETE) DEPARTMENT
@router.delete("/{department_id}")
def delete_department(
    department_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("Admin"))
):
    department = db.query(Department).filter(
        Department.id == department_id
    ).first()

    if not department:
        raise HTTPException(
            status_code=404,
            detail="Department not found"
        )

    department.is_active = False

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="DELETE",
        entity_type="Department",
        entity_id=department.id
    )

    db.commit()

    return {
        "message": "Department deactivated successfully"
    }
