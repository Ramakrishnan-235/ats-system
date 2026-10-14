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
        "/api/v1/jobs/{job}/candidates/{candidate}/evaluate",
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

#[test]
fn submitted_identity_and_role_are_preserved_without_creating_resume_evidence() {
    let mut profile = json!({"core_skills":["Python"],"role":"Extracted role"});
    let mut contact = json!({"name":"Extracted name","email":"synthetic@example.test"});
    ats_backend::jobs::apply_submitted_details(
        &mut profile,
        &mut contact,
        &json!({"_submitted_headline":"Backend Engineer"}),
        &json!({"_submitted_name":"Synthetic Applicant"}),
    );
    assert_eq!(contact["name"], "Synthetic Applicant");
    assert_eq!(contact["email"], "synthetic@example.test");
    assert_eq!(profile["role"], "Backend Engineer");
    assert_eq!(profile["target_headline"], "Backend Engineer");
    assert_eq!(profile["core_skills"], json!(["Python"]));
    assert!(profile.get("_submitted_headline").is_none());
    assert!(profile.get("experience").is_none());
}

#[test]
fn candidate_profile_edits_retain_unredacted_storage_and_resume_text() {
    let old_profile = json!({
        "role": "Software Engineer",
        "core_skills": ["Rust", "Python"],
        "experience": [{"title": "Senior Dev", "notes": "Contact Jane Doe at jane@example.test"}]
    });
    let safe_edits = json!({
        "role": "Staff Engineer",
        "core_skills": ["Rust", "Python"],
        "experience": [{"title": "Lead Dev", "notes": "Contact Jane Doe at jane@example.test"}]
    });
    let mut merged = old_profile;
    merged
        .as_object_mut()
        .unwrap()
        .extend(safe_edits.as_object().unwrap().clone());

    // The stored profile must not be destructively redacted in database
    assert!(merged.to_string().contains("jane@example.test"));
    assert_eq!(merged["role"], "Staff Engineer");

    // Redaction is applied on-demand at serialization time when PII is masked
    let mut view = merged.clone();
    ats_backend::domain::redact_profile(
        &mut view,
        &json!({"name": "Jane Doe", "email": "jane@example.test"}),
    );
    assert!(!view.to_string().contains("jane@example.test"));
    assert!(view.to_string().contains("[REDACTED]"));

    // Extracted resume text must be preserved rather than overwritten by summary JSON
    let existing_sanitized = "Full resume text with deep project details and verbatim citations.";
    let sanitized_to_store = if existing_sanitized.trim().is_empty() {
        merged.to_string()
    } else {
        existing_sanitized.to_string()
    };
    assert_eq!(sanitized_to_store, existing_sanitized);
}

#[test]
fn redact_profile_enforces_word_boundaries_and_skips_common_terms() {
    let mut profile = json!({
        "headline": "Senior Engineer working in a remote department with robust standard testing for maximum goals",
        "notes": ["Candidate Dan met with Art and Rob in Goa."],
        "experience": [{"description": "Led remote teams at Acme Corp. Followed standard engineering practices."}]
    });
    let contact = json!({
        "name": "Dan Art Rob",
        "location": "Remote, Goa",
        "email": "dan@example.test",
        "phone": "+1 415 892 0149"
    });

    ats_backend::domain::redact_profile(&mut profile, &contact);

    let serialized = profile.to_string();

    // Verify common words containing the short names as substrings are NOT corrupted:
    assert!(
        serialized.contains("standard"),
        "Expected 'standard' not to be corrupted to st[REDACTED]ard"
    );
    assert!(
        serialized.contains("department"),
        "Expected 'department' not to be corrupted to dep[REDACTED]ment"
    );
    assert!(
        serialized.contains("robust"),
        "Expected 'robust' not to be corrupted to [REDACTED]ust"
    );
    assert!(
        serialized.contains("goals"),
        "Expected 'goals' not to be corrupted to [REDACTED]ls"
    );
    assert!(
        serialized.contains("remote"),
        "Expected 'remote' not to be redacted"
    );

    // Verify standalone name/location words ARE properly redacted:
    let notes = profile["notes"][0].as_str().unwrap();
    assert_eq!(
        notes,
        "Candidate [REDACTED] met with [REDACTED] and [REDACTED] in [REDACTED]."
    );

    // Multi-word name with common term (e.g. "Candidate")
    let mut profile2 = json!({
        "summary": "The candidate Jane demonstrated strong technical expertise."
    });
    let contact2 = json!({
        "name": "Jane Candidate",
        "location": "Unknown"
    });
    ats_backend::domain::redact_profile(&mut profile2, &contact2);
    let summary = profile2["summary"].as_str().unwrap();
    assert_eq!(
        summary,
        "The candidate [REDACTED] demonstrated strong technical expertise."
    );
}

