
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)

    department_id = Column(
        Integer,
        ForeignKey("departments.id"),
        nullable=False
    )

    team_lead_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=True
    )

    is_active = Column(Boolean, default=True, nullable=False)

    department = relationship("Department")
    team_lead = relationship("Employee")
