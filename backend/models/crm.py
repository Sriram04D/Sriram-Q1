
from sqlalchemy import (
    Column, Integer, String, Text,
    Date, ForeignKey, Numeric
)
from sqlalchemy.orm import relationship
from database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String(150), nullable=False)
    contact_name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="New", nullable=False)

    client = relationship("Client")


class ClientCommunication(Base):
    __tablename__ = "client_communications"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    communication_date = Column(Date, nullable=False)
    communication_type = Column(String(30), nullable=False)
    notes = Column(Text, nullable=False)

    client = relationship("Client")


class ClientProject(Base):
    __tablename__ = "client_projects"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        unique=True,
        nullable=False
    )

    client = relationship("Client")
    project = relationship("Project")


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    proposal_date = Column(Date, nullable=False)
    status = Column(String(30), default="Draft", nullable=False)

    client = relationship("Client")


class ClientFeedback(Base):
    __tablename__ = "client_feedback"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    rating = Column(Integer, nullable=False)
    comments = Column(Text, nullable=True)
    feedback_date = Column(Date, nullable=False)

    client = relationship("Client")
    project = relationship("Project")
