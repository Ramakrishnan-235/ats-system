"""Offline regressions for redaction before residue model access."""

from types import SimpleNamespace
from unittest.mock import Mock, PropertyMock, patch

import pytest

from ats_core.parsers import llm_residue_extractor as residue


@pytest.fixture
def extractor(monkeypatch):
    # No taxonomy writes, external clients, NLP models or model downloads.
    monkeypatch.setattr(residue.SkillTaxonomyService, "get_instance", lambda: SimpleNamespace())
    return residue.LLMResidueExtractor(model_name="offline-test")


@pytest.mark.parametrize("redacted", [None, "", "   "])
def test_empty_redaction_never_accesses_llm_client(extractor, monkeypatch, redacted):
    monkeypatch.setattr(extractor, "_redact_for_llm", lambda text: redacted)
    fallback = Mock(return_value=[residue.LLMResidueSkill(name="ChromaDB", evidence="Built ChromaDB search")])
    monkeypatch.setattr(extractor, "_fallback_rule_residue", fallback)
    source = "Jane Doe jane@example.com\nBuilt ChromaDB search"
    with patch.object(residue.LLMResidueExtractor, "client", new_callable=PropertyMock) as client:
        result = extractor.extract_residue_skills(source, [], register_flywheel=False)
        client.assert_not_called()
    fallback.assert_called_once_with(source, [])
    assert [item["name"] for item in result] == ["ChromaDB"]


def test_redactor_failure_never_accesses_llm_client(extractor, monkeypatch):
    monkeypatch.setattr(extractor, "_redact_for_llm", Mock(side_effect=RuntimeError("NLP unavailable")))
    fallback = Mock(return_value=[])
    monkeypatch.setattr(extractor, "_fallback_rule_residue", fallback)
    with patch.object(residue.LLMResidueExtractor, "client", new_callable=PropertyMock) as client:
        assert extractor.extract_residue_skills("Jane Doe jane@example.com", [], register_flywheel=False) == []
        client.assert_not_called()
    fallback.assert_called_once()


def test_llm_receives_redacted_resume_and_evidence_is_checked_against_original(extractor, monkeypatch):
    source = "Jane Doe jane@example.com\nBuilt ChromaDB search"
    redacted = "[CANDIDATE_NAME] [EMAIL_ADDRESS]\nBuilt ChromaDB search"
    redactor = Mock(return_value=redacted)
    monkeypatch.setattr(extractor, "_redact_for_llm", redactor)
    create = Mock(return_value=residue.LLMResidueOutput(new_skills=[
        residue.LLMResidueSkill(name="ChromaDB", evidence="Built ChromaDB search"),
        residue.LLMResidueSkill(name="Fabricated", evidence="[CANDIDATE_NAME]"),
    ]))
    extractor._client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    result = extractor.extract_residue_skills(source, [], register_flywheel=False)
    redactor.assert_called_once_with(source)
    create.assert_called_once()
    sent_prompt = create.call_args.kwargs["messages"][1]["content"]
    assert redacted in sent_prompt
    assert "Jane Doe" not in sent_prompt
    assert "jane@example.com" not in sent_prompt
    assert [item["name"] for item in result] == ["ChromaDB"]
    assert result[0]["evidence"] in source


@pytest.mark.parametrize("url", [
    "https://linkedin.com/in/jane-doe",
    "www.example.com/jane",
    "linkedin.com/in/jane-doe",
    "github.com/jane-doe",
])
def test_residue_redaction_also_masks_explicit_profile_urls(extractor, url):
    extractor._anonymizer = SimpleNamespace(anonymize=lambda text: text.replace("Jane Doe", "[CANDIDATE_NAME]"))
    result = extractor._redact_for_llm(f"Jane Doe\n{url}\nBuilt ChromaDB search")
    assert "Jane Doe" not in result
    assert url not in result
    assert "[PROFILE_URL]" in result
    assert "Built ChromaDB search" in result
