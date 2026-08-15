import asyncio
import os
import random
import sys
from pathlib import Path

# Add src to sys.path
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from ats_core.db.vector_store import VectorStore, CandidateSearchParams
from ats_core.db.init_db import provision_database

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://ats_user:ats_password@localhost:5432/ats_db"
)


def generate_mock_embedding(dim: int = 1536, seed: int = 42) -> list[float]:
    """Generates a normalized random embedding vector for deterministic testing."""
    rng = random.Random(seed)
    vec = [rng.uniform(-1.0, 1.0) for _ in range(dim)]
    norm = sum(x * x for x in vec) ** 0.5
    return [x / norm for x in vec]


async def run_vector_search_test():
    print("\n" + "=" * 70)
    print("🚀 1. Provisioning Database & pgvector HNSW Indexes...")
    print("=" * 70)
    await provision_database()

    store = VectorStore(DATABASE_URL)

    print("\n" + "=" * 70)
    print("📥 2. Inserting Test Candidates with 1536-dim Embeddings & Metadata...")
    print("=" * 70)

    # Base query vector (target domain: Python / Backend Engineer)
    query_vec = generate_mock_embedding(seed=100)

    # Candidate 1: Close vector match (seed 101), Senior, SF, Master's
    emb_1 = generate_mock_embedding(seed=101)
    c1 = await store.insert_candidate(
        target_headline="Senior Backend Architect",
        years_of_experience=7.5,
        location="San Francisco, CA",
        highest_education="Master of Science in Computer Science",
        core_skills=["Python", "FastAPI", "PostgreSQL", "Docker"],
        embedding=emb_1,
        raw_anonymized_text="Experienced senior backend architect in SF.",
    )
    print(f"✓ Inserted: {c1.target_headline} ({c1.years_of_experience} yrs, {c1.location}, {c1.highest_education})")

    # Candidate 2: Close vector match (seed 102), Junior, SF, Bachelor's
    emb_2 = generate_mock_embedding(seed=102)
    c2 = await store.insert_candidate(
        target_headline="Junior Backend Developer",
        years_of_experience=2.0,
        location="San Francisco, CA",
        highest_education="Bachelor of Science in Information Technology",
        core_skills=["Python", "Django", "PostgreSQL"],
        embedding=emb_2,
        raw_anonymized_text="Junior developer with 2 yrs exp in SF.",
    )
    print(f"✓ Inserted: {c2.target_headline} ({c2.years_of_experience} yrs, {c2.location}, {c2.highest_education})")

    # Candidate 3: Senior, Austin, PhD
    emb_3 = generate_mock_embedding(seed=103)
    c3 = await store.insert_candidate(
        target_headline="Lead Data & ML Systems Engineer",
        years_of_experience=9.0,
        location="Austin, TX",
        highest_education="PhD in Computer Engineering",
        core_skills=["Python", "PyTorch", "Kubernetes", "PostgreSQL"],
        embedding=emb_3,
        raw_anonymized_text="Lead engineer in Austin.",
    )
    print(f"✓ Inserted: {c3.target_headline} ({c3.years_of_experience} yrs, {c3.location}, {c3.highest_education})")

    # Candidate 4: Remote Senior
    emb_4 = generate_mock_embedding(seed=104)
    c4 = await store.insert_candidate(
        target_headline="Senior Distributed Systems Engineer",
        years_of_experience=6.0,
        location="Remote",
        highest_education="Master of Engineering",
        core_skills=["Go", "Python", "Kubernetes", "gRPC"],
        embedding=emb_4,
        raw_anonymized_text="Remote distributed systems engineer.",
    )
    print(f"✓ Inserted: {c4.target_headline} ({c4.years_of_experience} yrs, {c4.location}, {c4.highest_education})")

    # -------------------------------------------------------------------------
    # TEST 1: Pure Vector Search (No Filter)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("🔍 TEST 1: Pure Vector Similarity Search (Unfiltered Top 3)")
    print("-" * 70)
    results_all = await store.search_candidates_by_vector(query_vec, CandidateSearchParams(limit=3))
    assert len(results_all) > 0, "Expected search results"
    for r in results_all:
        print(f"  • [{r.similarity_score:.4f}] {r.target_headline} | {r.years_of_experience} yrs | {r.location} | {r.highest_education}")

    # -------------------------------------------------------------------------
    # TEST 2: Filter by Experience (>= 5.0 years)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("🔍 TEST 2: Vector Search + Experience Filter (>= 5.0 years)")
    print("-" * 70)
    exp_filter = CandidateSearchParams(min_years_experience=5.0)
    results_exp = await store.search_candidates_by_vector(query_vec, exp_filter)
    for r in results_exp:
        assert r.years_of_experience >= 5.0, f"Candidate has {r.years_of_experience} < 5.0 yrs"
        print(f"  ✓ [{r.similarity_score:.4f}] {r.target_headline} | {r.years_of_experience} yrs >= 5.0")

    # -------------------------------------------------------------------------
    # TEST 3: Filter by Location ("San Francisco")
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("🔍 TEST 3: Vector Search + Location Filter ('San Francisco' / 'Remote')")
    print("-" * 70)
    loc_filter = CandidateSearchParams(location="San Francisco")
    results_loc = await store.search_candidates_by_vector(query_vec, loc_filter)
    for r in results_loc:
        assert "San Francisco" in r.location or "Remote" in r.location, f"Unexpected location: {r.location}"
        print(f"  ✓ [{r.similarity_score:.4f}] {r.target_headline} | Location: {r.location}")

    # -------------------------------------------------------------------------
    # TEST 4: Filter by Education (Master / PhD)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("🔍 TEST 4: Vector Search + Education Filter ('Master' / 'PhD')")
    print("-" * 70)
    edu_filter = CandidateSearchParams(highest_education=["Master", "PhD"])
    results_edu = await store.search_candidates_by_vector(query_vec, edu_filter)
    for r in results_edu:
        assert any(e in (r.highest_education or "") for e in ["Master", "PhD"]), f"Unexpected education: {r.highest_education}"
        print(f"  ✓ [{r.similarity_score:.4f}] {r.target_headline} | Education: {r.highest_education}")

    # -------------------------------------------------------------------------
    # TEST 5: Combined Multi-Payload Filter (Experience >= 5.0, SF/Remote, Master/PhD)
    # -------------------------------------------------------------------------
    print("\n" + "-" * 70)
    print("🎯 TEST 5: Combined Multi-Payload Filter (Exp >= 5.0 + SF + Master)")
    print("-" * 70)
    combined_filter = CandidateSearchParams(
        min_years_experience=5.0,
        location="San Francisco",
        highest_education=["Master"],
        limit=5
    )
    results_combined = await store.search_candidates_by_vector(query_vec, combined_filter)
    assert len(results_combined) >= 1, "Expected at least 1 match for combined filter"
    for r in results_combined:
        print(f"  🏆 MATCH: {r.target_headline} | Score: {r.similarity_score:.4f} | {r.years_of_experience} yrs | {r.location} | {r.highest_education}")
        assert r.years_of_experience >= 5.0
        assert "San Francisco" in r.location or "Remote" in r.location
        assert "Master" in (r.highest_education or "")

    await store.close()
    print("\n" + "=" * 70)
    print("🎉 ALL PGVECTOR HNSW & PAYLOAD FILTER TESTS PASSED SUCCESSFULLY!")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    asyncio.run(run_vector_search_test())
