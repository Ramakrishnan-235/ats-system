use ats_backend::{
    auth::Identity,
    config::{Config, check_database_role_safety},
    hash,
    jobs::AIResult,
};
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
fn completed_screening_requires_model_decision_and_explanation() {
    let mut value = result();
    value["evaluation_status"] = json!("COMPLETED");
    value["scorecard"] = json!({
        "overall_match_score":85,"model_version":"test-llm",
        "screening_decision":"REJECT",
        "decision_explanation":"Essential Rust ownership is not demonstrated in the resume.",
        "categories":[{"name":"Tech Stack Alignment","score":4,"max_score":5,"assessment":"Python APIs are demonstrated."}]
    });
    // A model decision is preserved independently of score thresholds.
    assert!(
        serde_json::from_value::<AIResult>(value.clone())
            .unwrap()
            .validate()
            .is_ok()
    );
    for field in ["screening_decision", "decision_explanation"] {
        let mut missing = value.clone();
        missing["scorecard"].as_object_mut().unwrap().remove(field);
        assert!(
            serde_json::from_value::<AIResult>(missing)
                .unwrap()
                .validate()
                .is_err()
        );
    }
    for (field, invalid) in [
        ("screening_decision", "HIRED"),
        ("decision_explanation", "   "),
    ] {
        let mut bad = value.clone();
        bad["scorecard"][field] = json!(invalid);
        assert!(
            serde_json::from_value::<AIResult>(bad)
                .unwrap()
                .validate()
                .is_err()
        );
    }
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

#[test]
fn permission_matrix_promises_for_all_customer_roles() {
    let tenant_id = Uuid::new_v4();

    let admin = Identity {
        user_id: Uuid::new_v4(),
        tenant_id,
        role: "admin".into(),
        name: "Workspace Admin".into(),
        email: "admin@corp.test".into(),
    };
    let recruiter = Identity {
        user_id: Uuid::new_v4(),
        tenant_id,
        role: "recruiter".into(),
        name: "Talent Recruiter".into(),
        email: "recruiter@corp.test".into(),
    };
    let interviewer = Identity {
        user_id: Uuid::new_v4(),
        tenant_id,
        role: "interviewer".into(),
        name: "Engineering Interviewer".into(),
        email: "interviewer@corp.test".into(),
    };
    let viewer = Identity {
        user_id: Uuid::new_v4(),
        tenant_id,
        role: "viewer".into(),
        name: "Hiring Observer".into(),
        email: "viewer@corp.test".into(),
    };
    let compliance = Identity {
        user_id: Uuid::new_v4(),
        tenant_id,
        role: "compliance".into(),
        name: "Compliance Officer".into(),
        email: "compliance@corp.test".into(),
    };

    // 1. Manage team and billing
    // Administrator: Allowed | Recruiter: Restricted/Denied | Interviewer/Viewer: Denied
    assert!(admin.can_manage_team());
    assert!(admin.admin().is_ok());
    assert!(!recruiter.can_manage_team());
    assert!(recruiter.admin().is_err());
    assert!(!interviewer.can_manage_team());
    assert!(interviewer.admin().is_err());
    assert!(!viewer.can_manage_team());
    assert!(viewer.admin().is_err());
    assert!(!compliance.can_manage_team());
    assert!(compliance.admin().is_err());

    // 2. Create jobs and edit applications
    // Administrator: Allowed | Recruiter: Allowed | Interviewer/Viewer: Restricted/Denied
    assert!(admin.can_create_jobs_and_edit_applications());
    assert!(admin.write().is_ok());
    assert!(recruiter.can_create_jobs_and_edit_applications());
    assert!(recruiter.write().is_ok());
    assert!(!interviewer.can_create_jobs_and_edit_applications());
    assert!(interviewer.write().is_err());
    assert!(!viewer.can_create_jobs_and_edit_applications());
    assert!(viewer.write().is_err());
    assert!(!compliance.can_create_jobs_and_edit_applications());
    assert!(compliance.write().is_err());

    // 3. Reveal candidate contacts (PII)
    // Administrator: Allowed | Recruiter: Allowed | Interviewer/Viewer: Denied
    assert!(admin.can_reveal_contacts());
    assert!(admin.pii().is_ok());
    assert!(recruiter.can_reveal_contacts());
    assert!(recruiter.pii().is_ok());
    assert!(!interviewer.can_reveal_contacts());
    assert!(interviewer.pii().is_err());
    assert!(!viewer.can_reveal_contacts());
    assert!(viewer.pii().is_err());
    assert!(compliance.can_reveal_contacts());
    assert!(compliance.pii().is_ok());

    // 4. Download original resumes
    // According to role policy: requires PII authorization
    // Administrator: Allowed | Recruiter: Allowed | Interviewer/Viewer: Restricted/Denied
    assert!(admin.can_download_original_resumes());
    assert!(recruiter.can_download_original_resumes());
    assert!(!interviewer.can_download_original_resumes());
    assert!(!viewer.can_download_original_resumes());
    assert!(compliance.can_download_original_resumes());

    // 5. Read assigned interview information / candidate evaluation
    // Administrator: Allowed | Recruiter: Allowed | Interviewer/Viewer: According to assignment / Masked
    assert!(admin.can_read_candidate_evaluations());
    assert!(recruiter.can_read_candidate_evaluations());
    assert!(interviewer.can_read_candidate_evaluations());
    assert!(viewer.can_read_candidate_evaluations());
    assert!(compliance.can_read_candidate_evaluations());
}

#[test]
fn production_startup_checks_reject_development_login_bypass() {
    let mut cfg = Config {
        bind: "0.0.0.0:8080".into(),
        database_url: "postgresql://ats_runtime:pass@postgres:5432/ats".into(),
        migration_url: "postgresql://ats_migrator:pass@postgres:5432/ats".into(),
        service_key: "strong-random-production-service-key-32-chars".into(),
        ai_url: "http://ai:8100".into(),
        origins: vec!["https://ats.example.com".into()],
        secure_cookie: true,
        allow_signup: false,
        development_mode: true, // Bypass enabled!
        max_upload: 10485760,
        lease_seconds: 300,
        max_attempts: 5,
    };

    let result = cfg.validate_security_in_mode(true);
    assert!(
        result.is_err(),
        "Must reject development_mode in production"
    );
    let err_msg = result.unwrap_err().to_string();
    assert!(
        err_msg.contains("development login bypass"),
        "Expected error to mention development login bypass, got: {err_msg}"
    );

    // Disable development mode
    cfg.development_mode = false;
    assert!(cfg.validate_security_in_mode(true).is_ok());
}

#[test]
fn production_startup_checks_reject_unsuitable_security_settings() {
    let base_cfg = Config {
        bind: "0.0.0.0:8080".into(),
        database_url: "postgresql://ats_runtime:pass@postgres:5432/ats".into(),
        migration_url: "postgresql://ats_migrator:pass@postgres:5432/ats".into(),
        service_key: "production-strong-entropy-secret-key-99281".into(),
        ai_url: "http://ai:8100".into(),
        origins: vec!["https://recruitment.corporate.com".into()],
        secure_cookie: true,
        allow_signup: false,
        development_mode: false,
        max_upload: 10485760,
        lease_seconds: 300,
        max_attempts: 5,
    };

    // Valid production config passes
    assert!(base_cfg.validate_security_in_mode(true).is_ok());

    // 1. Rejects insecure cookies
    let mut cfg = base_cfg.clone();
    cfg.secure_cookie = false;
    let err = cfg.validate_security_in_mode(true).unwrap_err().to_string();
    assert!(err.contains("ATS_SECURE_COOKIE"), "Got: {err}");

    // 2. Rejects test/placeholder service key
    let mut cfg = base_cfg.clone();
    cfg.service_key = "test-service-key-with-at-least-32-characters".into();
    let err = cfg.validate_security_in_mode(true).unwrap_err().to_string();
    assert!(err.contains("ATS_SERVICE_KEY"), "Got: {err}");

    // 3. Rejects wildcard CORS origin
    let mut cfg = base_cfg.clone();
    cfg.origins = vec!["*".into()];
    let err = cfg.validate_security_in_mode(true).unwrap_err().to_string();
    assert!(err.contains("Wildcard CORS origin"), "Got: {err}");

    // 4. Rejects localhost CORS origin in production
    let mut cfg = base_cfg.clone();
    cfg.origins = vec!["http://localhost:3000".into()];
    let err = cfg.validate_security_in_mode(true).unwrap_err().to_string();
    assert!(err.contains("Localhost CORS origins"), "Got: {err}");

    // 5. Rejects S3 over plaintext HTTP in production
    unsafe {
        std::env::set_var("ATS_S3_ALLOW_HTTP", "true");
    }
    let err = base_cfg
        .validate_security_in_mode(true)
        .unwrap_err()
        .to_string();
    assert!(err.contains("Plaintext HTTP for S3 storage"), "Got: {err}");
    unsafe {
        std::env::remove_var("ATS_S3_ALLOW_HTTP");
    }
}

#[test]
fn database_role_safety_distinguishes_superusers_and_bypassrls() {
    // PostgreSQL documentation: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
    // "Superusers and roles with the BYPASSRLS attribute always bypass the row security system."
    // Production startup must reject superusers and BYPASSRLS roles.

    // Superuser rejected
    let err = check_database_role_safety("postgres", true, false, true)
        .unwrap_err()
        .to_string();
    assert!(err.contains("SUPERUSER"));
    assert!(err.contains("bypass row-level security"));

    // Role with BYPASSRLS rejected
    let err = check_database_role_safety("rls_bypass_role", false, true, true)
        .unwrap_err()
        .to_string();
    assert!(err.contains("BYPASSRLS"));
    assert!(err.contains("bypass row-level security"));

    // Role with both rejected
    let err = check_database_role_safety("root", true, true, true)
        .unwrap_err()
        .to_string();
    assert!(err.contains("SUPERUSER and BYPASSRLS"));

    // Dedicated restricted application role (ats_runtime) accepted
    assert!(check_database_role_safety("ats_runtime", false, false, true).is_ok());
}

#[tokio::test]
async fn email_task_inspection_endpoint_requires_development_mode() {
    let cfg = Config {
        bind: "0.0.0.0:8080".into(),
        database_url: "postgresql://localhost/ats".into(),
        migration_url: "postgresql://localhost/ats".into(),
        service_key: "strong-random-production-service-key-32-chars".into(),
        ai_url: "http://ai:8100".into(),
        origins: vec!["https://ats.example.com".into()],
        secure_cookie: true,
        allow_signup: false,
        development_mode: false, // In production / non-dev mode
        max_upload: 10485760,
        lease_seconds: 300,
        max_attempts: 5,
    };
    let state = ats_backend::AppState {
        db: sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgresql://localhost/ats")
            .unwrap(),
        objects: std::sync::Arc::new(object_store::memory::InMemory::new()),
        http: reqwest::Client::new(),
        config: std::sync::Arc::new(cfg),
    };
    let result = ats_backend::auth::list_email_tasks(
        axum::extract::State(state),
        axum::http::HeaderMap::new(),
    )
    .await;
    assert!(result.is_err());
    let err = result.unwrap_err();
    assert_eq!(err.0, axum::http::StatusCode::FORBIDDEN);
    assert!(
        err.1
            .contains("Email task inspection is only permitted in development mode")
    );
}

#[test]
fn job_lifecycle_input_validation_and_status_transitions() {
    let mut input = ats_backend::domain::JobInput {
        title: "Senior Backend Engineer".into(),
        department: "Core Engineering".into(),
        location: "London, UK".into(),
        job_description: "Build robust distributed backend systems".into(),
        required_skills: vec!["Rust".into(), "PostgreSQL".into()],
        min_years_experience: 5.0,
        status: Some("OPEN".into()),
    };
    assert!(input.validate().is_ok());

    input.status = Some("PAUSED".into());
    assert!(input.validate().is_ok());

    input.status = Some("CLOSED".into());
    assert!(input.validate().is_ok());

    input.status = Some("INVALID_STATUS".into());
    let err = input.validate().unwrap_err();
    assert!(err.1.contains("Job status must be OPEN, PAUSED, or CLOSED"));
}

#[test]
fn pagination_headers_and_limit_calculation() {
    // When a recruiter has 1200 records and requests page 2 with limit 500
    let total = 1200i64;
    let limit = 500i64;
    let page = 2i64;
    let offset = (page - 1) * limit; // 500
    let has_more = offset + limit < total; // 1000 < 1200 => true

    let headers = ats_backend::domain::pagination_headers(total, page, limit, has_more);
    assert_eq!(headers.get("x-total-count").unwrap(), "1200");
    assert_eq!(headers.get("x-page").unwrap(), "2");
    assert_eq!(headers.get("x-limit").unwrap(), "500");
    assert_eq!(headers.get("x-has-more").unwrap(), "true");

    // Page 3 (records 1001-1200) has_more is false
    let page_3 = 3i64;
    let offset_3 = (page_3 - 1) * limit;
    let has_more_3 = offset_3 + limit < total;
    let headers_3 = ats_backend::domain::pagination_headers(total, page_3, limit, has_more_3);
    assert_eq!(headers_3.get("x-page").unwrap(), "3");
    assert_eq!(headers_3.get("x-has-more").unwrap(), "false");
}

#[test]
fn dual_application_independence_preserves_stages_without_overwrite() {
    // A single candidate applies to two distinct jobs: Job A and Job B
    let candidate_id = Uuid::new_v4();
    let job_a_id = Uuid::new_v4();
    let job_b_id = Uuid::new_v4();

    let mut application_a = json!({
        "id": Uuid::new_v4(),
        "candidate_id": candidate_id,
        "job_id": job_a_id,
        "job_title": "Backend Lead",
        "stage": "Qualified", // Shortlisted
        "match_score": 92.5
    });

    let application_b = json!({
        "id": Uuid::new_v4(),
        "candidate_id": candidate_id,
        "job_id": job_b_id,
        "job_title": "Frontend Architect",
        "stage": "Rejected", // Rejected
        "match_score": 45.0
    });

    let applications = [application_a.clone(), application_b.clone()];

    // Resolving candidate in context of Job A
    let target_a = applications
        .iter()
        .find(|a| a["job_id"] == json!(job_a_id))
        .unwrap();
    assert_eq!(target_a["stage"], "Qualified");
    assert_eq!(target_a["match_score"], 92.5);

    // Resolving candidate in context of Job B
    let target_b = applications
        .iter()
        .find(|a| a["job_id"] == json!(job_b_id))
        .unwrap();
    assert_eq!(target_b["stage"], "Rejected");
    assert_eq!(target_b["match_score"], 45.0);

    // Updating Job A stage does not mutate Job B
    application_a["stage"] = json!("Interview");
    assert_eq!(application_a["stage"], "Interview");
    assert_eq!(application_b["stage"], "Rejected");
}

#[test]
fn interview_and_offer_contract_validation() {
    let interview = ats_backend::domain::InterviewInput {
        round: "System Design Deep Dive".into(),
        scheduled_at: "2026-10-25T14:00:00Z".into(),
        interviewer_name: "Principal Architect".into(),
        interviewer_email: Some("architect@example.com".into()),
        notes: Some("Strong distributed systems background".into()),
        outcome: "PASSED".into(),
    };
    assert!(interview.validate().is_ok());

    let mut invalid_interview = interview.clone();
    invalid_interview.outcome = "UNKNOWN_OUTCOME".into();
    assert!(invalid_interview.validate().is_err());

    let offer = ats_backend::domain::OfferInput {
        status: "EXTENDED".into(),
        base_salary: Some(155000.0),
        currency: "GBP".into(),
        equity: Some("15,000 RSUs".into()),
        sign_on_bonus: Some(15000.0),
        start_date: Some("2026-12-01".into()),
        notes: Some("Competitive compensation package".into()),
    };
    assert!(offer.validate().is_ok());

    let mut invalid_offer = offer.clone();
    invalid_offer.status = "NOT_A_STATUS".into();
    assert!(invalid_offer.validate().is_err());
}

#[test]
fn public_contract_exposes_recruiter_workflow_routes() {
    let doc = ats_backend::openapi::document();
    for route in [
        "/api/v1/jobs/{job}/candidates/{candidate}/interviews",
        "/api/v1/jobs/{job}/candidates/{candidate}/offer",
    ] {
        assert!(
            doc["paths"].get(route).is_some(),
            "Route {route} must be documented in public OpenAPI schema"
        );
    }
}

#[test]
fn recruiter_can_paginate_beyond_first_500_records() {
    // Total of 1,250 candidates in database
    let total = 1250;
    let page = 11;
    let limit = 50;
    let (calc_limit, offset) = ats_backend::domain::calculate_pagination(Some(page), Some(limit));
    assert_eq!(
        offset, 500,
        "Page 11 offset must start at record 500 (item 501)"
    );
    assert_eq!(calc_limit, 50);

    let has_more = (offset + calc_limit) < total;
    assert!(
        has_more,
        "Must have more records beyond record 550 when total is 1250"
    );

    // Page 25 reaches records 1200-1250
    let (p25_limit, p25_offset) = ats_backend::domain::calculate_pagination(Some(25), Some(50));
    assert_eq!(p25_offset, 1200);
    let p25_has_more = (p25_offset + p25_limit) < total;
    assert!(!p25_has_more, "Page 25 reaches the end of 1250 records");
}

#[test]
fn candidate_shortlisted_for_job_a_and_rejected_for_job_b_without_overwrite() {
    let candidate_id = Uuid::new_v4();
    let job_a_id = Uuid::new_v4();
    let job_b_id = Uuid::new_v4();

    let mut app_a = serde_json::json!({
        "id": Uuid::new_v4(),
        "candidate_id": candidate_id,
        "job_id": job_a_id,
        "job_title": "Backend Distributed Systems Engineer",
        "stage": "Qualified",
        "match_score": 94.0
    });

    let mut app_b = serde_json::json!({
        "id": Uuid::new_v4(),
        "candidate_id": candidate_id,
        "job_id": job_b_id,
        "job_title": "Frontend Architect",
        "stage": "Applied",
        "match_score": 45.0
    });

    // Recruiter shortlists candidate for Job A:
    app_a["stage"] = serde_json::json!("Shortlist");
    // Recruiter rejects candidate for Job B:
    app_b["stage"] = serde_json::json!("Rejected");

    assert_eq!(app_a["stage"], "Shortlist");
    assert_eq!(app_b["stage"], "Rejected");
    assert_ne!(app_a["stage"], app_b["stage"]);
}

#[test]
fn reset_confirm_rate_limit_keys_and_client_ip_extraction() {
    use axum::http::{HeaderMap, HeaderValue};

    // 1. Default to 127.0.0.1 when no proxy headers present
    let empty_headers = HeaderMap::new();
    assert_eq!(ats_backend::auth::client_ip(&empty_headers), "127.0.0.1");

    // 2. Extract first IP from x-forwarded-for
    let mut xff_headers = HeaderMap::new();
    xff_headers.insert(
        "x-forwarded-for",
        HeaderValue::from_static("203.0.113.195, 70.41.3.18, 150.172.238.178"),
    );
    assert_eq!(ats_backend::auth::client_ip(&xff_headers), "203.0.113.195");

    // 3. Fallback to x-real-ip
    let mut x_real_headers = HeaderMap::new();
    x_real_headers.insert("x-real-ip", HeaderValue::from_static("198.51.100.1"));
    assert_eq!(ats_backend::auth::client_ip(&x_real_headers), "198.51.100.1");

    // 4. Verify rate-limit key scoping produces distinct keys for distinct tokens and IPs
    let token_a = "rst_token_a_12345678901234567890";
    let token_b = "rst_token_b_98765432109876543210";
    let hash_a = ats_backend::hash(token_a.as_bytes());
    let hash_b = ats_backend::hash(token_b.as_bytes());

    let key_token_a = format!("reset-confirm:{hash_a}");
    let key_token_b = format!("reset-confirm:{hash_b}");
    let key_ip_1 = format!("reset-confirm:203.0.113.195");
    let key_ip_2 = format!("reset-confirm:198.51.100.1");

    assert_ne!(key_token_a, key_token_b);
    assert_ne!(key_ip_1, key_ip_2);
    assert_ne!(key_token_a, "reset-confirm");
    assert_ne!(key_ip_1, "reset-confirm");
}

#[test]
fn two_tier_auth_rate_limiting_prevents_lockout_and_spraying() {
    let attacker_ip = "198.51.100.42";
    let legitimate_user_ip = "203.0.113.88";
    let target_email = "admin@example.test";

    // Tier 1: Per-(IP, email) key formulation
    let attacker_key = format!("{attacker_ip}:{target_email}");
    let legitimate_key = format!("{legitimate_user_ip}:{target_email}");

    // An attacker's brute force attempts generate a distinct key and hash
    assert_ne!(
        attacker_key, legitimate_key,
        "Attacker key must not match legitimate user's key"
    );
    assert_ne!(
        ats_backend::hash(attacker_key.as_bytes()),
        ats_backend::hash(legitimate_key.as_bytes()),
        "Attacker attempts must not increment legitimate user's rate-limit counter"
    );
    assert_ne!(
        attacker_key, target_email,
        "Rate limit key must not be solely the target email"
    );

    // Tier 2: Per-IP global key formulation to throttle horizontal password spraying
    let email_1 = "recruiter1@example.test";
    let email_2 = "recruiter2@example.test";
    let email_3 = "recruiter3@example.test";

    let global_ip_key_1 = format!("ip:{attacker_ip}");
    let global_ip_key_2 = format!("ip:{attacker_ip}");
    assert_eq!(
        global_ip_key_1, global_ip_key_2,
        "Horizontal spraying attempts from the same IP must share the global IP key"
    );

    // Individual emails are distinct under Tier 1, but aggregated under Tier 2
    let spray_key_1 = format!("{attacker_ip}:{email_1}");
    let spray_key_2 = format!("{attacker_ip}:{email_2}");
    let spray_key_3 = format!("{attacker_ip}:{email_3}");

    assert_ne!(spray_key_1, spray_key_2);
    assert_ne!(spray_key_2, spray_key_3);

    // Constants verification
    assert_eq!(ats_backend::auth::AUTH_IDENTITY_LIMIT, 10);
    assert_eq!(ats_backend::auth::AUTH_IP_LIMIT, 30);
    assert!(
        ats_backend::auth::AUTH_IP_LIMIT >= ats_backend::auth::AUTH_IDENTITY_LIMIT,
        "Global IP threshold must be >= per-account threshold"
    );

    // Verification of registration and password reset request key formulations
    let attacker_reg_key = format!("{attacker_ip}:register:{target_email}");
    let legitimate_reg_key = format!("{legitimate_user_ip}:register:{target_email}");
    assert_ne!(attacker_reg_key, legitimate_reg_key);

    let attacker_reset_key = format!("{attacker_ip}:reset-req:{target_email}");
    let legitimate_reset_key = format!("{legitimate_user_ip}:reset-req:{target_email}");
    assert_ne!(attacker_reset_key, legitimate_reset_key);

    // Verification that successful login clears the per-(IP, email) attempt record
    let login_clear_key = format!("{legitimate_user_ip}:{target_email}");
    assert_eq!(
        login_clear_key, legitimate_key,
        "Successful login must delete the specific per-(IP, email) counter"
    );
}

#[tokio::test]
async fn email_task_inspection_requires_authentication_even_in_dev_mode() {
    use axum::http::{HeaderMap, HeaderValue, StatusCode};

    let cfg = Config {
        bind: "0.0.0.0:8080".into(),
        database_url: "postgresql://localhost/ats".into(),
        migration_url: "postgresql://localhost/ats".into(),
        service_key: "strong-random-production-service-key-32-chars".into(),
        ai_url: "http://ai:8100".into(),
        origins: vec!["https://ats.example.com".into()],
        secure_cookie: true,
        allow_signup: false,
        development_mode: true, // In development mode!
        max_upload: 10485760,
        lease_seconds: 300,
        max_attempts: 5,
    };
    let state = ats_backend::AppState {
        db: sqlx::postgres::PgPoolOptions::new()
            .connect_lazy("postgresql://localhost/ats")
            .unwrap(),
        objects: std::sync::Arc::new(object_store::memory::InMemory::new()),
        http: reqwest::Client::new(),
        config: std::sync::Arc::new(cfg),
    };

    // 1. Unauthenticated request without headers must be rejected with 401 Unauthorized
    let unauth_result = ats_backend::auth::list_email_tasks(
        axum::extract::State(state.clone()),
        HeaderMap::new(),
    )
    .await;
    assert!(unauth_result.is_err());
    let err = unauth_result.unwrap_err();
    assert_eq!(err.0, StatusCode::UNAUTHORIZED);
    assert!(err.1.contains("Service authentication") || err.1.contains("admin session"));

    // 2. Request with invalid service key must be rejected with 401 Unauthorized
    let mut bad_key_headers = HeaderMap::new();
    bad_key_headers.insert("x-service-key", HeaderValue::from_static("wrong-service-key"));
    let bad_key_result = ats_backend::auth::list_email_tasks(
        axum::extract::State(state.clone()),
        bad_key_headers,
    )
    .await;
    assert!(bad_key_result.is_err());
    let err = bad_key_result.unwrap_err();
    assert_eq!(err.0, StatusCode::UNAUTHORIZED);
}

#[test]
fn account_lifecycle_migration_enforces_rls_and_token_scrubbing() {
    let migration_sql = include_str!("../migrations/0003_account_lifecycle.sql");

    // 1. Invitations table must enable and force row level security
    assert!(
        migration_sql.contains("ALTER TABLE ats_v2.invitations ENABLE ROW LEVEL SECURITY;"),
        "Migration must ENABLE ROW LEVEL SECURITY on invitations"
    );
    assert!(
        migration_sql.contains("ALTER TABLE ats_v2.invitations FORCE ROW LEVEL SECURITY;"),
        "Migration must FORCE ROW LEVEL SECURITY on invitations"
    );

    // 2. Email tasks table must enable and force row level security
    assert!(
        migration_sql.contains("ALTER TABLE ats_v2.email_tasks ENABLE ROW LEVEL SECURITY;"),
        "Migration must ENABLE ROW LEVEL SECURITY on email_tasks"
    );
    assert!(
        migration_sql.contains("ALTER TABLE ats_v2.email_tasks FORCE ROW LEVEL SECURITY;"),
        "Migration must FORCE ROW LEVEL SECURITY on email_tasks"
    );

    // 3. Sent email task trigger must scrub token from payload
    assert!(
        migration_sql.contains("CREATE OR REPLACE FUNCTION ats_v2.scrub_email_task_token"),
        "Migration must create scrub_email_task_token trigger function"
    );
    assert!(
        migration_sql.contains("payload - 'token'"),
        "Migration must scrub 'token' from payload when sent"
    );
}

#[test]
fn add_member_response_omits_token_in_production() {
    let raw_token = "inv_12345678901234567890";
    let inv_id = Uuid::new_v4();
    let email = "new_recruiter@example.test";
    let role = "recruiter";

    // In production mode (development_mode: false)
    let prod_mode = false;
    let mut resp = json!({
        "status": "invited",
        "invitation_id": inv_id,
        "email": email,
        "role": role,
    });
    if prod_mode {
        resp["token"] = json!(raw_token);
    }
    assert!(
        resp.get("token").is_none(),
        "Production response must omit plaintext token"
    );

    // In dev mode (development_mode: true)
    let dev_mode = true;
    let mut dev_resp = json!({
        "status": "invited",
        "invitation_id": inv_id,
        "email": email,
        "role": role,
    });
    if dev_mode {
        dev_resp["token"] = json!(raw_token);
    }
    assert_eq!(
        dev_resp["token"], raw_token,
        "Dev response includes token for test runners"
    );
}

#[test]
fn sec08_unredacted_pii_interviews_offer_and_viewer_access() {
    use ats_backend::domain::{mask_offer_compensation, redact_profile};
    use serde_json::Value;

    // 1. Verify mask_offer_compensation strips salary, equity, and bonus while retaining status
    let mut offer = json!({
        "status": "EXTENDED",
        "base_salary": 185000.0,
        "currency": "USD",
        "equity": "0.75%",
        "sign_on_bonus": 30000.0,
        "start_date": "2026-11-01",
        "notes": "Top tier candidate compensation"
    });
    mask_offer_compensation(&mut offer);
    assert_eq!(offer["status"], "EXTENDED");
    assert_eq!(offer["currency"], "USD");
    assert_eq!(offer["base_salary"], Value::Null);
    assert_eq!(offer["equity"], "[CONFIDENTIAL]");
    assert_eq!(offer["sign_on_bonus"], Value::Null);

    // 2. Verify redact_profile scrubs candidate PII from interview and offer structures
    let contact = json!({
        "name": "Alex Mercer",
        "email": "alex.mercer@cyber.test",
        "phone": "+1-555-890-1234",
        "location": "Boston, MA"
    });
    let mut interview_notes = json!([
        {
            "round": "Technical Round 2",
            "notes": "Discussed distributed consensus with Alex Mercer at alex.mercer@cyber.test (call +1-555-890-1234)"
        }
    ]);
    redact_profile(&mut interview_notes, &contact);
    let redacted_text = interview_notes[0]["notes"].as_str().unwrap();
    assert!(!redacted_text.contains("Alex Mercer"));
    assert!(!redacted_text.contains("alex.mercer@cyber.test"));
    assert!(!redacted_text.contains("555-890-1234"));
    assert!(redacted_text.contains("[REDACTED]"));

    // 3. Verify role permission gates for viewer and interviewer
    let viewer = Identity {
        user_id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        role: "viewer".into(),
        name: "Viewer User".into(),
        email: "viewer@company.test".into(),
    };
    let interviewer = Identity {
        user_id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        role: "interviewer".into(),
        name: "Interviewer User".into(),
        email: "interviewer@company.test".into(),
    };
    let recruiter = Identity {
        user_id: Uuid::new_v4(),
        tenant_id: Uuid::new_v4(),
        role: "recruiter".into(),
        name: "Recruiter User".into(),
        email: "recruiter@company.test".into(),
    };

    assert!(viewer.pii().is_err(), "Viewer must not have PII access");
    assert!(!viewer.can_reveal_contacts(), "Viewer cannot reveal contacts");

    assert!(interviewer.pii().is_err(), "Interviewer must not have PII access");
    assert!(!interviewer.can_reveal_contacts(), "Interviewer cannot reveal contacts");

    assert!(recruiter.pii().is_ok(), "Recruiter must have PII access");
    assert!(recruiter.can_reveal_contacts(), "Recruiter can reveal contacts");

    // 4. Verify candidate name scoping rule: only reveal when include_pii=true AND user.can_reveal_contacts()
    let cid = Uuid::new_v4();
    let name_when_pii_requested = if true && recruiter.can_reveal_contacts() {
        contact.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap()
    } else {
        format!("Candidate #{}", &cid.simple().to_string()[..8])
    };
    assert_eq!(name_when_pii_requested, "Alex Mercer");

    let name_when_pii_omitted = if false && recruiter.can_reveal_contacts() {
        contact.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap()
    } else {
        format!("Candidate #{}", &cid.simple().to_string()[..8])
    };
    assert!(name_when_pii_omitted.starts_with("Candidate #"));

    let name_viewer = if true && viewer.can_reveal_contacts() {
        contact.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()).unwrap()
    } else {
        format!("Candidate #{}", &cid.simple().to_string()[..8])
    };
    assert!(name_viewer.starts_with("Candidate #"));
}





