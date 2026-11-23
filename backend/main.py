
from fastapi import FastAPI, Depends
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from fastapi.middleware.cors import CORSMiddleware

from routers.auth import router as auth_router
from routers.departments import router as departments_router
from routers.employees import router as employees_router
from routers.teams import router as teams_router
from routers.company import router as company_router
from routers.audit_logs import router as audit_logs_router
from routers import attendance
from routers import leaves
from routers import performance

from database import engine
from security import require_roles


app = FastAPI(
    title="Studio Lite ERP API",
    description="Backend API for the ERP Management System",
    version="1.0.0"
)

app.include_router(auth_router)
app.include_router(departments_router)
app.include_router(employees_router)
app.include_router(teams_router)
app.include_router(company_router)
app.include_router(audit_logs_router)
app.include_router(attendance.router)
app.include_router(leaves.router)
app.include_router(performance.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "Studio Lite ERP Backend is running successfully!"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/db-test")
def test_database():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "status": "success",
            "message": "FastAPI connected to MySQL successfully!"
        }

    except SQLAlchemyError:
        return {
            "status": "error",
            "message": "Database connection failed. Check backend logs."
        }


@app.get("/admin/dashboard", tags=["Admin"])
def admin_dashboard(
    current_user: dict = Depends(require_roles("Admin"))
):
    return {
        "message": "Welcome to Admin Dashboard",
        "user": current_user["username"],
        "access": "Admin only"
    }
