import pytest
from ats_core.parsers.employer_normalizer import normalize_employer


def test_normalize_top_tech_employers():
    """
    Verify top tech company aliases resolve to standardized canonical names.
    """
    assert normalize_employer("Alphabet") == "Google"
    assert normalize_employer("Google LLC") == "Google"
    assert normalize_employer("Meta Platforms, Inc.") == "Meta"
    assert normalize_employer("Facebook") == "Meta"
    assert normalize_employer("Amazon Web Services (AWS)") == "Amazon"
    assert normalize_employer("Microsoft Corporation") == "Microsoft"
    assert normalize_employer("Netflix Inc.") == "Netflix"
    assert normalize_employer("Uber Technologies Inc") == "Uber"
    assert normalize_employer("ByteDance Ltd") == "ByteDance"


def test_strip_legal_suffixes():
    """
    Verify corporate legal suffixes are cleanly stripped from unknown companies.
    """
    assert normalize_employer("Acme Systems LLC") == "Acme Systems"
    assert normalize_employer("TechNova Solutions Pvt. Ltd.") == "TechNova"
    assert normalize_employer("Starlight Global GmbH") == "Starlight Global"
    assert normalize_employer("DataWave Technologies Corp.") == "DataWave"
