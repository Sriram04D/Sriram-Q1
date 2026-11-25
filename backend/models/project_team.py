
from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from database import Base


class ProjectTeam(Base):
    __tablename__ = "project_teams"

    id = Column(Integer, primary_key=True, index=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        nullable=False
    )

    team_id = Column(
        Integer,
        ForeignKey("teams.id"),
        nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "project_id",
            "team_id",
            name="uq_project_team"
        ),
    )
