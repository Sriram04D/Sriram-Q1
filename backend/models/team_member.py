
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from database import Base


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)

    team_id = Column(
        Integer,
        ForeignKey("teams.id"),
        nullable=False
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False
    )

    joined_at = Column(
        DateTime,
        server_default=func.now()
    )

    team = relationship("Team")
    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint(
            "team_id",
            "employee_id",
            name="uq_team_employee"
        ),
    )
