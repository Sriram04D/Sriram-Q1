
from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Milestone(Base):
    __tablename__ = "project_milestones"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False
    )

    title = Column(String(150), nullable=False)
    deadline = Column(Date, nullable=False)
    status = Column(String(20), nullable=False, default="Pending")

    project = relationship("Project")
