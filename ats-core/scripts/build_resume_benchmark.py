"""Build ten deterministic, entirely synthetic PDF fixtures and independent gold labels."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "benchmarks" / "resume-extraction"
VERSION = "synthetic-pilot-v1"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def person(name, email, phone, role, company, skills_line, skills, bullet, education):
    """Content and expected facts are authored here; no parser generates labels."""
    return {
        "left": [name, email, phone, "Chennai, Tamil Nadu", "", "TECHNICAL SKILLS",
                 skills_line, "", "EDUCATION", education],
        "right": ["EXPERIENCE", role, company, "Jan 2023 - Dec 2024", "- " + bullet],
        "fields": {"name": name, "email": email, "phone": phone,
                   "location": "Chennai, Tamil Nadu", "linkedin": None,
                   "highest_education": education},
        "skills": [{"canonical_name": skill, "quote": quote, "page": 1}
                   for skill, quote in skills],
        "employment": [{"company": company, "role": role,
                        "start_date": "2023-01", "end_date": "2024-12"}],
        "negative_skills": [],
    }


def definitions() -> list[dict]:
    backend = person(
        "Ada Fixture", "ada@example.invalid", "+14155550101", "Backend Developer",
        "Example Backend Lab", "Python, FastAPI, PostgreSQL",
        [(s, "Built services using Python, FastAPI and PostgreSQL.")
         for s in ["Python", "FastAPI", "PostgreSQL"]],
        "Built services using Python, FastAPI and PostgreSQL.",
        "B.Tech Computer Science - Example Institute",
    )
    frontend = person(
        "Blake Fixture", "blake@example.invalid", "+14155550102", "Frontend Developer",
        "Example Interface Lab", "JavaScript, TypeScript, React",
        [(s, "Built interfaces using JavaScript, TypeScript and React.")
         for s in ["JavaScript", "TypeScript", "React"]],
        "Built interfaces using JavaScript, TypeScript and React.",
        "Bachelor of Science - Example University",
    )
    data = person(
        "Casey Fixture", "casey@example.invalid", "+14155550103", "Data Analyst",
        "Example Data Lab", "Python, SQL, Pandas",
        [(s, "Built reports using Python, SQL and Pandas.") for s in ["Python", "SQL", "Pandas"]],
        "Built reports using Python, SQL and Pandas.",
        "Master of Science - Example University",
    )
    cloud = person(
        "Dana Fixture", "dana@example.invalid", "+14155550104", "Cloud Engineer",
        "Example Cloud Lab", "AWS, Docker, Kubernetes, Terraform",
        [(s, "Deployed services using AWS, Docker, Kubernetes and Terraform.")
         for s in ["AWS", "Docker", "Kubernetes", "Terraform"]],
        "Deployed services using AWS, Docker, Kubernetes and Terraform.",
        "Bachelor of Engineering - Example Institute",
    )
    aliases = person(
        "Blake Fixture", "blake@example.invalid", "+14155550102", "Frontend Developer",
        "Example Interface Lab", "Languages: JS, TS | Frameworks: ReactJS",
        [(s, "Built interfaces using JS, TS and ReactJS.")
         for s in ["JavaScript", "TypeScript", "React"]],
        "Built interfaces using JS, TS and ReactJS.",
        "Bachelor of Science - Example University",
    )
    semantic = person(
        "Evan Fixture", "evan@example.invalid", "+14155550105", "Backend Developer",
        "Example Delivery Lab", "Python",
        [("Python", "Built services using Python."),
         ("CI/CD", "Automated continuous integration and continuous delivery pipelines.")],
        "Built services using Python.", "B.Tech Computer Science - Example Institute",
    )
    semantic["right"].append("- Automated continuous integration and continuous delivery pipelines.")
    negative = person(
        "Finn Fixture", "finn@example.invalid", "+14155550106", "Backend Developer",
        "Example Systems Lab", "Python, Docker",
        [(s, "Built services using Python and Docker.") for s in ["Python", "Docker"]],
        "Built services using Python and Docker.", "B.Tech Computer Science - Example Institute",
    )
    negative["right"] += ["- No hands-on experience with Kubernetes.",
                          "- Collaborated with another team responsible for AWS infrastructure."]
    negative["negative_skills"] = [
        {"canonical_name": "Kubernetes", "quote": "No hands-on experience with Kubernetes.", "page": 1},
        {"canonical_name": "AWS", "quote": "Collaborated with another team responsible for AWS infrastructure.", "page": 1},
    ]
    missing = {
        "left": ["TECHNICAL SKILLS", "SQL, OrbitQueryX", "", "PROJECTS",
                 "Built SQL queries for a fictional inventory dataset.",
                 "Used OrbitQueryX to inspect the results."], "right": [],
        "fields": dict.fromkeys(["name", "email", "phone", "location", "linkedin", "highest_education"]),
        "skills": [
            {"canonical_name": "SQL", "quote": "Built SQL queries for a fictional inventory dataset.", "page": 1},
            {"canonical_name": "OrbitQueryX", "quote": "Used OrbitQueryX to inspect the results.", "page": 1},
        ], "employment": [], "negative_skills": [],
    }
    cases = [
        ("001", "backend", "dev", "single_column", backend),
        ("002", "frontend", "test", "single_column", frontend),
        ("003", "data", "dev", "two_column", data),
        ("004", "cloud", "test", "two_column", cloud),
        ("005", "backend", "dev", "scanned", backend),
        ("006", "data", "dev", "scanned", data),
        ("007", "frontend", "test", "aliases", aliases),
        ("008", "semantic", "dev", "paraphrase", semantic),
        ("009", "negative", "test", "negation_attribution", negative),
        ("010", "missing", "test", "missing_fields_catalog_gap", missing),
    ]
    return [{"id": "synthetic-" + num, "group_id": group, "split": split,
             "category": category, **content} for num, group, split, category, content in cases]


def text_pdf(case: dict) -> bytes:
    stream = io.BytesIO()
    page = canvas.Canvas(stream, pagesize=(612, 792), invariant=1, pageCompression=1)
    page.setTitle(case["id"] + " - synthetic benchmark fixture")
    page.setAuthor("ATS synthetic benchmark")
    if case["category"] == "two_column":
        columns = [(42, 252, case["left"]), (318, 252, case["right"])]
    else:
        columns = [(42, 528, case["left"] + [""] + case["right"])]
    for x, width, lines in columns:
        y = 744
        for line in lines:
            if not line:
                y -= 14
                continue
            heading = line in {"TECHNICAL SKILLS", "EXPERIENCE", "EDUCATION", "PROJECTS"}
            font = "Helvetica-Bold" if heading else "Helvetica"
            size = 11 if heading else 10
            page.setFont(font, size)
            for wrapped in simpleSplit(line, font, size, width):
                if y < 54:
                    raise ValueError("Fixture text overflows page: " + case["id"])
                page.drawString(x, y, wrapped)
                y -= 15
    page.setFont("Helvetica", 8)
    page.drawString(42, 28, "SYNTHETIC TEST DOCUMENT - NOT A REAL CANDIDATE")
    page.drawRightString(570, 28, "1")
    page.showPage()
    page.save()
    return stream.getvalue()


def scan_pdf(pdf_bytes: bytes) -> bytes:
    """Rasterize without a hidden text layer; prefer the project's existing PyMuPDF."""
    try:
        import fitz
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            image = document[0].get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
    except ImportError:
        executable = shutil.which("pdftoppm")
        if not executable:
            raise RuntimeError("Scanned fixture generation needs PyMuPDF or pdftoppm")
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            if not Path(directory).resolve().is_relative_to(ROOT.resolve()):
                raise ValueError("Temporary PDF directory is outside the project")
            source = Path(directory) / "source.pdf"
            source.write_bytes(pdf_bytes)
            prefix = Path(directory) / "page"
            subprocess.run([executable, "-png", "-singlefile", "-r", "144",
                            str(source), str(prefix)], check=True, capture_output=True)
            image = prefix.with_suffix(".png").read_bytes()
    stream = io.BytesIO()
    page = canvas.Canvas(stream, pagesize=(612, 792), invariant=1, pageCompression=1)
    page.setTitle("Synthetic scanned resume")
    page.setAuthor("ATS synthetic benchmark")
    page.drawImage(ImageReader(io.BytesIO(image)), 0, 0, width=612, height=792)
    page.showPage()
    page.save()
    return stream.getvalue()


