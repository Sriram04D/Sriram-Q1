
from getpass import getpass

from database import SessionLocal
from models import Role, User
from security import hash_password


def create_admin():
    db = SessionLocal()

    try:
        admin_role = db.query(Role).filter(
            Role.name == "Admin"
        ).first()

        if not admin_role:
            print("Admin role not found!")
            return

        email = input("Admin email: ").strip().lower()
        username = input("Admin username: ").strip()

        if not email or not username:
            print("Email and username are required.")
            return

        existing_user = db.query(User).filter(
            (User.email == email) | (User.username == username)
        ).first()

        if existing_user:
            print("Email or username already exists!")
            return

        password = getpass("Admin password: ")
        confirm_password = getpass("Confirm password: ")

        if len(password) < 12:
            print("Password must be at least 12 characters.")
            return

        if password != confirm_password:
            print("Passwords do not match!")
            return

        admin = User(
            username=username,
            email=email,
            hashed_password=hash_password(password),
            role_id=admin_role.id,
            is_active=True
        )

        db.add(admin)
        db.commit()

        print("Admin account created successfully!")

    except Exception as e:
        db.rollback()
        print(f"Error creating admin: {e}")

    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
