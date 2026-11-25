from sqlalchemy import Column, Integer, String, Date, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class WorkLog(Base):
    __tablename__ = "work_logs"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)

    work_date = Column(Date, nullable=False)
    hours = Column(Float, nullable=False)
    description = Column(String(255), nullable=True)

    task = relationship("Task")
    employee = relationship("Employee")