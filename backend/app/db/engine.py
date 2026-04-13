from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.config import settings
from app.db.base import Base

# Ensure the data directory exists before SQLite tries to open the file
_db_url = settings.database_url
if _db_url.startswith("sqlite"):
    # Extract file path from URL (strips leading slashes after scheme+driver)
    _db_path = _db_url.split("///", 1)[-1]
    if _db_path and _db_path != ":memory:":
        Path(_db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_async_engine(settings.database_url, echo=False)
async_session_factory = async_sessionmaker(engine, expire_on_commit=False)


async def create_tables() -> None:
    """Create all tables on startup if they don't exist (dev convenience)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
