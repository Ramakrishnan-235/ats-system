"""Rebuild PostgreSQL document vectors after the EmbeddingGemma 2 migration.

Run: python -m ats_core.search.reindex_embeddings
Existing non-NULL new vectors are skipped, so interrupted runs are resumable.
"""

import argparse
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from ats_core.search.dense_embedder import DenseEmbedder
from ats_core.search.embedding_config import EMBEDDING_DIMENSION


def reindex(engine, embedder, batch_size=16, replace_all=False):
    counts = {}
    for table, content in [("candidates", "raw_anonymized_text"), ("job_postings", "job_description")]:
        with engine.connect() as connection:
            column_type = connection.execute(text(
                "SELECT format_type(atttypid, atttypmod) FROM pg_attribute "
                "WHERE attrelid = to_regclass(:table) AND attname = 'embedding' AND NOT attisdropped"
            ), {"table": table}).scalar_one_or_none()
        if column_type != f"vector({EMBEDDING_DIMENSION})":
            raise RuntimeError(f"Apply the 768-dimensional migration before reindexing {table}")
    for table, content in [("candidates", "raw_anonymized_text"), ("job_postings", "job_description")]:
        counts[table] = 0
        last_id = None
        while True:
            where = "WHERE TRUE" if replace_all else "WHERE embedding IS NULL"
            if last_id is not None:
                where += " AND id > :last_id"
            with engine.connect() as connection:
                rows = connection.execute(text(
                    f"SELECT id, {content} AS content FROM {table} {where} ORDER BY id LIMIT :limit"
                ), {"last_id": last_id, "limit": batch_size}).mappings().all()
            if not rows:
                break
            usable = [row for row in rows if row["content"] and row["content"].strip()]
            vectors = embedder.embed_documents([row["content"] for row in usable])
            # Commit a complete batch only after successful encoding; no partial batch writes.
            with engine.begin() as connection:
                for row, vector in zip(usable, vectors, strict=True):
                    connection.execute(text(
                        f"UPDATE {table} SET embedding = CAST(:vector AS vector) WHERE id = :id"
                    ), {"id": row["id"], "vector": "[" + ",".join(map(str, vector)) + "]"})
            counts[table] += len(usable)
            last_id = rows[-1]["id"]
    return counts


def main():
    load_dotenv(Path(__file__).resolve().parents[3] / ".env", override=False)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="Also regenerate existing 768-dimensional vectors")
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()
    if args.batch_size <= 0:
        parser.error("--batch-size must be positive")
    url = os.getenv("SYNC_DATABASE_URL", "postgresql://ats_user:ats_password@localhost:5433/ats_db")
    engine = create_engine(url, connect_args={"connect_timeout": 5})
    embedder = None
    try:
        embedder = DenseEmbedder()
        counts = reindex(engine, embedder, args.batch_size, args.all)
        print(f"Reindexed {counts['candidates']} candidates and {counts['job_postings']} jobs at {EMBEDDING_DIMENSION} dimensions")
    finally:
        if embedder is not None:
            embedder.close()
        engine.dispose()


if __name__ == "__main__":
    main()
