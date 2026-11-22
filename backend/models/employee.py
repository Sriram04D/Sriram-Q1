
from sqlalchemy import Column, Integer, String, ForeignKey, Date, DateTime, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)

    employee_code = Column(
        String(20),
        unique=True,
        nullable=False
    )

    full_name = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)
    designation = Column(String(100), nullable=True)

    joining_date = Column(Date, nullable=True)

    department_id = Column(
        Integer,
        ForeignKey("departments.id"),
        nullable=False
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        unique=True,
        nullable=True
    )

    created_at = Column(
        DateTime,
        server_default=func.now()
    )
    is_active = Column(Boolean, default=True, nullable=False)

    user = relationship(
        "User",
        back_populates="employee"
    )
   
    department = relationship("Department")
    