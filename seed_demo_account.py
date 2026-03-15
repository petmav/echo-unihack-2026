import uuid
from database import SessionLocal, Account
from services.auth import hash_password

db = SessionLocal()
existing = db.query(Account).filter(Account.email == "demo@echo.app").first()
if not existing:
    db.add(Account(id=str(uuid.uuid4()), email="demo@echo.app", password_hash=hash_password("echo2026")))
    db.commit()
    print("Seeded demo@echo.app")
else:
    print("Already exists")
db.close()
