import sys
from pathlib import Path

# Add src directory to sys.path
src_dir = str(Path(__file__).resolve().parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from ats_core.search.hybrid_retriever import HybridCandidateRetriever


def run_test():
    retriever = HybridCandidateRetriever()

    candidates = [
        {
            "id": "cand_1",
            "text": "Senior Backend Engineer with 7 years experience in Python, FastAPI, and Kubernetes. Built high-throughput microservices.",
            "metadata": {"title": "Senior Backend Engineer", "exp": 7}
        },
        {
            "id": "cand_2",
            "text": "Deep Learning / GPU Engineer specializing in CUDA acceleration, Triton kernels, and high-performance LLM inference serving.",
            "metadata": {"title": "CUDA Optimization Engineer", "exp": 5}
        },
        {
            "id": "cand_3",
            "text": "Infrastructure and Security Engineer with SOC2 compliance, AWS IAM hardening, and Terraform automation experience.",
            "metadata": {"title": "Security DevOps Lead", "exp": 6}
        },
        {
            "id": "cand_4",
            "text": "Full Stack developer working with React, TypeScript, Node.js, and MongoDB building SaaS customer dashboards.",
            "metadata": {"title": "Full Stack Engineer", "exp": 3}
        }
    ]

    print("\n--- Indexing Candidates ---")
    retriever.index_candidates(candidates)

    # Test Query with exact technical acronym (SOC2) and semantic concept (cloud infrastructure)
    query = "Seeking an engineer to handle SOC2 compliance and automated cloud security"
    print(f"\n--- Searching: '{query}' ---")

    results = retriever.hybrid_search(query, top_k=3)
    
    print("\nRank | Candidate ID | RRF Score | Dense Rank | BM25 Rank | Title")
    print("-" * 75)
    for idx, res in enumerate(results, start=1):
        print(
            f"{idx:<4} | {res['candidate_id']:<12} | {res['rrf_score']:<9.5f} | "
            f"{str(res['dense_rank']):<10} | {str(res['bm25_rank']):<9} | "
            f"{res['metadata'].get('title')}"
        )


if __name__ == "__main__":
    run_test()
