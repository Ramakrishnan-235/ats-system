"""Regressions reproduced by the ten-resume live audit, without provider traffic."""
import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from langchain_core.runnables import RunnableLambda
from pydantic import ValidationError

from ats_core.ai_api.evaluation import VerifiedReport
from ats_core.llm.deadline import invoke_with_deadline


def report(**changes):
    return {"overall_match_score": 40, "executive_verdict": "Insufficient backend evidence.",
            "screening_decision": "REVIEW", "decision_explanation": "Python is listed, but backend experience is not evidenced in this resume.",
            "criteria_breakdown": [{"category": "Tech Stack Alignment", "score": 2,
                                    "assessment": "Python is listed."}], **changes}


def test_bullet_strings_are_normalized_without_fabricating_scores():
    parsed = VerifiedReport.model_validate(report(
        key_strengths="- Python\n- SQL", risks_and_skill_gaps="No API experience",
        suggested_improvements='["Build an API", "Add tests"]',
    ))
    assert parsed.overall_match_score == 40
    assert parsed.key_strengths == ["Python", "SQL"]
    assert parsed.risks_and_skill_gaps == ["No API experience"]
    assert parsed.suggested_improvements == ["Build an API", "Add tests"]
    for value in (None, "40", float("nan")):
        with pytest.raises(ValidationError):
            VerifiedReport.model_validate(report(overall_match_score=value))


def test_deadline_cancels_live_response_and_worker_loop_remains_usable():
    stopped = []

    class Response:
        async def ainvoke(self, value, config=None):
            if value == "quick":
                return value
            try:
                while True:
                    await asyncio.sleep(0.001)  # provider keep-alive data
            finally:
                stopped.append(True)

    with pytest.raises(TimeoutError):
        invoke_with_deadline(Response(), "slow", timeout=0.02)
    assert stopped == [True]
    assert invoke_with_deadline(Response(), "quick", timeout=1) == "quick"


@pytest.fixture
def parser(monkeypatch):
    from ats_core.parsers import anonymizer
    from ats_core.parsers import llm_embedding_resume_parser as module
    text = "Alice Doe\nalice@sample.test\nBuilt APIs using Golang and React."
    monkeypatch.setattr(module._pdf_parser, "parse_pdf", lambda *a, **k: (text, "pymupdf"))
    monkeypatch.setattr(module, "get_llm_config", lambda: {
        "is_openrouter": True, "base_url": "https://openrouter.ai/api/v1", "model_name": "test"})
    model = Mock()
    monkeypatch.setattr(module, "get_openrouter_chat_model", model)
    monkeypatch.setattr(module, "get_structured_llm", lambda **k: RunnableLambda(lambda value: value))
    seen = []

    def redact(value, known_entities):
        seen.append(known_entities)
        return value.replace("Alice Doe", "[CANDIDATE_NAME]").replace("alice@sample.test", "[EMAIL_ADDRESS]")

    monkeypatch.setattr(anonymizer, "get_shared_anonymizer", lambda: SimpleNamespace(anonymize=redact))
    return module, seen, model


@pytest.mark.parametrize("timeout", [False, True])
def test_empty_or_timed_out_extraction_falls_back_before_embedding(parser, monkeypatch, timeout):
    from ats_core.parsers import resume_parser
    module, _, model = parser
    fallback = Mock(return_value={"name": "Alice Doe", "core_skills": ["Go"]})
    monkeypatch.setattr(resume_parser, "parse_resume_to_candidate", fallback)
    normalizer = Mock(side_effect=AssertionError("Missing extraction must not build embeddings"))
    monkeypatch.setattr(module, "EmbeddingGemmaSkillNormalizer", normalizer)

    def invoke(*a, **k):
        if timeout:
            raise TimeoutError()

    monkeypatch.setattr(module, "invoke_with_deadline", invoke)
    assert module.parse_resume_with_llm_and_embeddings(b"test", taxonomy_rows=[])['name'] == 'Alice Doe'
    assert fallback.call_args.kwargs['allow_llm'] is False
    assert fallback.call_args.kwargs['extracted_document'][1] == 'pymupdf'
    assert fallback.return_value['extraction_warnings'] == ['LLM_EXTRACTION_FALLBACK']
    assert model.call_args.kwargs['max_retries'] == 0
    assert model.call_args.kwargs['extra_body']['reasoning']['enabled'] is False
    normalizer.assert_not_called()


def test_local_contacts_override_redacted_model_fields(parser, monkeypatch):
    module, contacts, _ = parser
    extracted = module.FullLLMResumeExtraction(contact=module.LLMContactInfo(name="Candidate"))

    def invoke(chain, value, **kwargs):
        assert "Alice Doe" not in value['resume_markdown']
        assert "alice@sample.test" not in value['resume_markdown']
        return extracted

    monkeypatch.setattr(module, "invoke_with_deadline", invoke)
    monkeypatch.setattr(module, "EmbeddingGemmaSkillNormalizer", lambda **k:
                        SimpleNamespace(normalize_extracted_skills=lambda *a: ([], [])))
    profile = module.parse_resume_with_llm_and_embeddings(b"test", taxonomy_rows=[])
    assert profile['name'] == 'Alice Doe'
    assert profile['email'] == 'alice@sample.test'
    assert contacts[0]['name'] == 'Alice Doe'


def test_contacts_use_pdf_header_and_invisible_mailto_link():
    import pymupdf

    from ats_core.parsers.resume_parser import extract_contact_details

    with pymupdf.open() as pdf:
        page = pdf.new_page()
        page.insert_text((72, 72), 'Hari Prasad')
        page.insert_text((72, 90), 'Senior DevOps Lead')
        page.insert_link({'kind': pymupdf.LINK_URI,
                          'from': pymupdf.Rect(72, 100, 140, 120),
                          'uri': 'mailto:hari%40sample.test'})
        data = pdf.tobytes()
    # Document conversion can reorder the header after a social username.
    contact = extract_contact_details('Harrythedevopsguy\nSkills\nPython', 'resume.pdf', data)
    assert contact['name'] == 'Hari Prasad'
    assert contact['email'] == 'hari@sample.test'


def test_technical_entities_survive_ner_but_known_contacts_stay_private():
    from presidio_analyzer import RecognizerResult
    from presidio_anonymizer import AnonymizerEngine
    from presidio_anonymizer.entities import OperatorConfig

    from ats_core.parsers.anonymizer import ResumeAnonymizer
    masker = ResumeAnonymizer.__new__(ResumeAnonymizer)
    text = "Alice Doe built with Golang and React. alice@sample.test"
    masker.analyze = lambda **kwargs: [
        RecognizerResult(entity_type="LOCATION", start=text.index('Golang'), end=text.index('Golang') + 6, score=0.9),
        RecognizerResult(entity_type="PERSON", start=text.index('React'), end=text.index('React') + 5, score=0.9),
    ] if 'Golang' in kwargs['text'] else []
    masker.anonymizer = AnonymizerEngine()
    masker.operators = {"DEFAULT": OperatorConfig('replace', {'new_value': '[REDACTED]'})}
    result = masker.anonymize(text, known_entities={'name': 'Alice Doe', 'email': 'alice@sample.test'})
    assert 'Golang and React' in result
    assert 'Alice' not in result and '@' not in result
    assert 'React' not in masker.anonymize('React Lane uses Python', known_name='React Lane')
