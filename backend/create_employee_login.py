from getpass import getpass
from database import SessionLocal
from models import *
from models.user import User
from models.role import Role
from models.employee import Employee
from security import hash_password

db = SessionLocal()

try:
    role = db.query(Role).filter(
        Role.name == "Employee",
        Role.is_active.is_(True)
    ).first()

    employee = db.query(Employee).filter(
        Employee.id == 1,
        Employee.is_active.is_(True)
    ).first()

    if not role or not employee:
        raise Exception("Active role or employee not found")

    if employee.user_id is not None:
        raise Exception("Employee already has a login")

    email = "dhanush@example.com"

    existing = db.query(User).filter(
        User.email == email
    ).first()

    if existing:
        raise Exception("Email already exists")

    password = getpass("Enter employee password: ")

    if len(password) < 8:
        raise Exception("Password must have at least 8 characters")

    user = User(
        username="Dhanush",
        email=email,
        hashed_password=hash_password(password),
        role_id=role.id,
        is_active=True
    )

    db.add(user)
    db.flush()

    employee.user_id = user.id

    db.commit()

    print("Employee login created successfully!")

except Exception as e:
    db.rollback()
    print("Error:", e)

finally:
    db.close()