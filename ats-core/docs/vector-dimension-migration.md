# Embedding dimension correction

The configured default model is `BAAI/bge-small-en-v1.5` (384 dimensions).
The former SQL schema and ORM used 1536 dimensions, causing generated candidate
embeddings to fail at the PostgreSQL boundary. Fresh schemas and ORM definitions
now use 384. `CREATE TABLE IF NOT EXISTS` does **not** alter existing columns.

No existing database was changed during this refactor. Before deploying to an
existing database:

1. Back up the database and confirm the live types of both `candidates.embedding`
   and `job_postings.embedding` in PostgreSQL. Check which model produced existing
   vectors; matching dimensions alone do not imply compatible vector spaces.
2. Pause writes and searches during a reviewed migration, or build replacement
   `vector(384)` columns and indexes beside the old ones for a staged cutover.
3. Regenerate all candidate **document** vectors and any job query vectors using
   the configured model and the same preprocessing as application search. Do not
   truncate, pad, or cast 1536-dimensional vectors into 384-dimensional vectors.
4. Create cosine HNSW indexes on the replacement columns, validate representative
   insert/search results and record counts, then cut over application and schema
   together. Preserve old columns/backups until rollback requirements are met.
5. For an existing database whose vectors are all NULL, changing the column type
   is still a deliberate migration; review index recreation and locks first.

Changing the configured embedding model requires a compatible shared dimension
contract and re-embedding the entire corpus. API vector inputs must be finite,
384-dimensional, and have nonzero norm; incompatible vectors now fail before a
database operation. PostgreSQL migration and HNSW behavior require integration
validation with the intended deployment database.
