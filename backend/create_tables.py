
from database import Base, engine
import models

def create_tables():
    Base.metadata.create_all(bind=engine)
    print("ERP database tables created successfully!")

if __name__ == "__main__":
    create_tables()
