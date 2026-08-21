import sys
from pathlib import Path

# Add src to sys.path
src_dir = str(Path(__file__).resolve().parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

try:
    from ats_core.search.reranker import CandidateReranker
except ImportError:
    from ats.search.reranker import CandidateReranker


def test_reranker():
    reranker = CandidateReranker(model_name="BAAI/bge-reranker-large")

    query = (
        "Seeking a Lead MLOps Engineer to deploy high-throughput LLMs using "
        "vLLM, Triton Inference Server, and custom CUDA optimization."
    )

    # Candidate pool retrieved from Stage 1
    sample_candidates = [
        {
            "candidate_id": "cand_01_keyword_stuffer",
            "target_headline": "Full Stack Web Developer",
            "years_of_experience": 2.0,
            "skills": ["HTML", "CSS", "JavaScript", "vLLM", "CUDA", "Triton"],
            "executive_summary": "Junior web developer who read about vLLM and CUDA optimization in personal blog tutorials.",
        },
        {
            "candidate_id": "cand_02_actual_specialist",
            "target_headline": "Senior AI Infrastructure & MLOps Engineer",
            "years_of_experience": 6.5,
            "skills": ["Python", "CUDA", "C++", "Triton", "vLLM", "Kubernetes", "PyTorch"],
            "executive_summary": "Architected low-latency inference platforms serving 50M daily LLM tokens. Built custom CUDA kernels and deployed Triton clusters.",
        },
        {
            "candidate_id": "cand_03_general_backend",
            "target_headline": "Senior Backend Developer",
            "years_of_experience": 7.0,
            "skills": ["Java", "Spring Boot", "AWS", "Docker", "PostgreSQL"],
            "executive_summary": "Built scalable banking backend architectures with high uptime and relational database optimization.",
        }
    ]

    print("\n--- Running BGE Cross-Encoder Re-Ranking ---")
    results = reranker.rerank(query=query, candidates=sample_candidates, top_k=3)

    print("\nRank | Candidate ID               | Rerank Score | Logit  | Headline")
    print("-" * 80)
    for res in results:
        print(
            f"{res['rerank_rank']:<4} | {res['candidate_id']:<26} | "
            f"{res['rerank_score']:<12.4f} | {res['rerank_raw_score']:<6.2f} | "
            f"{res['target_headline']}"
        )

    # Invariants verification
    assert len(results) == 3
    assert results[0]["candidate_id"] == "cand_02_actual_specialist", "Specialist must be ranked #1"
    assert results[0]["rerank_score"] > results[1]["rerank_score"], "Rank 1 score must exceed Rank 2 score"
    print("\n✓ Reranker verification passed successfully!")


if __name__ == "__main__":
    test_reranker()
