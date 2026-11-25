
from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)

    team_id = Column(
        Integer,
        ForeignKey("teams.id"),
        nullable=True
    )

    manager_id = Column(
        Integer,
        ForeignKey("employees.id"),
        nullable=True
    )

    status = Column(
        String(20),
        nullable=False,
        default="Not Started"
    )

    team = relationship("Team")
    manager = relationship("Employee")
