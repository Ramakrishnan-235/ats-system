import asyncio
import logging
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ats.db.provision")

# PostgreSQL async connection URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ats_user:ats_password@localhost:5432/ats_db"
)

async def provision_database():
    logger.info("Connecting to PostgreSQL 16...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    schema_file = Path(__file__).parent / "schema.sql"
    if not schema_file.exists():
        # Fallback to root or current directory
        schema_file = Path("schema.sql")

    logger.info(f"Loading DDL schema from: {schema_file.resolve()}")
    sql_script = schema_file.read_text()

    async with engine.begin() as conn:
        logger.info("Executing DDL migration script...")
        # Use raw connection to execute multi-statement DDL script cleanly
        raw_conn = await conn.get_raw_connection()
        await raw_conn.driver_connection.execute(sql_script)
        logger.info("✓ Tables, Indexes, Triggers, and pgvector HNSW indexes successfully created!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(provision_database())