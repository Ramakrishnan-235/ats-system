//! Run with TEST_DATABASE_URL (restricted role) and TEST_MIGRATION_DATABASE_URL.
use ats_backend::{AppState, api, config::Config};
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use serde_json::{Value, json};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;
use tower::ServiceExt;
use uuid::Uuid;

async fn request(
    app: &Router,
    method: &str,
    path: &str,
    session: Option<&str>,
    body: Value,
) -> (StatusCode, Value, Option<String>) {
    let mut builder = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/json")
        .header("origin", "http://localhost:3000");
    if let Some(value) = session {
        builder = builder.header("cookie", value);
    }
    let response = app
        .clone()
        .oneshot(builder.body(Body::from(body.to_string())).unwrap())
        .await
        .unwrap();
    let cookie = response
        .headers()
        .get("set-cookie")
        .map(|v| v.to_str().unwrap().split(';').next().unwrap().to_owned());
    let status = response.status();
    let data = to_bytes(response.into_body(), 12 * 1024 * 1024)
        .await
        .unwrap();
    (
        status,
        serde_json::from_slice(&data).unwrap_or(Value::Null),
        cookie,
    )
}
async fn internal(app: &Router, path: &str, body: Value) -> (StatusCode, Value) {
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri(path)
                .header("content-type", "application/json")
                .header(
                    "x-service-key",
                    "test-service-key-with-at-least-32-characters",
                )
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    let status = response.status();
    let bytes = to_bytes(response.into_body(), 1024 * 1024).await.unwrap();
    (status, serde_json::from_slice(&bytes).unwrap())
}

