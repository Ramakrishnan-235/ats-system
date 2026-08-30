"""
disambiguation.py
Step 4: Disambiguation (The Ambiguity Rules).

Gives deterministic context rules for short, single-letter, or polysemous technical skill names
(e.g., 'R', 'Go', 'C', 'CV', 'CD', 'CI', 'AI') to eliminate false positives
(such as 'go-to-market strategy', 'Deva_CV.pdf', or middle initials).
"""

import re
from typing import Dict, Any, Optional
import spacy


def is_valid_mention(row: Dict[str, Any], doc: spacy.tokens.Doc, tok_start: int, tok_end: int) -> bool:
    """
    Evaluates whether a phrase match in `doc[tok_start:tok_end]` is a valid technical skill mention
    or a non-technical false positive.
    
    Checks short tokens (len <= 3) and rows marked is_ambiguous=True against surrounding context (+- 6 tokens).
    """
    surface = doc[tok_start:tok_end].text.strip()
    surface_lower = surface.lower()

    if not row.get("is_ambiguous", False) and len(surface) > 3:
        return True

    # Context window: +- 6 tokens
    win_start = max(0, tok_start - 6)
    win_end = min(len(doc), tok_end + 6)
    window_doc = doc[win_start:win_end]
    window_text = window_doc.text.lower()
    window_raw = window_doc.text

    canonical = row.get("canonical_name", "").lower()

    # =========================================================================
    # 1. R (Programming Language)
    # =========================================================================
    if surface_lower == "r" or canonical == "r":
        # Reject middle initials (e.g. "Deva R. Kumar", "John R.")
        if re.search(r"\b[A-Z][a-z]+\s+R\.?\s+[A-Z][a-z]+\b", window_raw):
            return False
        # Reject bullet points like "R." or numbered list items
        if re.search(r"^\s*R\.\s*", window_raw):
            return False
        # Valid if adjacent to other data/stats/tech tokens or preceded by in/using/with/languages:
        return bool(re.search(
            r"\b(?:python|sql|sas|matlab|scala|stata|excel|spss|julia|tableau|power\s*bi|statistics|stats|data\s*science|machine\s*learning|tidyverse|ggplot2|rstudio|shiny)[,/ ]+r\b"
            r"|\br[,/ ]+(?:python|sql|sas|matlab|scala|stata|excel|spss|julia|tableau)\b"
            r"|\b(?:in|using|with|proficient\s+in|languages?|technologies?|skills?)\s*[:\-]?\s*r\b"
            r"|\br\s+(?:programming|scripting|package|packages|developer|analyst)\b",
            window_text
        ))

    # =========================================================================
    # 2. Go / Golang
    # =========================================================================
    if surface_lower == "go" or canonical == "go":
        if "golang" in window_text:
            return True
        # Reject common verb-y / phrase contexts
        if re.search(r"\bgo[- ]to\b|\bgoing\b|\bgo(es)?\s+(?:to|through|live|ahead|forward|beyond|back|on|out|over)\b|\bgo-live\b|\bgo\s+to\s+market\b|\blet'?s\s+go\b|\bon\s+the\s+go\b", window_text):
            return False
        # Valid if paired with languages, developer/engineer titles, or programming context
        return bool(re.search(
            r"\b(?:go|golang)\b\s*(?:developer|engineer|lang|language|backend|microservices?|routine|routines|concurrency|gin|fiber|echo|gorm|grpc)\b"
            r"|\b(?:rust|python|java|c\+\+|c#|node|nodejs|typescript|sql|docker|kubernetes|k8s)\b[,/ ]+go\b"
            r"|\bgo\b[,/ ]+(?:rust|python|java|c\+\+|c#|node|nodejs|typescript|sql)\b"
            r"|\b(?:in|using|with|proficient\s+in|languages?|technologies?|skills?)\s*[:\-]?\s*go\b",
            window_text
        ))

    # =========================================================================
    # 3. C (Programming Language)
    # =========================================================================
    if surface_lower == "c" and canonical == "c":
        # Longest-match-first already handles C++, C#, C-Suite, etc.
        # Reject Grade C, Section C, Phase C, Vitamin C, Appendix C, 100 C (temperature)
        if re.search(r"\b(?:grade|section|phase|appendix|vitamin|table|class|tier|type)\s+c\b|\b\d+\s*c\b", window_text):
            return False
        # Valid if programming/embedded language context
        return bool(re.search(
            r"\bc\s*[/,]\s*(?:c\+\+|cpp|c#|python|assembly|java|embedded|linux|rust)\b"
            r"|\b(?:c\+\+|cpp|c#|python|assembly|java|embedded|linux|rust)\s*[/,]\s*c\b"
            r"|\bc\s+(?:programming|language|developer|engineer|compiler|embedded|pointer|pointers|memory)\b"
            r"|\b(?:in|using|with|proficient\s+in|languages?|technologies?|skills?)\s*[:\-]?\s*c\b",
            window_text
        ))

    # =========================================================================
    # 4. CV (Computer Vision vs Curriculum Vitae)
    # =========================================================================
    if surface_lower == "cv" or canonical == "computer vision":
        # If in header or filename (e.g. "Deva_CV.pdf", "My CV", "Resume/CV"), reject as skill
        if re.search(r"\b(?:curriculum\s+vitae|resume|pdf|doc|docx|profile|download|updated)\b", window_text):
            return False
        # Valid if computer vision / AI context
        return bool(re.search(
            r"\b(?:computer\s+vision|opencv|cv2|image|images|video|detection|segmentation|yolo|cnn|ocr|deep\s+learning|ai|ml|pytorch|tensorflow|vision)\b",
            window_text
        ))

    # =========================================================================
    # 5. CI / CD (Continuous Integration / Continuous Deployment)
    # =========================================================================
    if surface_lower in ("ci", "cd") or canonical == "ci/cd":
        # Reject CD as compact disc or certificate of deposit
        if re.search(r"\b(?:music|audio|compact\s+disc|deposit|bank)\b", window_text):
            return False
        # Valid if DevOps / pipeline / automation context
        return bool(re.search(
            r"\b(?:ci\s*[/,-]\s*cd|continuous|pipeline|pipelines|jenkins|github\s+actions|gitlab|devops|deploy|deployment|integration|automation|docker|kubernetes)\b",
            window_text
        ))

    # =========================================================================
    # 6. AI (Artificial Intelligence vs Name "Ai")
    # =========================================================================
    if surface_lower == "ai" or canonical in ("artificial intelligence", "ai"):
        # Reject names or abbreviations like "Ai Weiwei" or "al."
        if re.search(r"\b(?:et\s+al|mr|ms|dr)\b", window_text):
            return False
        return bool(re.search(
            r"\b(?:ai|artificial\s+intelligence|ml|machine\s+learning|deep\s+learning|llm|llms|generative|genai|prompt|model|models|neural|gpt|nlp|vision)\b",
            window_text
        ))

    # =========================================================================
    # 7. UI / UX
    # =========================================================================
    if surface_lower in ("ui", "ux") or canonical == "ui/ux":
        return bool(re.search(
            r"\b(?:ui\s*[/,-]\s*ux|user\s+interface|user\s+experience|figma|design|designer|wireframe|prototype|frontend|css|react|tailwind|usability)\b",
            window_text
        ))

    # =========================================================================
    # 8. Git
    # =========================================================================
    if surface_lower == "git" or canonical == "git":
        return bool(re.search(
            r"\b(?:git|github|gitlab|bitbucket|version\s+control|commit|branch|merge|repo|repository|rebase)\b",
            window_text
        ))

    # Default fallback: allow other ambiguous skills
    return True
