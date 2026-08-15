import sys
from pathlib import Path

# Add src directory to sys.path so package imports work seamlessly
src_dir = str(Path(__file__).resolve().parent.parent.parent)
if src_dir not in sys.path:
    sys.path.insert(0, src_dir)

try:
    from ats_core.parsers.anonymizer import ResumeAnonymizer
except ModuleNotFoundError:
    from anonymizer import ResumeAnonymizer

def main():
    anonymizer = ResumeAnonymizer(min_score_threshold=0.6)

    sample_resume_header = """
    Jane Doe
    San Francisco, CA | (415) 555-2671 | jane.doe@techcorp.io
    LinkedIn: linkedin.com/in/janedoe | GitHub: github.com/janedoe

    PROFESSIONAL SUMMARY
    Lead Backend Engineer based in Seattle, WA with 8+ years of experience architecting 
    distributed Python microservices and low-latency database systems.
    """

    print("--- RAW TEXT ---")
    print(sample_resume_header)

    # 1. Inspect raw entity detections
    results = anonymizer.analyze(sample_resume_header)
    print("\n--- DETECTED ENTITIES ---")
    for r in results:
        matched_text = sample_resume_header[r.start:r.end]
        print(f"Entity: {r.entity_type:<15} | Score: {r.score:.2f} | Matched: '{matched_text}'")

    # 2. Output sanitized text
    sanitized_text = anonymizer.anonymize(sample_resume_header)
    print("\n--- SANITIZED TEXT ---")
    print(sanitized_text)

if __name__ == "__main__":
    main()