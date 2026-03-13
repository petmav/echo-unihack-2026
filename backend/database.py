"""
Database configuration and models.

Privacy-first design: Only email and password_hash stored.
No names, DOB, phone numbers, or other PII.
"""

import os
import uuid
from datetime import datetime
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database connection URL
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://echo_user:echo_password@localhost:5432/echo_db")

# Use SQLite for testing if DATABASE_URL contains sqlite or if we can't connect to PostgreSQL
USE_SQLITE = "sqlite" in DATABASE_URL.lower() or os.getenv("USE_SQLITE", "false").lower() == "true"

if USE_SQLITE:
    DATABASE_URL = "sqlite:///./test_auth.db"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}  # SQLite-specific
    )
else:
    # Import PostgreSQL UUID type only when using PostgreSQL
    from sqlalchemy.dialects.postgresql import UUID as PG_UUID
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using
        pool_size=5,
        max_overflow=10
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class Account(Base):
    """
    User account model - minimal PII by design.

    Privacy constraints:
    - Only email and password_hash stored
    - No name, DOB, phone, profile photo, or other personal data
    - Raw thought text NEVER stored here (only on device localStorage)
    """
    __tablename__ = "accounts"

    # Use String for UUID in SQLite, PostgreSQL UUID in PostgreSQL
    if USE_SQLITE:
        id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    else:
        from sqlalchemy.dialects.postgresql import UUID as PG_UUID
        id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<Account(id={self.id}, email={self.email})>"


def get_db():
    """
    Dependency function for FastAPI routes.
    Provides a database session and ensures cleanup.

    Usage:
        @app.get("/endpoint")
        def endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database - create all tables.
    Called from main.py on startup.
    """
    Base.metadata.create_all(bind=engine)