def build(destination: Path = DATASET) -> None:
    for folder in ["documents", "labels", "sources"]:
        (destination / folder).mkdir(parents=True, exist_ok=True)
    seed = json.loads((ROOT.parent / "backend-rust" / "taxonomy-seed.json").read_text(encoding="utf-8"))
    taxonomy_path = destination / "taxonomy.json"
    # Once published, a snapshot stays frozen across rebuilds and parser revisions.
    if not taxonomy_path.exists():
        for row in seed:
            row["id"] = "fixture-" + digest(row["canonical_name"].encode())[:16]
            row["status"] = "approved"
        write_json(taxonomy_path, sorted(seed, key=lambda row: row["canonical_name"].casefold()))
    manifest = []
    for case in definitions():
        identifier = case["id"]
        source = "\n".join(case["left"] + [""] + case["right"]) + "\n"
        for skill in case["skills"] + case["negative_skills"]:
            if skill["quote"] not in source:
                raise ValueError("Gold evidence not in authored source: " + identifier)
        document = text_pdf(case)
        if case["category"] == "scanned":
            document = scan_pdf(document)
        (destination / "documents" / (identifier + ".pdf")).write_bytes(document)
        (destination / "sources" / (identifier + ".txt")).write_text(source, encoding="utf-8")
        labels = {key: case[key] for key in ["fields", "skills", "employment", "negative_skills"]}
        labels.update(resume_id=identifier, annotation_version="1",
                      review_status="authored", source_text_sha256=digest(source.encode()))
        write_json(destination / "labels" / (identifier + ".json"), labels)
        manifest.append({
            "resume_id": identifier, "group_id": case["group_id"], "split": case["split"],
            "category": case["category"], "dataset_version": VERSION,
            "pdf": "documents/" + identifier + ".pdf", "labels": "labels/" + identifier + ".json",
            "source_text": "sources/" + identifier + ".txt", "sha256": digest(document),
            "page_count": 1, "source": "locally authored synthetic fixture",
            "permission": "synthetic", "contains_real_person_data": False,
        })
    (destination / "manifest.jsonl").write_text(
        "".join(json.dumps(row, sort_keys=True) + "\n" for row in manifest), encoding="utf-8")
    print("Built " + str(len(manifest)) + " synthetic fixtures at " + str(destination))


if __name__ == "__main__":
    command = argparse.ArgumentParser(description=__doc__)
    command.add_argument("--dataset", type=Path, default=DATASET)
    build(command.parse_args().dataset)
