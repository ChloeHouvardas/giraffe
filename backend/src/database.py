from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create async engine with pgbouncer compatibility
engine = create_async_engine(
    DATABASE_URL,
    echo=False,  # Turn off SQL logging for cleaner output
    future=True,
    pool_pre_ping=True,
    connect_args={
        "statement_cache_size": 0,  # Disable prepared statements for pgbouncer
        "prepared_statement_cache_size": 0,
    },
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()

# Dependency for getting DB sessions
async def get_db():
    """Dependency that provides a database session"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()