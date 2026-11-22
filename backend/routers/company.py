
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.company import Company
from security import require_roles
from audit import record_audit

router = APIRouter(prefix="/company", tags=["Company"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CompanyUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    website: str | None = None


@router.get("/")
def get_company(
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles(
            "Admin", "HR", "Project Manager",
            "Employee", "Finance"
        )
    )
):
    company = db.query(Company).first()

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company profile not configured"
        )

    return {
        "id": company.id,
        "name": company.name,
        "email": company.email,
        "phone": company.phone,
        "address": company.address,
        "website": company.website
    }


@router.put("/")
def update_company(
    data: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("Admin"))
):
    company = db.query(Company).first()

    if not company:
        company = Company(**data.model_dump())
        db.add(company)
    else:
        for field, value in data.model_dump().items():
            setattr(company, field, value)

    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Company",
        entity_id=company.id
    )

    db.commit()
    db.refresh(company)

    return {
        "message": "Company profile saved successfully",
        "id": company.id,
        "name": company.name,
        "email": company.email,
        "phone": company.phone,
        "address": company.address,
        "website": company.website
    }
