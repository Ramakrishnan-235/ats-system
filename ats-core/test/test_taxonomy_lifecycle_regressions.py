"""Resolution indexes must follow administrative taxonomy changes."""

from ats_core.taxonomy.taxonomy_service import SkillTaxonomyService


def test_rejected_approved_skill_stops_resolving_by_every_alias():
    service = SkillTaxonomyService()
    record = service.lookup_skill("Kubernetes")
    service.reject_skill(record["id"])
    assert service.get_skill_by_id(record["id"])["status"] == "rejected"
    assert service.get_skill_by_canonical("Kubernetes") is None
    assert service.lookup_skill("Kubernetes") is None
    assert service.lookup_skill("k8s") is None


def test_renaming_skill_retargets_existing_aliases_and_removes_stale_keys():
    service = SkillTaxonomyService()
    pending = service.record_unknown_skill("QzxCustomTool")
    service.approve_skill(pending["id"], aliases=["qzxtool"])
    updated = service.approve_skill(pending["id"], canonical_name="ReplacementEngine", aliases=["replacement"])
    assert service.lookup_skill("qzxtool")["id"] == pending["id"]
    assert service.lookup_skill("qzxtool")["canonical_name"] == "ReplacementEngine"
    assert service.lookup_skill("replacement")["id"] == pending["id"]
    assert service.get_skill_by_canonical("QzxCustomTool") is None
    assert service._alias_index["qzxcustomtool"] == "ReplacementEngine"
    assert updated["aliases"] == ["qzxcustomtool", "qzxtool", "replacement"]


def test_reapproval_restores_indexes_after_rejection():
    service = SkillTaxonomyService()
    record = service.lookup_skill("Docker")
    service.reject_skill(record["id"])
    service.approve_skill(record["id"])
    assert service.lookup_skill("Docker")["id"] == record["id"]
