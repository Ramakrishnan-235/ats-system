import fitz
from ats_core.parsers.pdf_parser import HybridPDFParser


def create_sample_two_page_pdf() -> bytes:
    doc = fitz.open()
    
    # Page 1
    p1 = doc.new_page(width=612, height=792)
    p1.insert_text(
        (50, 72),
        "Priya Sharma\n"
        "Senior Backend Engineer | priya.s@example.com | (415) 555-0192 | San Francisco, CA\n\n"
        "EXECUTIVE SUMMARY\n"
        "Staff Software Engineer with 8+ years of experience designing scalable microservices in Python and Go.\n\n"
        "PROFESSIONAL EXPERIENCE\n"
        "Staff Engineer | Stripe (2021 — Present)\n"
        "- Led migration of monolith to FastAPI microservices, reducing p99 latency by 40%.\n"
        "- Implemented robust idempotency keys for distributed payments.\n"
        "- Mentored 3 junior engineers.\n\n"
        "Senior Engineer | Uber (2018 — 2021)\n"
        "- Designed real-time geospatial driver dispatch ingestion microservices with Go and Kafka.\n"
    )
    
    # Page 2
    p2 = doc.new_page(width=612, height=792)
    p2.insert_text(
        (50, 72),
        "EDUCATION\n"
        "Master of Science in Computer Science — Stanford University (2016 — 2018)\n"
        "Bachelor of Technology in Computer Engineering — NIT (2012 — 2016)\n\n"
        "CORE SKILLS & TECHNOLOGIES\n"
        "Languages: Python, Go, TypeScript, SQL\n"
        "Infrastructure: Kubernetes, Docker, AWS, Terraform, Kafka, PostgreSQL, Redis\n"
    )
    
    return doc.tobytes()


def test_pdf_citation_grounding_page_1():
    pdf_bytes = create_sample_two_page_pdf()
    parser = HybridPDFParser()

    quote = "Led migration of monolith to FastAPI microservices, reducing p99 latency by 40%."
    loc = parser.locate_citation_in_pdf(pdf_bytes, quote)

    assert loc is not None
    assert loc["page"] == 1
    assert "bbox" in loc
    assert loc["bbox"]["x"] > 0
    assert loc["bbox"]["y"] > 0
    assert loc["bbox"]["width"] > 0
    assert loc["bbox"]["height"] > 0
    print("  ✓ Page 1 citation grounded successfully with coordinates:", loc["bbox"])


def test_pdf_citation_grounding_page_2():
    pdf_bytes = create_sample_two_page_pdf()
    parser = HybridPDFParser()

    quote = "Master of Science in Computer Science — Stanford University"
    loc = parser.locate_citation_in_pdf(pdf_bytes, quote)

    assert loc is not None
    assert loc["page"] == 2
    assert "bbox" in loc
    assert loc["bbox"]["x"] > 0
    assert loc["bbox"]["y"] > 0
    print("  ✓ Page 2 citation grounded successfully with coordinates:", loc["bbox"])


def test_pdf_citation_not_found():
    pdf_bytes = create_sample_two_page_pdf()
    parser = HybridPDFParser()

    loc = parser.locate_citation_in_pdf(pdf_bytes, "Non-existent phrase that is not in the document")
    assert loc is None
    print("  ✓ Non-existent citation correctly returns None.")


if __name__ == "__main__":
    test_pdf_citation_grounding_page_1()
    test_pdf_citation_grounding_page_2()
    test_pdf_citation_not_found()
    print("🎉 All PDF citation grounding tests passed!")
