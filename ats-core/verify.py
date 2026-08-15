# test_parser.py
from pathlib import Path
from ats.parsers.pdf_parser import HybridPDFParser

def run_parser_test():
    parser = HybridPDFParser()

    # Create or point to a test PDF file
    sample_pdf = Path("sample_resume.pdf")
    if not sample_pdf.exists():
        print("Please place a 'sample_resume.pdf' in this directory to test.")
        return

    with open(sample_pdf, "rb") as f:
        pdf_bytes = f.read()

    print("\nStarting parsing test...")
    text, engine_used = parser.parse_pdf(pdf_bytes, filename="sample_resume.pdf")

    print(f"\n================ Result (Engine: {engine_used.upper()}) ================")
    print(text[:800])
    print("\n... [Output Truncated] ...")
    print(f"\nTotal characters extracted: {len(text)}")

if __name__ == "__main__":
    run_parser_test()