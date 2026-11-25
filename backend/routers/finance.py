
from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import SessionLocal
from models.finance import (
    FinanceTransaction,
    ProjectBudget,
    Invoice,
    Payment,
    SalaryRecord
)
from models.project import Project
from models.employee import Employee
from models.crm import Client, ClientProject
from security import require_roles
from audit import record_audit


router = APIRouter(
    prefix="/finance",
    tags=["Finance & Accounts"]
)

access = require_roles("Admin", "Finance")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ================= SCHEMAS =================

class TransactionCreate(BaseModel):
    project_id: int | None = None
    transaction_type: Literal["Income", "Expense"]
    category: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(
        gt=0, max_digits=12, decimal_places=2
    )
    transaction_date: date
    description: str | None = None


class BudgetCreate(BaseModel):
    project_id: int
    allocated_amount: Decimal = Field(
        gt=0, max_digits=12, decimal_places=2
    )
    description: str | None = None


class InvoiceCreate(BaseModel):
    client_id: int
    project_id: int
    amount: Decimal = Field(
        gt=0, max_digits=12, decimal_places=2
    )
    invoice_date: date
    due_date: date
    description: str | None = None


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: Decimal = Field(
        gt=0, max_digits=12, decimal_places=2
    )
    payment_date: date
    payment_method: Literal[
        "Cash", "Bank Transfer", "UPI", "Cheque"
    ]
    reference: str | None = Field(
        default=None, max_length=150
    )


class SalaryCreate(BaseModel):
    employee_id: int
    month: int = Field(ge=1, le=12)
    year: int = Field(ge=2000, le=2100)
    basic_salary: Decimal = Field(
        gt=0, max_digits=12, decimal_places=2
    )
    allowances: Decimal = Field(
        default=0, ge=0, max_digits=12, decimal_places=2
    )
    deductions: Decimal = Field(
        default=0, ge=0, max_digits=12, decimal_places=2
    )


class SalaryPayment(BaseModel):
    payment_date: date


# ================= HELPERS =================

def get_record(db, model, record_id):
    record = db.query(model).filter(
        model.id == record_id
    ).first()

    if not record:
        raise HTTPException(404, "Record not found")

    return record


def serialize(record):
    return {
        column.name: getattr(record, column.name)
        for column in record.__table__.columns
    }


def audit_record(db, current_user, entity, record_id, action):
    record_audit(
        db=db,
        user_id=current_user["id"],
        action=action,
        entity_type=entity,
        entity_id=record_id
    )


def save_record(
    db, record, current_user, entity, action="CREATE"
):
    db.add(record)
    db.flush()

    audit_record(
        db, current_user, entity, record.id, action
    )

    db.commit()
    db.refresh(record)

    return record


def total_transactions(db, transaction_type, project_id=None):
    query = db.query(
        func.coalesce(func.sum(FinanceTransaction.amount), 0)
    ).filter(
        FinanceTransaction.transaction_type == transaction_type
    )

    if project_id is not None:
        query = query.filter(
            FinanceTransaction.project_id == project_id
        )

    return Decimal(str(query.scalar()))


def total_paid(db, invoice_id):
    result = db.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).filter(
        Payment.invoice_id == invoice_id
    ).scalar()

    return Decimal(str(result))


def invoice_response(db, invoice):
    paid = total_paid(db, invoice.id)

    return {
        **serialize(invoice),
        "client_name": invoice.client.company_name,
        "project_name": invoice.project.name,
        "paid_amount": paid,
        "balance_amount": invoice.amount - paid
    }


def budget_response(db, budget):
    expenses = total_transactions(
        db, "Expense", budget.project_id
    )

    return {
        **serialize(budget),
        "project_name": budget.project.name,
        "actual_expenses": expenses,
        "remaining_budget": budget.allocated_amount - expenses
    }


# ================= TRANSACTIONS =================

