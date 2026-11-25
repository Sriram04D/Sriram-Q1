
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal
from models.crm import (
    Client,
    Lead,
    ClientCommunication,
    ClientProject,
    Proposal,
    ClientFeedback
)
from models.project import Project
from security import require_roles
from audit import record_audit


router = APIRouter(prefix="/crm", tags=["Client & CRM Management"])

access = require_roles("Admin", "Project Manager")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= SCHEMAS =================

class ClientCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=150)
    contact_name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=150)
    phone: str | None = Field(default=None, max_length=20)
    address: str | None = None


class LeadCreate(BaseModel):
    client_id: int
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None


class LeadUpdate(BaseModel):
    status: Literal[
        "New", "Contacted", "Qualified", "Converted", "Lost"
    ]


class CommunicationCreate(BaseModel):
    client_id: int
    communication_date: date
    communication_type: Literal["Email", "Call", "Meeting", "Other"]
    notes: str = Field(min_length=1)


class ClientProjectCreate(BaseModel):
    client_id: int
    project_id: int


class ProposalCreate(BaseModel):
    client_id: int
    title: str = Field(min_length=1, max_length=150)
    description: str | None = None
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    proposal_date: date


class ProposalUpdate(BaseModel):
    status: Literal["Draft", "Sent", "Accepted", "Rejected"]


class FeedbackCreate(BaseModel):
    client_id: int
    project_id: int
    rating: int = Field(ge=1, le=5)
    comments: str | None = None
    feedback_date: date


# ================= HELPERS =================

def get_record(db, model, record_id):
    record = db.query(model).filter(
        model.id == record_id
    ).first()

    if not record:
        raise HTTPException(404, "Record not found")

    return record


def save_record(db, record, current_user, entity, action="CREATE"):
    db.add(record)
    db.flush()

    record_audit(
        db=db,
        user_id=current_user["id"],
        action=action,
        entity_type=entity,
        entity_id=record.id
    )

    db.commit()
    db.refresh(record)

    return record


def serialize(record):
    return {
        column.name: getattr(record, column.name)
        for column in record.__table__.columns
    }


# ================= CLIENTS =================

@router.post("/clients", status_code=201)
def create_client(
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    client = Client(**data.model_dump())

    return serialize(
        save_record(db, client, current_user, "Client")
    )


@router.get("/clients")
def list_clients(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        serialize(client)
        for client in db.query(Client).all()
    ]


@router.put("/clients/{client_id}")
def update_client(
    client_id: int,
    data: ClientCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    client = get_record(db, Client, client_id)

    for key, value in data.model_dump().items():
        setattr(client, key, value)

    return serialize(
        save_record(
            db, client, current_user, "Client", "UPDATE"
        )
    )


# ================= LEADS =================

@router.post("/leads", status_code=201)
def create_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    get_record(db, Client, data.client_id)

    lead = Lead(
        **data.model_dump(),
        status="New"
    )

    return serialize(
        save_record(db, lead, current_user, "Lead")
    )


@router.get("/leads")
def list_leads(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        {
            **serialize(lead),
            "client_name": lead.client.company_name
        }
        for lead in db.query(Lead).all()
    ]


@router.put("/leads/{lead_id}/status")
def update_lead(
    lead_id: int,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    lead = get_record(db, Lead, lead_id)
    lead.status = data.status

    return serialize(
        save_record(db, lead, current_user, "Lead", "UPDATE")
    )


# ================= COMMUNICATION =================

@router.post("/communications", status_code=201)
def create_communication(
    data: CommunicationCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    get_record(db, Client, data.client_id)

    communication = ClientCommunication(**data.model_dump())

    return serialize(
        save_record(
            db, communication, current_user,
            "ClientCommunication"
        )
    )


@router.get("/communications")
def list_communications(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    query = db.query(ClientCommunication)

    if client_id is not None:
        query = query.filter(
            ClientCommunication.client_id == client_id
        )

    return [
        {
            **serialize(item),
            "client_name": item.client.company_name
        }
        for item in query.order_by(
            ClientCommunication.communication_date.desc()
        ).all()
    ]


# ================= CLIENT PROJECTS =================

@router.post("/projects", status_code=201)
def assign_client_project(
    data: ClientProjectCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    get_record(db, Client, data.client_id)
    get_record(db, Project, data.project_id)

    existing = db.query(ClientProject).filter(
        ClientProject.project_id == data.project_id
    ).first()

    if existing:
        raise HTTPException(
            400, "Project is already assigned to a client"
        )

    allocation = ClientProject(**data.model_dump())

    return serialize(
        save_record(
            db, allocation, current_user, "ClientProject"
        )
    )


@router.get("/projects")
def list_client_projects(
    client_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    query = db.query(ClientProject)

    if client_id is not None:
        query = query.filter(
            ClientProject.client_id == client_id
        )

    return [
        {
            **serialize(item),
            "client_name": item.client.company_name,
            "project_name": item.project.name,
            "project_status": item.project.status
        }
        for item in query.all()
    ]


# ================= PROPOSALS =================

@router.post("/proposals", status_code=201)
def create_proposal(
    data: ProposalCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    get_record(db, Client, data.client_id)

    proposal = Proposal(
        **data.model_dump(),
        status="Draft"
    )

    return serialize(
        save_record(db, proposal, current_user, "Proposal")
    )


@router.get("/proposals")
def list_proposals(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        {
            **serialize(item),
            "client_name": item.client.company_name
        }
        for item in db.query(Proposal).all()
    ]


@router.put("/proposals/{proposal_id}/status")
def update_proposal(
    proposal_id: int,
    data: ProposalUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    proposal = get_record(db, Proposal, proposal_id)
    proposal.status = data.status

    return serialize(
        save_record(
            db, proposal, current_user, "Proposal", "UPDATE"
        )
    )


# ================= FEEDBACK =================

@router.post("/feedback", status_code=201)
def create_feedback(
    data: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    get_record(db, Client, data.client_id)
    get_record(db, Project, data.project_id)

    allocation = db.query(ClientProject).filter(
        ClientProject.client_id == data.client_id,
        ClientProject.project_id == data.project_id
    ).first()

    if not allocation:
        raise HTTPException(
            400, "Project is not assigned to this client"
        )

    feedback = ClientFeedback(**data.model_dump())

    return serialize(
        save_record(
            db, feedback, current_user, "ClientFeedback"
        )
    )


@router.get("/feedback")
def list_feedback(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        {
            **serialize(item),
            "client_name": item.client.company_name,
            "project_name": item.project.name
        }
        for item in db.query(ClientFeedback).all()
    ]
