
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(150), unique=True, nullable=False)

    hashed_password = Column(String(255), nullable=False)

    role_id = Column(
        Integer,
        ForeignKey("roles.id"),
        nullable=False
    )

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(
        DateTime,
        server_default=func.now()
    )

    role = relationship("Role")
    employee = relationship(
        "Employee",
        back_populates="user",
        uselist=False
    )
