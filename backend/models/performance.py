
from sqlalchemy import (
    Column, Integer, String, Date,
    DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base


class Performance(Base):
    __tablename__ = "performance_reviews"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False
    )

    review_date = Column(Date, nullable=False)

    rating = Column(Integer, nullable=False)

    feedback = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    employee = relationship("Employee")
