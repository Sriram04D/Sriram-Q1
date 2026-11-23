
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.employee import Employee
from models.performance import Performance
from security import require_roles
from audit import record_audit

router = APIRouter(
    prefix="/performance",
    tags=["Performance Management"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PerformanceCreate(BaseModel):
    employee_id: int
    review_date: date
    rating: int = Field(ge=1, le=5)
    feedback: str | None = None


class PerformanceUpdate(BaseModel):
    review_date: date | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    feedback: str | None = None


# ADD PERFORMANCE REVIEW
@router.post("/", status_code=201)
def create_performance(
    data: PerformanceCreate,
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

    review = Performance(**data.model_dump())

    db.add(review)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="CREATE",
        entity_type="Performance",
        entity_id=review.id
    )

    db.commit()
    db.refresh(review)

    return {
        "message": "Performance review created successfully",
        "id": review.id,
        "employee_id": review.employee_id,
        "rating": review.rating,
        "review_date": review.review_date
    }


# VIEW PERFORMANCE REVIEWS
@router.get("/")
def list_performance(
    employee_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    query = db.query(Performance)

    if employee_id is not None:
        query = query.filter(
            Performance.employee_id == employee_id
        )

    reviews = query.order_by(
        Performance.review_date.desc(),
        Performance.id.desc()
    ).all()

    return [
        {
            "id": review.id,
            "employee_id": review.employee_id,
            "employee_code": review.employee.employee_code,
            "employee_name": review.employee.full_name,
            "review_date": review.review_date,
            "rating": review.rating,
            "feedback": review.feedback
        }
        for review in reviews
    ]


# UPDATE PERFORMANCE REVIEW
@router.put("/{review_id}")
def update_performance(
    review_id: int,
    data: PerformanceUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_roles("Admin", "HR")
    )
):
    review = db.query(Performance).filter(
        Performance.id == review_id
    ).first()

    if not review:
        raise HTTPException(
            status_code=404,
            detail="Performance review not found"
        )

    updates = data.model_dump(exclude_unset=True)

    if "rating" in updates and updates["rating"] is None:
        raise HTTPException(
            status_code=422,
            detail="Rating cannot be null"
        )

    if (
        "review_date" in updates
        and updates["review_date"] is None
    ):
        raise HTTPException(
            status_code=422,
            detail="Review date cannot be null"
        )

    for field, value in updates.items():
        setattr(review, field, value)

    record_audit(
        db=db,
        user_id=current_user["id"],
        action="UPDATE",
        entity_type="Performance",
        entity_id=review.id
    )

    db.commit()
    db.refresh(review)

    return {
        "message": "Performance review updated successfully",
        "id": review.id,
        "employee_id": review.employee_id,
        "rating": review.rating,
        "review_date": review.review_date,
        "feedback": review.feedback
    }
