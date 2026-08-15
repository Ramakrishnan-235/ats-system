# run_validation_gate.py
import json
import logging
import random
import sys
import time
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Any

# Add src to sys.path
src_dir = str(Path(__file__).resolve().parent.parent / "src")
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

from ats_core.parsers.anonymizer import ResumeAnonymizer
from ats_core.parsers.ollama_extractor import OllamaCandidateExtractor
from ats_core.schema.candidate import CandidateProfile

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("validation_gate")

# --- Synthetic Benchmark Generator with Ground Truth PII ---
NAMES = ["Aarav Sharma", "Elena Rostova", "Marcus Vance", "Priya Patel", "Liam O'Connor", "Chen Wei", "Sofia Rodriguez"]
CITIES = ["San Francisco, CA", "Bangalore, India", "London, UK", "Berlin, Germany", "Austin, TX", "Toronto, Canada"]
DOMAINS = [
    ("Backend Engineer", ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker"]),
    ("MLOps Engineer", ["PyTorch", "Kubernetes", "MLflow", "Triton", "CUDA"]),
    ("Frontend Architect", ["TypeScript", "React", "Next.js", "Tailwind CSS", "GraphQL"]),
    ("Cloud DevOps Lead", ["Terraform", "AWS", "Go", "Prometheus", "CI/CD"]),
    ("Embedded Systems Engineer", ["C++", "FreeRTOS", "I2C", "Rust", "ARM Cortex"]),
]

@dataclass
class BenchmarkItem:
    resume_id: int
    raw_text: str
    ground_truth_pii: Dict[str, str]

def generate_benchmark_dataset(count: int = 100) -> List[BenchmarkItem]:
    """Generates 100 diverse resumes with known ground-truth PII for deterministic benchmarking."""
    dataset = []
    for i in range(1, count + 1):
        name = random.choice(NAMES) + f" {i}"
        email = f"candidate_{i}@" + random.choice(["gmail.com", "techmail.io", "domain.org"])
        phone = f"+1-{random.randint(200, 999)}-{random.randint(100, 999)}-{random.randint(1000, 9999)}"
        loc = random.choice(CITIES)
        role, stack = random.choice(DOMAINS)
        years = random.randint(2, 12)

        raw_resume = f"""
        # {name}
        **Email:** {email} | **Phone:** {phone} | **Location:** {loc}
        **Headline:** {role} with {years}+ years of experience.

        ## Executive Summary
        Accomplished {role} specialized in building high-reliability platforms. Expert in {', '.join(stack[:3])}.

        ## Professional Experience
        ### Senior {role} | Acme Corp ({loc})
        *2021-03 - Present*
        * Spearheaded migration of legacy services to {stack[0]} and {stack[1]}.
        * Reduced system latency by {random.randint(20, 60)}% across {random.randint(5, 50)} microservices.
        * Mentored a distributed team of {random.randint(3, 8)} junior engineers.

        ### {role} | Global Data Systems
        *2018-01 - 2021-02*
        * Designed core data pipelines utilizing {stack[2]} and {stack[3]}.
        * Managed high-throughput workloads processing over {random.randint(5, 50)}M daily transactions.

        ## Skills & Proficiencies
        * **Core Languages & Tools:** {', '.join(stack)}
        * **Certifications:** Certified Solutions Architect (AWS), Kubernetes CKA

        ## Education
        * **Bachelor of Science in Computer Science** - National Institute of Technology (2014 - 2018)
        """

        dataset.append(BenchmarkItem(
            resume_id=i,
            raw_text=raw_resume,
            ground_truth_pii={
                "name": name,
                "email": email,
                "phone": phone,
                "location": loc
            }
        ))
    return dataset


# --- Benchmark Test Harness ---
def run_gate():
    print("\n=======================================================")
    print("      ATS PHASE 1 VALIDATION GATE BENCHMARK SUITE       ")
    print("=======================================================\n")

    # 1. Initialize Engines
    logger.info("Initializing Microsoft Presidio Anonymizer...")
    anonymizer = ResumeAnonymizer(min_score_threshold=0.55)

    logger.info("Connecting to Local Ollama Instance ()...")
    extractor = OllamaCandidateExtractor(
        base_url="http://localhost:11434/v1",
        model_name="gemma4:e2b",
        temperature=0.0,
        max_retries=3
    )

    # 2. Generate 100 Sample Resumes
    logger.info("Generating 100 diverse benchmark resumes...")
    samples = generate_benchmark_dataset(100)

    # 3. Execution & Metrics Tracking
    total_pii_entities = 0
    correctly_masked_pii = 0
    schema_success_count = 0
    schema_failures = []
    latencies = []

    print(f"\nProcessing {len(samples)} resumes through the hybrid pipeline...")

    for item in samples:
        # A. Evaluate PII Masking Accuracy
        sanitized = anonymizer.anonymize(item.raw_text)
        
        # Verify ground truth masking
        for pii_type, pii_val in item.ground_truth_pii.items():
            total_pii_entities += 1
            # If the raw value is NOT in the sanitized text, it was successfully masked
            if pii_val not in sanitized:
                correctly_masked_pii += 1

        # B. Evaluate Ollama Structured Schema Extraction
        t0 = time.time()
        try:
            profile: CandidateProfile = extractor.extract_profile(sanitized)
            # Basic invariant validation
            assert profile.candidate_id is not None
            assert len(profile.skills.detailed_skills) >= 0
            assert profile.timeline.total_continuous_years >= 0.0
            schema_success_count += 1
        except Exception as err:
            schema_failures.append((item.resume_id, str(err)))
            logger.error(f"Resume #{item.resume_id} failed schema extraction: {err}")
        
        elapsed = time.time() - t0
        latencies.append(elapsed)

        if item.resume_id % 20 == 0 or item.resume_id == 100:
            print(f"  -> Processed {item.resume_id}/100 resumes... (Latest latency: {elapsed:.2f}s)")

    # 4. Compute Metrics
    pii_masking_accuracy = (correctly_masked_pii / total_pii_entities) * 100.0
    schema_success_rate = (schema_success_count / len(samples)) * 100.0
    avg_latency = sum(latencies) / len(latencies)

    # 5. Output Summary Report
    print("\n" + "=" * 55)
    print("                VALIDATION GATE RESULTS                ")
    print("=" * 55)
    print(f" Total Resumes Evaluated:          {len(samples)}")
    print(f" Total Ground Truth PII Spans:     {total_pii_entities}")
    print(f" Correctly Masked Spans:           {correctly_masked_pii}")
    print(f" PII Masking Accuracy:             {pii_masking_accuracy:.2f}%  (Target: >98.0%)")
    print(f" Schema Extraction Success:        {schema_success_count}/100 ({schema_success_rate:.1f}%) (Target: 100%)")
    print(f" Unhandled Schema Errors:          {len(schema_failures)}")
    print(f" Average Extraction Latency:       {avg_latency:.2f}s per resume")
    print("=" * 55)

    # 6. Gate Decision
    pii_passed = pii_masking_accuracy >= 98.0
    schema_passed = len(schema_failures) == 0

    if pii_passed and schema_passed:
        print("\n [PASSED] Validation Gate criteria satisfied. Ready for Phase 2 (Hybrid Retrieval)!\n")
        sys.exit(0)
    else:
        print("\n [FAILED] Validation Gate criteria NOT met:")
        if not pii_passed:
            print(f"  - PII Accuracy fell short: {pii_masking_accuracy:.2f}% < 98.0%")
        if not schema_passed:
            print(f"  - {len(schema_failures)} schema extraction errors encountered.")
            for fid, err in schema_failures[:5]:
                print(f"    * Sample #{fid}: {err}")
        sys.exit(1)

if __name__ == "__main__":
    run_gate()