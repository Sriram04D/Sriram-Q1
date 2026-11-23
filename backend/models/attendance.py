
from sqlalchemy import (
    Column, Integer, ForeignKey,
    Date, DateTime, Float, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False
    )

    attendance_date = Column(Date, nullable=False)

    check_in = Column(DateTime, nullable=False)
    check_out = Column(DateTime, nullable=True)

    working_hours = Column(Float, nullable=True)

    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint(
            "employee_id",
            "attendance_date",
            name="uq_employee_attendance_date"
        ),
    )
