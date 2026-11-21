
from fastapi import FastAPI
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from fastapi.middleware.cors import CORSMiddleware

from database import engine

app = FastAPI(
    title="Studio Lite ERP API",
    description="Backend API for the ERP Management System",
    version="1.0.0"
)

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
