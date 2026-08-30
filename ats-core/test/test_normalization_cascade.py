import pytest
from ats_core.parsers.normalization_cascade import (
    resolve_skill,
    resolve_skills_batch,
    SkillEmbeddingsIndex,
)
from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService


def test_layer1_exact_alias_resolution():
    """
    Verify Layer 1 resolves exact aliases with 1.0 confidence.
    """
    rec_k8s, conf_k8s, layer_k8s = resolve_skill("k8s")
    assert conf_k8s == 1.0
    assert layer_k8s == "layer1_exact"
    assert rec_k8s["canonical_name"] == "Kubernetes"

    rec_pg, conf_pg, layer_pg = resolve_skill("postgres")
    assert conf_pg == 1.0
    assert layer_pg == "layer1_exact"
    assert rec_pg["canonical_name"] == "PostgreSQL"


def test_layer2_fuzzy_match_typo_resolution():
    """
    Verify Layer 2 resolves typos (>3 chars) with 0.9 confidence.
    """
    rec_js, conf_js, layer_js = resolve_skill("javascrpt")
    assert conf_js == 0.9
    assert layer_js == "layer2_fuzzy"
    assert rec_js["canonical_name"] == "JavaScript"

    rec_doc, conf_doc, layer_doc = resolve_skill("dockerr")
    assert conf_doc == 0.9
    assert layer_doc == "layer2_fuzzy"
    assert rec_doc["canonical_name"] == "Docker"


def test_layer3_embedding_similarity_resolution():
    """
    Verify Layer 3 resolves semantic paraphrases using dense embeddings and margin checks.
    """
    embeddings_index = SkillEmbeddingsIndex.get_instance()
    
    # Test semantic paraphrase
    rec_sys, conf_sys, layer_sys = resolve_skill(
        "distributed systems design",
        embeddings_index=embeddings_index,
        register_pending=False
    )
    assert rec_sys is not None
    assert rec_sys.get("canonical_name") == "System Design"
    assert conf_sys == 0.7
    assert layer_sys == "layer3_embedding"


def test_layer4_unmapped_flywheel_fallback():
    """
    Verify Layer 4 unresolved novel tokens enter pending flywheel queue with 0.4 confidence.
    """
    taxonomy = SkillTaxonomyService.get_instance()
    novel_skill_name = "SuperNicheInternalPipelineToolV99"

    rec_pending, conf_pending, layer_pending = resolve_skill(
        novel_skill_name,
        taxonomy_service=taxonomy,
        register_pending=True
    )

    assert conf_pending == 0.4
    assert layer_pending == "layer4_pending"
    assert rec_pending["status"] == "pending"
    assert rec_pending["canonical_name"] == novel_skill_name


def test_resolve_skills_batch():
    """
    Verify batch resolution across multiple cascade layers.
    """
    batch = ["k8s", "javascrpt", "Python", "SuperNovelToolX"]
    results = resolve_skills_batch(batch, register_pending=True)

    assert len(results) >= 4
    resolved_names = [r["canonical_name"] for r in results]
    assert "Kubernetes" in resolved_names
    assert "JavaScript" in resolved_names
    assert "Python" in resolved_names
