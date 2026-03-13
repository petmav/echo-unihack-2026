"""
Database configuration and models.

Privacy-first design: Only email and password_hash stored.
No names, DOB, phone numbers, or other PII.

Uses SQLAlchemy with:
- Async engine (AsyncEngine / AsyncSession) for use in async FastAPI context
- Sync engine retained for synchronous route dependencies (account router)
"""

import os
import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, String, create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from config import config

# ── Engine setup ──────────────────────────────────────────────────────────────

DATABASE_URL: str = config.DATABASE_URL

# Use SQLite for testing when DATABASE_URL contains sqlite or USE_SQLITE=true
USE_SQLITE: bool = (
    "sqlite" in DATABASE_URL.lower()
    or os.getenv("USE_SQLITE", "false").lower() == "true"
)

if USE_SQLITE:
    # SQLite — used for local testing
    _sync_url = "sqlite:///./test_auth.db"
    engine = create_engine(_sync_url, connect_args={"check_same_thread": False})
    # aiosqlite-backed async engine for async operations in test context
    try:
        _async_url = "sqlite+aiosqlite:///./test_auth.db"
        async_engine = create_async_engine(_async_url)
    except Exception:
        async_engine = None  # type: ignore[assignment]
else:
    # PostgreSQL — use asyncpg driver for async, plain psycopg2/pg8000 for sync
    _pg_async_url = DATABASE_URL.replace(
        "postgresql://", "postgresql+asyncpg://"
    ).replace(
        "postgresql+psycopg2://", "postgresql+asyncpg://"
    )
    _pg_sync_url = DATABASE_URL.replace(
        "postgresql+asyncpg://", "postgresql://"
    )

    try:
        async_engine = create_async_engine(
            _pg_async_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
    except Exception:
        async_engine = None  # type: ignore[assignment]

    try:
        engine = create_engine(
            _pg_sync_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
    except Exception:
        # Fallback: create a SQLite engine so the module can always be imported.
        # PostgreSQL will be used at runtime when psycopg2/asyncpg are installed.
        engine = create_engine(
            "sqlite:///./test_auth.db",
            connect_args={"check_same_thread": False},
        )

# Session factories
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
AsyncSessionLocal = (
    async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    if async_engine is not None
    else None
)


# ── ORM base ──────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


# ── Models ────────────────────────────────────────────────────────────────────

class Account(Base):
    """
    User account model — minimal PII by design.

    Privacy constraints:
    - Only email and password_hash stored
    - No name, DOB, phone, profile photo, or other personal data
    - Raw thought text NEVER stored here (only on device localStorage)
    """
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Account(id={self.id}, email={self.email})>"


class MessageTheme(Base):
    """
    Links an account's submitted message_id to a theme_category.

    Privacy constraints:
    - Stores account_id → message_id → theme_category mapping only
    - No raw thought text ever stored here
    - message_id references the Elastic document (no direct Elastic linkage to account)
    - Used solely for account deletion to clean up per-user theme associations
    """
    __tablename__ = "message_themes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    account_id = Column(String, nullable=False, index=True)
    message_id = Column(String, nullable=False, index=True)
    theme_category = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<MessageTheme(account_id={self.account_id}, message_id={self.message_id}, theme={self.theme_category})>"


# ── Session dependencies ───────────────────────────────────────────────────────

def get_db():
    """
    Synchronous database session dependency for FastAPI routes.

    Provides a sync SQLAlchemy session and ensures cleanup.

    Usage:
        @router.delete("/account")
        def delete_account(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    """
    Async database session dependency for FastAPI async routes.

    Usage:
        @router.post("/thoughts")
        async def submit(db: AsyncSession = Depends(get_async_db)):
            ...

    Raises:
        RuntimeError: If async database driver (asyncpg/aiosqlite) is not installed.
    """
    if AsyncSessionLocal is None:
        raise RuntimeError(
            "Async database driver not available. "
            "Install asyncpg (PostgreSQL) or aiosqlite (SQLite)."
        )
    async with AsyncSessionLocal() as session:
        yield session


# ── Initialisation ────────────────────────────────────────────────────────────

def init_db() -> None:
    """
    Create all database tables synchronously.

    Called from main.py lifespan startup. Uses the sync engine so it can
    run before the async event loop is handed off to application routes.

    Tables created:
    - accounts (id, email, password_hash, created_at)
    - message_themes (id, account_id, message_id, theme_category, created_at)
    """
    Base.metadata.create_all(bind=engine)