#[tokio::test]
#[ignore = "requires a real PostgreSQL/pgvector database and restricted runtime role"]
async fn durable_tenant_workflow() {
    let url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL required");
    let admin_url =
        std::env::var("TEST_MIGRATION_DATABASE_URL").expect("TEST_MIGRATION_DATABASE_URL required");
    let admin = PgPoolOptions::new().connect(&admin_url).await.unwrap();
    sqlx::migrate!().run(&admin).await.unwrap();
    let db = PgPoolOptions::new().connect(&url).await.unwrap();
    let privileged: bool = sqlx::query_scalar(
        "SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user",
    )
    .fetch_one(&db)
    .await
    .unwrap();
    assert!(
        !privileged,
        "Test must use the restricted production-style role"
    );
    let cfg = Config {
        bind: "127.0.0.1:0".into(),
        database_url: url.clone(),
        migration_url: admin_url,
        service_key: "test-service-key-with-at-least-32-characters".into(),
        ai_url: "http://127.0.0.1:9".into(),
        origins: vec!["http://localhost:3000".into()],
        secure_cookie: false,
        allow_signup: true,
        development_mode: false,
        max_upload: 10485760,
        lease_seconds: 300,
        max_attempts: 5,
    };
    let state = AppState {
        db: db.clone(),
        objects: Arc::new(object_store::memory::InMemory::new()),
        http: reqwest::Client::new(),
        config: Arc::new(cfg),
    };
    let app = api::router(state.clone());
    let suffix = Uuid::new_v4();
    let mut sessions = vec![];
    for label in ["A", "B"] {
        let(status,_,cookie)=request(&app,"POST","/api/v1/auth/register",None,json!({"email":format!("{label}-{suffix}@example.test"),"password":"a-long-test-password-12345","name":label,"workspace_name":label,"workspace_kind":"corporate"})).await;
        assert_eq!(status, StatusCode::OK);
        sessions.push(cookie.unwrap());
    }
    let (_, identity, _) = request(
        &app,
        "GET",
        "/api/v1/auth/me",
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    let tenant = Uuid::parse_str(identity["user"]["tenant_id"].as_str().unwrap()).unwrap();
    let (status,job,_)=request(&app,"POST","/api/v1/jobs",Some(&sessions[0]),json!({"title":"Python developer","job_description":"Build Python APIs","department":"Engineering"})).await;
    assert_eq!(status, StatusCode::OK);
    let jobid = job["id"].as_str().unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/jobs/{jobid}"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Browser-supplied admin/tenant headers cannot replace a verified session.
    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/jobs")
                .header("x-user-role", "admin")
                .header("x-user-id", Uuid::new_v4().to_string())
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let boundary = "ats-test-boundary";
    let source = b"%PDF-1.4\nTest Python resume\n%%EOF";
    let multipart = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"name\"\r\n\r\nSubmitted Synthetic Applicant\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"headline\"\r\n\r\nSubmitted Backend Engineer\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"job_id\"\r\n\r\n{jobid}\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"resume.pdf\"\r\nContent-Type: application/pdf\r\n\r\n{}\r\n--{boundary}--\r\n",
        String::from_utf8_lossy(source)
    );
    let mut accepted = None;
    for _ in 0..2 {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/v1/candidates/upload-async")
                    .header("cookie", &sessions[0])
                    .header("origin", "http://localhost:3000")
                    .header("idempotency-key", suffix.to_string())
                    .header(
                        "content-type",
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .body(Body::from(multipart.clone()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        let value: Value =
            serde_json::from_slice(&to_bytes(response.into_body(), 100000).await.unwrap()).unwrap();
        if let Some(old) = &accepted {
            assert_eq!(old, &value);
        } else {
            accepted = Some(value);
        }
    }
    let accepted = accepted.unwrap();
    let task = accepted["task_id"].as_str().unwrap();
    let candidate = accepted["candidate_id"].as_str().unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/candidates/tasks/{task}"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (status, lease) = internal(&app, &format!("/internal/jobs/{task}/lease"), json!({})).await;
    let progress_path = format!("/internal/jobs/{task}/progress");
    assert_eq!(
        internal(
            &app,
            &progress_path,
            json!({"attempt_id":Uuid::new_v4(),"stage":"pdf_parsing","status":"RUNNING"})
        )
        .await
        .0,
        StatusCode::CONFLICT
    );
    for stage_status in ["RUNNING", "COMPLETED"] {
        assert_eq!(internal(&app, &progress_path, json!({"attempt_id":lease["attempt_id"],"stage":"pdf_parsing","status":stage_status})).await.0, StatusCode::OK);
    }
    let (_, live_progress, _) = request(
        &app,
        "GET",
        &format!("/api/v1/candidates/tasks/{task}"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert_eq!(
        live_progress["stages"]["pdf_parsing"]["status"],
        "COMPLETED"
    );
    assert!(live_progress["stages"]["pdf_parsing"]["started_at"].is_string());
    assert!(live_progress["stages"]["pdf_parsing"]["finished_at"].is_string());
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        internal(&app, &format!("/internal/jobs/{task}/lease"), json!({}))
            .await
            .0,
        StatusCode::CONFLICT
    );
    let result = json!({"contract_version":1,"attempt_id":lease["attempt_id"],"document_id":lease["document_id"],"document_version":1,"input_revision":1,"job_revision":lease["job_revision"],"extraction_status":"COMPLETED","evaluation_status":"FAILED","profile":{"target_headline":"Python developer","core_skills":["Python"]},"contact":{"name":"Synthetic Candidate","email":"synthetic@example.test"},"sanitized_text":"Python developer with API experience","warnings":["EVALUATION_UNAVAILABLE"],"error_code":null});
    assert_eq!(
        internal(
            &app,
            &format!("/internal/jobs/{task}/artifact"),
            result.clone()
        )
        .await
        .0,
        StatusCode::OK
    );
    sqlx::query(
        "UPDATE ats_v2.processing_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
    )
    .bind(Uuid::parse_str(task).unwrap())
    .execute(&admin)
    .await
    .unwrap();
    ats_backend::jobs::dispatch_once(&state).await.unwrap();
    assert_eq!(
        request(
            &app,
            "GET",
            &format!("/api/v1/candidates/tasks/{task}"),
            Some(&sessions[0]),
            json!({})
        )
        .await
        .1["state"],
        "SUCCESS"
    );
    assert_eq!(
        internal(
            &app,
            &format!("/internal/jobs/{task}/result"),
            result.clone()
        )
        .await
        .0,
        StatusCode::OK
    );
    let duplicate = internal(&app, &format!("/internal/jobs/{task}/result"), result).await;
    assert_eq!(duplicate.1["duplicate"], true);
    let restarted = api::router(state.clone());
    let (status, profile, _) = request(
        &restarted,
        "GET",
        &format!("/api/v1/candidates/{candidate}"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_ne!(profile["name"], "Synthetic Candidate");
    assert_eq!(profile["applications"][0]["stage"], "Recruiter Review");
    assert_eq!(profile["scorecard"]["evaluation_status"], "FAILED");
    let (_, failed_score, _) = request(
        &restarted,
        "GET",
        &format!("/api/v1/candidates/{candidate}/scorecard?job_id={jobid}"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert_eq!(failed_score["evaluation_status"], "FAILED");
    assert_eq!(failed_score["overall_match_score"], Value::Null);
    assert_eq!(
        request(
            &restarted,
            "GET",
            &format!("/api/v1/candidates/{candidate}?include_pii=true"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace read: another tenant cannot read candidate profile or scorecard
    assert_eq!(
        request(
            &restarted,
            "GET",
            &format!("/api/v1/candidates/{candidate}"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &restarted,
            "GET",
            &format!("/api/v1/candidates/{candidate}/scorecard"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace download: another tenant cannot download candidate's original resume PDF
    assert_eq!(
        request(
            &restarted,
            "GET",
            &format!("/api/v1/candidates/{candidate}/resume-pdf"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace citation: another tenant cannot locate citations
    assert_eq!(
        request(
            &restarted,
            "POST",
            &format!("/api/v1/candidates/{candidate}/locate-citation"),
            Some(&sessions[1]),
            json!({"search_phrase": "Python"})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace edit: another tenant cannot edit job, candidate profile, stage, or add notes
    assert_eq!(
        request(
            &restarted,
            "PATCH",
            &format!("/api/v1/jobs/{jobid}"),
            Some(&sessions[1]),
            json!({"title": "Hijacked job", "job_description": "Cross tenant edit"})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &restarted,
            "POST",
            &format!("/api/v1/candidates/{candidate}/notes"),
            Some(&sessions[1]),
            json!({"content": "Injected malicious note"})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &restarted,
            "PATCH",
            &format!("/api/v1/jobs/{jobid}/candidates/{candidate}/stage?new_stage=Interview"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &restarted,
            "DELETE",
            &format!("/api/v1/jobs/{jobid}/candidates/{candidate}"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace submit: another tenant cannot submit candidates to another workspace's job
    assert_eq!(
        request(
            &restarted,
            "POST",
            &format!("/api/v1/jobs/{jobid}/candidates"),
            Some(&sessions[1]),
            json!({"name": "Unauthorized applicant"})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace candidate attachment: another tenant cannot link Workspace A's candidate into Workspace B's job
    let (status, job_b, _) = request(
        &restarted,
        "POST",
        "/api/v1/jobs",
        Some(&sessions[1]),
        json!({"title": "Tenant B Engineer", "job_description": "Tenant B requirements"}),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    let job_b_id = job_b["id"].as_str().unwrap();
    assert_eq!(
        request(
            &restarted,
            "POST",
            &format!("/api/v1/jobs/{job_b_id}/candidates"),
            Some(&sessions[1]),
            json!({"id": candidate})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    // Cross-workspace reveal contacts: searching PII never returns another customer's candidate
    let (_, search_results, _) = request(
        &restarted,
        "GET",
        "/api/v1/candidates?search=Synthetic&include_pii=true",
        Some(&sessions[1]),
        json!({}),
    )
    .await;
    assert_eq!(search_results.as_array().unwrap().len(), 0);
    // RLS also protects a query that accidentally omits the tenant predicate.
    let count: i64 = sqlx::query_scalar("SELECT count(*) FROM ats_v2.candidates")
        .fetch_one(&db)
        .await
        .unwrap();
    assert_eq!(count, 0);
    assert_eq!(
        request(
            &app,
            "PATCH",
            &format!("/api/v1/jobs/{jobid}/candidates/{candidate}/stage?new_stage=Interview"),
            Some(&sessions[0]),
            json!({})
        )
        .await
        .0,
        StatusCode::OK
    );
    // The same person can belong to two jobs without sharing stage or score.
    let (_, second_job, _) = request(
        &app,
        "POST",
        "/api/v1/jobs",
        Some(&sessions[0]),
        json!({"title":"Second role","job_description":"Different SQL requirements"}),
    )
    .await;
    let second_id = second_job["id"].as_str().unwrap();
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("/api/v1/jobs/{second_id}/candidates"),
            Some(&sessions[0]),
            json!({"id":candidate})
        )
        .await
        .0,
        StatusCode::OK
    );
    let (_, multiple, _) = request(
        &app,
        "GET",
        &format!("/api/v1/candidates/{candidate}"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert_eq!(multiple["applications"].as_array().unwrap().len(), 2);
    assert_eq!(multiple["applications"][0]["stage"], "Screening");
    assert_eq!(multiple["applications"][1]["stage"], "Interview");
    let (_, supplied, _) = request(
        &app,
        "GET",
        &format!("/api/v1/candidates/{candidate}?include_pii=true"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert_eq!(supplied["name"], "Submitted Synthetic Applicant");
    assert_eq!(supplied["role"], "Submitted Backend Engineer");
    assert!(supplied.get("_submitted_headline").is_none());
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("/api/v1/jobs/{jobid}/candidates/{candidate}/evaluate"),
            Some(&sessions[1]),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    let (_, manual, _) = request(
        &app,
        "POST",
        &format!("/api/v1/jobs/{second_id}/candidates"),
        Some(&sessions[0]),
        json!({"name":"Manual applicant without resume"}),
    )
    .await;
    let manual_id = manual
        .as_array()
        .unwrap()
        .iter()
        .find(|item| item["id"].as_str() != Some(candidate))
        .unwrap()["id"]
        .as_str()
        .unwrap();
    assert_eq!(
        request(
            &app,
            "POST",
            &format!("/api/v1/jobs/{second_id}/candidates/{manual_id}/evaluate"),
            Some(&sessions[0]),
            json!({})
        )
        .await
        .0,
        StatusCode::BAD_REQUEST
    );
    // A recruiter edit made while a model runs wins over the older result.
    let path = format!("/api/v1/jobs/{jobid}/candidates/{candidate}/evaluate");
    let (status, queued, _) = request(&app, "POST", &path, Some(&sessions[0]), json!({})).await;
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(queued["task_ids"].as_array().unwrap().len(), 1);
    let repeated = request(&app, "POST", &path, Some(&sessions[0]), json!({})).await;
    assert_eq!(repeated.1["task_ids"], queued["task_ids"]);
    let pending = Uuid::parse_str(queued["task_ids"][0].as_str().unwrap()).unwrap();
    let task_count: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM ats_v2.processing_jobs WHERE tenant_id=$1 AND operation='evaluate'",
    )
    .bind(tenant)
    .fetch_one(&admin)
    .await
    .unwrap();
    assert_eq!(
        task_count, 1,
        "Scoring one candidate must not enqueue other candidates or jobs"
    );
    let (_, stale_lease) =
        internal(&app, &format!("/internal/jobs/{pending}/lease"), json!({})).await;
    assert_eq!(request(&app,"PATCH",&format!("/api/v1/candidates/{candidate}"),Some(&sessions[0]),json!({"revision":1,"profile":{"target_headline":"Edited synthetic@example.test"},"contact":{}})).await.0,StatusCode::OK);
    let stale_result = json!({"contract_version":1,"attempt_id":stale_lease["attempt_id"],"document_id":stale_lease["document_id"],"document_version":1,"input_revision":1,"job_revision":stale_lease["job_revision"],"extraction_status":"SKIPPED","evaluation_status":"COMPLETED","scorecard":{"screening_decision":"ACCEPT","decision_explanation":"Synthetic job requirements are demonstrated.","overall_match_score":80,"categories":[{"name":"Tech Stack Alignment","score":4,"max_score":5,"assessment":"Synthetic evidence"}],"model_version":"synthetic-test"},"error_code":null});
    assert_eq!(
        internal(
            &app,
            &format!("/internal/jobs/{pending}/result"),
            stale_result
        )
        .await
        .1["status"],
        "stale"
    );
    let (_, edited, _) = request(
        &app,
        "GET",
        &format!("/api/v1/candidates/{candidate}"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert!(
        edited["target_headline"]
            .as_str()
            .unwrap()
            .starts_with("Edited")
    );
    assert!(!edited.to_string().contains("synthetic@example.test"));
    assert_eq!(edited["scorecard"]["overall_match_score"], Value::Null);
    // Imports default to dry-run, are idempotent, and never import old scores.
    let mut import = json!({"source":"synthetic-fixture","jobs":[{"source_id":"legacy-job","job":{"title":"Imported role","job_description":"Recorded job"}}],"candidates":[{"source_id":"legacy-candidate","profile":{"target_headline":"Imported candidate","scorecard":{"overall_match_score":99}},"contact":{}}]});
    let preview = request(
        &app,
        "POST",
        "/api/v1/migration/import",
        Some(&sessions[0]),
        import.clone(),
    )
    .await;
    assert_eq!(preview.0, StatusCode::OK);
    assert_eq!(preview.1["mappings"][0]["id"], Value::Null);
    import["dry_run"] = json!(false);
    let saved = request(
        &app,
        "POST",
        "/api/v1/migration/import",
        Some(&sessions[0]),
        import.clone(),
    )
    .await;
    assert_eq!(saved.0, StatusCode::OK);
    let again = request(
        &app,
        "POST",
        "/api/v1/migration/import",
        Some(&sessions[0]),
        import,
    )
    .await;
    assert_eq!(saved.1["mappings"][0]["id"], again.1["mappings"][0]["id"]);
    let imported = saved.1["mappings"][1]["id"].as_str().unwrap();
    let imported = request(
        &app,
        "GET",
        &format!("/api/v1/candidates/{imported}"),
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert_eq!(imported.1["processing_status"], "LEGACY_REVIEW");
    assert_eq!(imported.1["scorecard"]["overall_match_score"], Value::Null);
    let (_, _, cookie) = request(
        &app,
        "POST",
        "/api/v1/auth/logout",
        Some(&sessions[0]),
        json!({}),
    )
    .await;
    assert!(cookie.unwrap().contains("ats_session="));
    assert_eq!(
        request(&app, "GET", "/api/v1/jobs", Some(&sessions[0]), json!({}))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    // Development mode bypasses sign-in only for its two persistent test workspaces.
    ats_backend::auth::initialize_development(&db)
        .await
        .unwrap();
    ats_backend::auth::initialize_development(&db)
        .await
        .unwrap();
    let mut dev_config = (*state.config).clone();
    dev_config.development_mode = true;
    let mut dev_state = state.clone();
    dev_state.config = Arc::new(dev_config);
    let dev_app = api::router(dev_state);
    let dev_identity = request(&dev_app, "GET", "/api/v1/auth/me", None, json!({})).await;
    assert_eq!(dev_identity.0, StatusCode::OK);
    assert_eq!(dev_identity.1["development_mode"], true);
    assert_eq!(dev_identity.1["workspaces"].as_array().unwrap().len(), 2);
    let local_job = request(
        &dev_app,
        "POST",
        "/api/v1/jobs",
        None,
        json!({"title":"Local feature test","job_description":"Synthetic job"}),
    )
    .await;
    assert_eq!(local_job.0, StatusCode::OK);
    let switched = request(
        &dev_app,
        "POST",
        "/api/v1/auth/workspace",
        None,
        json!({"tenant_id":ats_backend::auth::DEVELOPMENT_AGENCY}),
    )
    .await;
    assert_eq!(switched.0, StatusCode::OK);
    let dev_cookie = switched.2.unwrap();
    let agency = request(
        &dev_app,
        "GET",
        "/api/v1/auth/me",
        Some(&dev_cookie),
        json!({}),
    )
    .await;
    assert_eq!(
        agency.1["user"]["tenant_id"],
        json!(ats_backend::auth::DEVELOPMENT_AGENCY)
    );
    assert_eq!(
        request(
            &dev_app,
            "GET",
            &format!("/api/v1/jobs/{}", local_job.1["id"].as_str().unwrap()),
            Some(&dev_cookie),
            json!({})
        )
        .await
        .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(
            &dev_app,
            "POST",
            "/api/v1/auth/workspace",
            None,
            json!({"tenant_id":tenant})
        )
        .await
        .0,
        StatusCode::FORBIDDEN
    );
    assert_eq!(
        request(
            &dev_app,
            "POST",
            &format!("/internal/jobs/{}/lease", Uuid::new_v4()),
            None,
            json!({})
        )
        .await
        .0,
        StatusCode::UNAUTHORIZED
    );
    // Turning the flag off rejects both anonymous requests and old developer cookies.
    assert_eq!(
        request(&app, "GET", "/api/v1/auth/me", None, json!({}))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    assert_eq!(
        request(&app, "GET", "/api/v1/auth/me", Some(&dev_cookie), json!({}))
            .await
            .0,
        StatusCode::UNAUTHORIZED
    );
    let mut cleanup = ats_backend::tenant_tx(&db, ats_backend::auth::DEVELOPMENT_CORPORATE)
        .await
        .unwrap();
    sqlx::query("DELETE FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2")
        .bind(Uuid::parse_str(local_job.1["id"].as_str().unwrap()).unwrap())
        .bind(ats_backend::auth::DEVELOPMENT_CORPORATE)
        .execute(&mut *cleanup)
        .await
        .unwrap();
    cleanup.commit().await.unwrap();
    // Synthetic workspaces remain in the isolated test database for inspection.
    let _ = tenant;
    admin.close().await;
    db.close().await;
}
