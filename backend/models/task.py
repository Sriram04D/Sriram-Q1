from sqlalchemy import Column, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="Medium", nullable=False)
    status = Column(String(20), default="Pending", nullable=False)
    deadline = Column(Date, nullable=False)
    approval_status = Column(String(20), default="Pending", nullable=False)

    project = relationship("Project")
    employee = relationship("Employee")