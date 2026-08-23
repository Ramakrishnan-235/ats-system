import asyncio
import logging
import os
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ats.db.seed_jobs")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ats_user:ats_password@localhost:5433/ats_db"
)

async def seed_jobs():
    logger.info("Connecting to database to seed 50 job roles...")
    engine = create_async_engine(DATABASE_URL, echo=False)

    seed_file = Path(__file__).parent / "seed_jobs.sql"
    if not seed_file.exists():
        seed_file = Path("seed_jobs.sql")

    logger.info(f"Loading seed file from: {seed_file.resolve()}")
    sql_script = seed_file.read_text(encoding="utf-8")

    async with engine.begin() as conn:
        logger.info("Executing job postings seed...")
        raw_conn = await conn.get_raw_connection()
        await raw_conn.driver_connection.execute(sql_script)
        logger.info("✓ 50 Job roles successfully seeded into PostgreSQL database!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_jobs())