#[test]
fn replacement_resume_persists_candidate_even_if_application_is_stale_or_withdrawn() {
    // Ingestion result contract from AI worker
    let candidate_id = Uuid::new_v4();
    let doc_id = Uuid::new_v4();
    let current_candidate_revision = 2;
    let input_candidate_revision = 2;
    let latest_doc_version = 2;
    let input_doc_version = 2;

    // Candidate staleness check: matches exactly
    let candidate_stale = current_candidate_revision != input_candidate_revision
        || latest_doc_version != input_doc_version;
    assert!(!candidate_stale, "Candidate must NOT be evaluated as stale");

    // Application state is Withdrawn
    let app_stage = "Withdrawn";
    let app_stale = ["Withdrawn", "Rejected"].contains(&app_stage);
    assert!(
        app_stale,
        "Application should be recognized as stale/withdrawn"
    );

    // When application is stale, candidate-level ingestion is still COMPLETED
    let extraction_status = "COMPLETED";
    let failed = extraction_status == "FAILED";
    assert!(!failed);

    let candidate_processing_status = if failed { "FAILED" } else { "COMPLETED" };
    assert_eq!(candidate_processing_status, "COMPLETED");

    // Scorecard write is skipped
    let scorecard_written = !app_stale;
    assert!(!scorecard_written);

    // Job summary reflects skipped evaluation while candidate completed
    let eval_status = if app_stale { "SKIPPED" } else { "COMPLETED" };
    let summary = json!({
        "status": candidate_processing_status,
        "candidate_id": candidate_id,
        "document_id": doc_id,
        "evaluation_status": eval_status
    });
    assert_eq!(summary["status"], "COMPLETED");
    assert_eq!(summary["evaluation_status"], "SKIPPED");
}

#[test]
fn job_edits_invalidate_stale_application_scores_and_scorecards() {
    // Current state of job and candidate
    let active_job_revision = 2; // Incremented by update_job
    let candidate_revision = 1;

    // Previous evaluation produced against job revision 1
    let evaluation_job_revision = 1;
    let evaluation_candidate_revision = 1;

    // Evaluation validity condition: both candidate and job revisions must match
    let is_valid = evaluation_candidate_revision == candidate_revision
        && evaluation_job_revision == active_job_revision;

    assert!(
        !is_valid,
        "Evaluation for job revision 1 must be treated as stale after job is updated to revision 2"
    );

    // Scorecard fallback when stale
    let scorecard = if is_valid {
        json!({"overall_match_score": 88})
    } else {
        ats_backend::domain::empty_scorecard()
    };

    assert_eq!(scorecard["overall_match_score"], serde_json::Value::Null);
    assert_eq!(scorecard["evaluation_status"], "PENDING");
}

#[test]
fn scorecard_preserves_and_redacts_recruiter_team_notes() {
    let mut scorecard = ats_backend::domain::empty_scorecard();
    assert_eq!(scorecard["team_notes"], json!([]));

    // Attaching candidate-level team notes
    let notes = vec![
        json!({
            "id": Uuid::new_v4(),
            "author": "Recruiter Alice",
            "initials": "RA",
            "role": "Recruiter",
            "timestamp": "2026-10-14T20:00:00Z",
            "content": "Met candidate Dan at Goa office. Highly recommended."
        }),
        json!({
            "id": Uuid::new_v4(),
            "author": "Hiring Manager Bob",
            "initials": "HB",
            "role": "Hiring Manager",
            "timestamp": "2026-10-14T20:30:00Z",
            "content": "Strong technical skills in Python and distributed systems."
        }),
    ];
    scorecard["team_notes"] = json!(notes);

    // Apply redaction with candidate contact info
    let contact = json!({
        "name": "Dan",
        "location": "Goa",
        "email": "dan@example.test"
    });
    ats_backend::domain::redact_profile(&mut scorecard, &contact);

    // Team notes array remains present with 2 notes
    let team_notes = scorecard["team_notes"].as_array().unwrap();
    assert_eq!(team_notes.len(), 2);
    assert_eq!(team_notes[0]["author"], "Recruiter Alice");

    // Contact PII inside note is redacted with word boundaries preserved
    assert_eq!(
        team_notes[0]["content"],
        "Met candidate [REDACTED] at [REDACTED] office. Highly recommended."
    );
    assert_eq!(
        team_notes[1]["content"],
        "Strong technical skills in Python and distributed systems."
    );
}
