
from sqlalchemy import Column, Integer, String
from database import Base


class Company(Base):
    __tablename__ = "company"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(150), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(String(255), nullable=True)
    website = Column(String(255), nullable=True)
