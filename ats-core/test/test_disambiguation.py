import pytest
import spacy
from ats_core.parsers.disambiguation import is_valid_mention
from ats_core.parsers.skill_matcher import SkillMatcher


def test_go_disambiguation_false_positives_eliminated():
    """
    Verify 'Go' is rejected in common English phrases like 'go-to-market',
    'go live', 'going forward', but accepted in programming contexts.
    """
    matcher = SkillMatcher.get_instance()

    # 1. False positive cases: should NOT match Go
    fp_text_1 = "Spearheaded the enterprise go-to-market strategy for cloud SaaS product."
    fp_text_2 = "Managed product launches to go live ahead of schedule."
    fp_text_3 = "Ensured all operations were going smoothly before deciding to go through audit."

    assert "Go" not in matcher.extract_canonical_skills(fp_text_1)
    assert "Go" not in matcher.extract_canonical_skills(fp_text_2)
    assert "Go" not in matcher.extract_canonical_skills(fp_text_3)

    # 2. True positive cases: SHOULD match Go
    tp_text_1 = "Senior backend engineer developing microservices in Go and Python."
    tp_text_2 = "Built high-throughput gRPC services using Golang and Docker."
    tp_text_3 = "Languages: Rust, Go, C++, TypeScript"

    assert "Go" in matcher.extract_canonical_skills(tp_text_1)
    assert "Go" in matcher.extract_canonical_skills(tp_text_2)
    assert "Go" in matcher.extract_canonical_skills(tp_text_3)


def test_r_disambiguation_middle_initials_eliminated():
    """
    Verify single-letter 'R' rejects middle initials and bullets,
    but matches statistical programming contexts.
    """
    matcher = SkillMatcher.get_instance()

    # 1. False positives: Middle initials / name parts
    fp_text_1 = "John R. Smith — Senior Project Manager"
    fp_text_2 = "Deva R. Kumar, Bengaluru, India"

    assert "R" not in matcher.extract_canonical_skills(fp_text_1)
    assert "R" not in matcher.extract_canonical_skills(fp_text_2)

    # 2. True positives: Data science / statistical contexts
    tp_text_1 = "Conducted regression analysis in Python, R, and SQL."
    tp_text_2 = "Proficient in R programming using tidyverse, ggplot2, and RStudio."
    tp_text_3 = "Skills: Python, R, SAS, Matlab"

    assert "R" in matcher.extract_canonical_skills(tp_text_1)
    assert "R" in matcher.extract_canonical_skills(tp_text_2)
    assert "R" in matcher.extract_canonical_skills(tp_text_3)


def test_c_disambiguation():
    """
    Verify single-letter 'C' rejects grades/sections,
    but matches C programming language contexts.
    """
    matcher = SkillMatcher.get_instance()

    # 1. False positive: Grade C / Section C
    fp_text_1 = "Graduated with Grade C in introductory mechanics."
    fp_text_2 = "Completed Phase C of system deployment."

    assert "C" not in matcher.extract_canonical_skills(fp_text_1)
    assert "C" not in matcher.extract_canonical_skills(fp_text_2)

    # 2. True positive: C programming
    tp_text_1 = "Developed low-level embedded drivers in C and Assembly."
    tp_text_2 = "Languages: C, C++, Rust, Python"

    c_skills = matcher.extract_canonical_skills(tp_text_1)
    assert "C" in c_skills

    c_skills_2 = matcher.extract_canonical_skills(tp_text_2)
    assert "C" in c_skills_2
    assert "C++" in c_skills_2


def test_cv_disambiguation():
    """
    Verify 'CV' is rejected when referring to Curriculum Vitae / resume file,
    but accepted when referring to Computer Vision.
    """
    matcher = SkillMatcher.get_instance()

    # 1. False positive: Resume / CV
    fp_text_1 = "Please review my updated CV and portfolio."
    fp_text_2 = "Ramakrishnan_CV_2026.pdf"

    skills_fp1 = matcher.extract_canonical_skills(fp_text_1)
    assert "Computer Vision" not in skills_fp1

    # 2. True positive: Computer Vision
    tp_text_1 = "Trained deep learning models for Computer Vision and object detection using OpenCV and PyTorch."
    tp_text_2 = "Specialized in CV algorithms, YOLO, and CNN architectures."

    skills_tp1 = matcher.extract_canonical_skills(tp_text_1)
    assert "Computer Vision" in skills_tp1
    assert "OpenCV" in skills_tp1

    skills_tp2 = matcher.extract_canonical_skills(tp_text_2)
    assert "Computer Vision" in skills_tp2


def test_is_valid_mention_direct_function():
    """Directly test is_valid_mention helper function."""
    nlp = spacy.blank("en")
    
    # Ambiguous Row for Go
    go_row = {
        "canonical_name": "Go",
        "is_ambiguous": True,
    }

    doc_fp = nlp.make_doc("We launched a new go-to-market strategy.")
    # 'go' is token 4
    assert is_valid_mention(go_row, doc_fp, 4, 5) is False

    doc_tp = nlp.make_doc("Skilled in Python, Go, and Kubernetes.")
    # 'Go' is token 3
    assert is_valid_mention(go_row, doc_tp, 3, 4) is True
