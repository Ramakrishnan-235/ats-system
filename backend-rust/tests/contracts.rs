use ats_backend::{auth::Identity, hash, jobs::AIResult};
use serde_json::json;
use uuid::Uuid;

#[test]
fn nested_profile_and_notes_remain_masked_after_manual_edits() {
    let mut profile = json!({"id":"12345678-1234-1234-1234-123456789012","experience":[{"description":"Call Jane Candidate at jane@example.test or +91 98765 43210"}],"notes":["JANE CANDIDATE lives in Chennai"],"core_skills":["Python"]});
    ats_backend::domain::redact_profile(
        &mut profile,
        &json!({"name":"Jane Candidate","email":"jane@example.test","phone":"+91 98765 43210","location":"Chennai"}),
    );
    let serialized = profile.to_string().to_lowercase();
    for secret in ["jane candidate", "jane@example.test", "98765", "chennai"] {
        assert!(!serialized.contains(secret));
    }
    assert_eq!(profile["core_skills"][0], "Python");
    assert_eq!(profile["id"], "12345678-1234-1234-1234-123456789012");
}

fn result() -> serde_json::Value {
    json!({"contract_version":1,"attempt_id":Uuid::new_v4(),"document_id":Uuid::new_v4(),"document_version":1,"input_revision":1,"job_revision":null,"extraction_status":"COMPLETED","evaluation_status":"SKIPPED","profile":{},"contact":{},"sanitized_text":"Python developer","error_code":null})
}
#[test]
fn vector_version_and_dimensions_are_enforced() {
    let mut value = result();
    value["embedding"] = json!(vec![1.0; 384]);
    let parsed: AIResult = serde_json::from_value(value).unwrap();
    assert!(parsed.validate().is_err());
    let mut value = result();
    value["embedding"] = json!(vec![1.0; 768]);
    value["embedding_model"] = json!("old-model");
    value["preprocessing_version"] = json!("candidate-summary-v1");
    assert!(
        serde_json::from_value::<AIResult>(value)
            .unwrap()
            .validate()
            .is_err()
    );
}
#[test]
fn completed_evaluation_requires_real_score() {
    let mut v = result();
    v["evaluation_status"] = json!("COMPLETED");
    assert!(
        serde_json::from_value::<AIResult>(v.clone())
            .unwrap()
            .validate()
            .is_err()
    );
    v["scorecard"] = json!({"overall_match_score":101,"categories":[],"model_version":"test"});
    assert!(
        serde_json::from_value::<AIResult>(v)
            .unwrap()
            .validate()
            .is_err()
    );
    let mut v = result();
    v["evaluation_status"] = json!("COMPLETED");
    v["scorecard"] = json!({"overall_match_score":50,"categories":[],"model_version":"test"});
    assert!(
        serde_json::from_value::<AIResult>(v)
            .unwrap()
            .validate()
            .is_err()
    );
}
#[test]
fn unknown_contract_fields_are_rejected() {
    let mut v = result();
    v["tenant_id"] = json!(Uuid::new_v4());
    assert!(serde_json::from_value::<AIResult>(v).is_err());
}
#[test]
fn safe_errors_cannot_contain_resume_text() {
    let mut v = result();
    v["error_code"] = json!("John Smith john@example.com");
    assert!(
        serde_json::from_value::<AIResult>(v)
            .unwrap()
            .validate()
            .is_err()
    );
}
#[test]
fn viewer_cannot_mutate_or_reveal_pii() {
    let viewer = Identity {
        user_id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        role: "viewer".into(),
        name: "Viewer".into(),
        email: "viewer@example.test".into(),
    };
    assert!(viewer.write().is_err());
    assert!(viewer.pii().is_err());
    assert!(viewer.admin().is_err());
}
#[test]
fn session_hash_is_stable_and_not_the_token() {
    let token = "random-session-token";
    assert_eq!(hash(token.as_bytes()), hash(token.as_bytes()));
    assert_ne!(hash(token.as_bytes()), token);
    assert_eq!(hash(token.as_bytes()).len(), 64);
}

#[test]
fn public_contract_exposes_business_routes_and_cookie_identity() {
    let document = ats_backend::openapi::document();
    assert_eq!(
        document["components"]["securitySchemes"]["session"]["name"],
        "ats_session"
    );
    for path in [
        "/api/v1/jobs",
        "/api/v1/candidates/upload-async",
        "/api/v1/migration/import",
        "/api/v1/analytics",
        "/api/v1/submissions",
    ] {
        assert!(document["paths"].get(path).is_some());
    }
    assert!(
        document["paths"]
            .get("/internal/jobs/{id}/result")
            .is_none()
    );
}
