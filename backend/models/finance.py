
from sqlalchemy import (
    Column, Integer, String, Text, Date,
    ForeignKey, Numeric, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


class FinanceTransaction(Base):
    __tablename__ = "finance_transactions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id"), nullable=True
    )
    transaction_type = Column(String(20), nullable=False)
    category = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    transaction_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)

    project = relationship("Project")


class ProjectBudget(Base):
    __tablename__ = "project_budgets"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id"),
        unique=True,
        nullable=False
    )
    allocated_amount = Column(Numeric(12, 2), nullable=False)
    description = Column(Text, nullable=True)

    project = relationship("Project")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(
        String(30), unique=True, nullable=False
    )
    client_id = Column(
        Integer, ForeignKey("clients.id"), nullable=False
    )
    project_id = Column(
        Integer, ForeignKey("projects.id"), nullable=False
    )
    amount = Column(Numeric(12, 2), nullable=False)
    invoice_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(
        String(20), default="Pending", nullable=False
    )

    client = relationship("Client")
    project = relationship("Project")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(
        Integer, ForeignKey("invoices.id"), nullable=False
    )
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    payment_method = Column(String(30), nullable=False)
    reference = Column(String(150), nullable=True)

    invoice = relationship("Invoice")


class SalaryRecord(Base):
    __tablename__ = "salary_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(
        Integer, ForeignKey("employees.id"), nullable=False
    )
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    basic_salary = Column(Numeric(12, 2), nullable=False)
    allowances = Column(
        Numeric(12, 2), default=0, nullable=False
    )
    deductions = Column(
        Numeric(12, 2), default=0, nullable=False
    )
    net_salary = Column(Numeric(12, 2), nullable=False)
    status = Column(
        String(20), default="Pending", nullable=False
    )
    payment_date = Column(Date, nullable=True)

    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint(
            "employee_id", "month", "year",
            name="uq_employee_monthly_salary"
        ),
    )
