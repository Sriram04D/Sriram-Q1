
from sqlalchemy.orm import Session
from models.audit_log import AuditLog


def record_audit(
    db: Session,
    user_id: int,
    action: str,
    entity_type: str,
    entity_id: int | None = None
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id
    )

    db.add(log)