@router.post("/transactions", status_code=201)
def create_transaction(
    data: TransactionCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    if data.project_id is not None:
        get_record(db, Project, data.project_id)

    if data.transaction_date > date.today():
        raise HTTPException(400, "Future date is not allowed")

    if data.category.strip().lower() in [
        "invoice payment", "salary"
    ]:
        raise HTTPException(
            400,
            "Use the payment or salary section for this category"
        )

    transaction = FinanceTransaction(**data.model_dump())

    return serialize(
        save_record(
            db, transaction, current_user, "FinanceTransaction"
        )
    )


@router.get("/transactions")
def list_transactions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        {
            **serialize(item),
            "project_name": (
                item.project.name if item.project else None
            )
        }
        for item in db.query(FinanceTransaction).order_by(
            FinanceTransaction.transaction_date.desc()
        ).all()
    ]


# ================= PROJECT BUDGETS =================

@router.post("/budgets", status_code=201)
def create_budget(
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    get_record(db, Project, data.project_id)

    existing = db.query(ProjectBudget).filter(
        ProjectBudget.project_id == data.project_id
    ).first()

    if existing:
        raise HTTPException(
            400, "Budget already exists for this project"
        )

    budget = ProjectBudget(**data.model_dump())

    save_record(db, budget, current_user, "ProjectBudget")

    return budget_response(db, budget)


@router.get("/budgets")
def list_budgets(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        budget_response(db, budget)
        for budget in db.query(ProjectBudget).all()
    ]


@router.put("/budgets/{budget_id}")
def update_budget(
    budget_id: int,
    data: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    budget = get_record(db, ProjectBudget, budget_id)

    if budget.project_id != data.project_id:
        raise HTTPException(
            400, "Cannot change the budget project"
        )

    budget.allocated_amount = data.allocated_amount
    budget.description = data.description

    save_record(
        db, budget, current_user, "ProjectBudget", "UPDATE"
    )

    return budget_response(db, budget)


# ================= INVOICES =================

@router.post("/invoices", status_code=201)
def create_invoice(
    data: InvoiceCreate,
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

    if data.due_date < data.invoice_date:
        raise HTTPException(
            400, "Due date cannot precede invoice date"
        )

    invoice_number = f"INV-{uuid4().hex[:12].upper()}"

    invoice = Invoice(
        **data.model_dump(),
        invoice_number=invoice_number,
        status="Pending"
    )

    save_record(db, invoice, current_user, "Invoice")

    return invoice_response(db, invoice)


@router.get("/invoices")
def list_invoices(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        invoice_response(db, invoice)
        for invoice in db.query(Invoice).all()
    ]


# ================= PAYMENTS =================

@router.post("/payments", status_code=201)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    invoice = db.query(Invoice).filter(
        Invoice.id == data.invoice_id
    ).with_for_update().first()

    if not invoice:
        raise HTTPException(404, "Invoice not found")

    if data.payment_date > date.today():
        raise HTTPException(400, "Future date is not allowed")

    if data.payment_date < invoice.invoice_date:
        raise HTTPException(
            400, "Payment date cannot precede invoice date"
        )

    paid = total_paid(db, invoice.id)
    balance = invoice.amount - paid

    if data.amount > balance:
        raise HTTPException(
            400, "Payment exceeds outstanding balance"
        )

    payment = Payment(**data.model_dump())

    db.add(payment)
    db.flush()

    new_total = paid + data.amount

    invoice.status = (
        "Paid" if new_total == invoice.amount else "Partial"
    )

    transaction = FinanceTransaction(
        project_id=invoice.project_id,
        transaction_type="Income",
        category="Invoice Payment",
        amount=data.amount,
        transaction_date=data.payment_date,
        description=f"Payment for {invoice.invoice_number}"
    )

    db.add(transaction)
    db.flush()

    audit_record(
        db, current_user, "Payment", payment.id, "CREATE"
    )

    audit_record(
        db, current_user, "Invoice", invoice.id, "UPDATE"
    )

    audit_record(
        db, current_user,
        "FinanceTransaction", transaction.id, "CREATE"
    )

    db.commit()
    db.refresh(payment)

    return {
        **serialize(payment),
        "invoice_status": invoice.status,
        "remaining_balance": invoice.amount - new_total
    }


@router.get("/payments")
def list_payments(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        {
            **serialize(payment),
            "invoice_number": payment.invoice.invoice_number
        }
        for payment in db.query(Payment).all()
    ]


# ================= SALARY RECORDS =================

@router.post("/salaries", status_code=201)
def create_salary(
    data: SalaryCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    employee = get_record(db, Employee, data.employee_id)

    if not employee.is_active:
        raise HTTPException(400, "Employee is inactive")

    existing = db.query(SalaryRecord).filter(
        SalaryRecord.employee_id == data.employee_id,
        SalaryRecord.month == data.month,
        SalaryRecord.year == data.year
    ).first()

    if existing:
        raise HTTPException(
            400, "Salary record already exists for this month"
        )

    net_salary = (
        data.basic_salary +
        data.allowances -
        data.deductions
    )

    if net_salary <= 0:
        raise HTTPException(
            400, "Net salary must be greater than zero"
        )

    if net_salary > Decimal("9999999999.99"):
        raise HTTPException(400, "Net salary exceeds limit")

    salary = SalaryRecord(
        **data.model_dump(),
        net_salary=net_salary,
        status="Pending"
    )

    return serialize(
        save_record(db, salary, current_user, "SalaryRecord")
    )


@router.get("/salaries")
def list_salaries(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return [
        {
            **serialize(salary),
            "employee_name": salary.employee.full_name,
            "employee_code": salary.employee.employee_code
        }
        for salary in db.query(SalaryRecord).all()
    ]


@router.put("/salaries/{salary_id}/pay")
def pay_salary(
    salary_id: int,
    data: SalaryPayment,
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    salary = db.query(SalaryRecord).filter(
        SalaryRecord.id == salary_id
    ).with_for_update().first()

    if not salary:
        raise HTTPException(404, "Salary record not found")

    if salary.status == "Paid":
        raise HTTPException(400, "Salary is already paid")

    if data.payment_date > date.today():
        raise HTTPException(400, "Future date is not allowed")

    salary.status = "Paid"
    salary.payment_date = data.payment_date

    transaction = FinanceTransaction(
        transaction_type="Expense",
        category="Salary",
        amount=salary.net_salary,
        transaction_date=data.payment_date,
        description=(
            f"Salary for {salary.employee.full_name} "
            f"- {salary.month}/{salary.year}"
        )
    )

    db.add(transaction)
    db.flush()

    audit_record(
        db, current_user, "SalaryRecord", salary.id, "UPDATE"
    )

    audit_record(
        db, current_user,
        "FinanceTransaction", transaction.id, "CREATE"
    )

    db.commit()
    db.refresh(salary)

    return serialize(salary)


# ================= FINANCIAL REPORTS =================

@router.get("/reports")
def financial_report(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    income = total_transactions(db, "Income")
    expenses = total_transactions(db, "Expense")

    total_invoiced = db.query(
        func.coalesce(func.sum(Invoice.amount), 0)
    ).scalar()

    received_payments = db.query(
        func.coalesce(func.sum(Payment.amount), 0)
    ).scalar()

    pending_salaries = db.query(
        func.coalesce(func.sum(SalaryRecord.net_salary), 0)
    ).filter(
        SalaryRecord.status == "Pending"
    ).scalar()

    paid_salaries = db.query(
        func.coalesce(func.sum(SalaryRecord.net_salary), 0)
    ).filter(
        SalaryRecord.status == "Paid"
    ).scalar()

    return {
        "total_income": income,
        "total_expenses": expenses,
        "net_surplus": income - expenses,
        "total_invoiced": total_invoiced,
        "received_payments": received_payments,
        "outstanding_payments": total_invoiced - received_payments,
        "pending_salaries": pending_salaries,
        "paid_salaries": paid_salaries,
        "project_budgets": [
            budget_response(db, budget)
            for budget in db.query(ProjectBudget).all()
        ]
    }


# ================= DROPDOWN DATA =================

@router.get("/options")
def finance_options(
    db: Session = Depends(get_db),
    current_user: dict = Depends(access)
):
    return {
        "projects": [
            {"id": project.id, "name": project.name}
            for project in db.query(Project).all()
        ],
        "clients": [
            {"id": client.id, "company_name": client.company_name}
            for client in db.query(Client).all()
        ],
        "client_projects": [
            {
                "client_id": item.client_id,
                "project_id": item.project_id
            }
            for item in db.query(ClientProject).all()
        ],
        "employees": [
            {
                "id": employee.id,
                "full_name": employee.full_name,
                "employee_code": employee.employee_code
            }
            for employee in db.query(Employee).filter(
                Employee.is_active.is_(True)
            ).all()
        ]
    }
