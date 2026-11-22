
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from models.audit_log import AuditLog
from models.user import User
from security import require_roles

router = APIRouter(
    prefix="/audit-logs",
    tags=["Audit Logs"]
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_roles("Admin"))
):
    logs = (
        db.query(AuditLog, User.username)
        .join(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.id.desc())
        .all()
    )

    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "username": username,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "created_at": log.created_at
        }
        for log, username in logs
    ]
