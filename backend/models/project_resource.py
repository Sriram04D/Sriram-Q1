
from sqlalchemy import (
    Column,
    Integer,
    ForeignKey,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class ProjectResource(Base):
    __tablename__ = "project_resources"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False
    )

    employee_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "employee_id",
            name="uq_project_resource"
        ),
    )

    project = relationship("Project")
    employee = relationship("Employee")
