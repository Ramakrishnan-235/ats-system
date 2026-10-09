use crate::{AppState, Result, auth, domain, jobs, platform};
use axum::http::{HeaderValue, Method};
use axum::{
    Json, Router,
    extract::{DefaultBodyLimit, State},
    middleware,
    routing::{get, post},
};
use serde_json::{Value, json};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub fn router(state: AppState) -> Router {
    let business = Router::new()
        .route("/auth/me", get(auth::me))
        .route("/auth/workspace", post(auth::switch_workspace))
        .route("/jobs", get(domain::list_jobs).post(domain::create_job))
        .route("/jobs/{id}", get(domain::get_job).patch(domain::update_job))
        .route(
            "/jobs/{id}/candidates",
            get(domain::job_candidates).post(domain::add_job_candidate),
        )
        .route(
            "/jobs/{job}/candidates/{candidate}",
            axum::routing::delete(domain::remove_job_candidate),
        )
        .route(
            "/jobs/{job}/candidates/{candidate}/stage",
            axum::routing::patch(domain::job_candidate_stage),
        )
        .route("/candidates", get(domain::list_candidates))
        .route("/candidates/upload-async", post(jobs::upload))
        .route("/candidates/tasks/{id}", get(jobs::task_status))
        .route(
            "/candidates/{id}",
            get(domain::get_candidate).patch(domain::edit_candidate),
        )
        .route("/candidates/{id}/scorecard", get(domain::get_scorecard))
        .route("/candidates/{id}/notes", post(domain::add_note))
        .route(
            "/candidates/{id}/stage",
            axum::routing::patch(domain::candidate_stage),
        )
        .route("/candidates/{id}/resume-pdf", get(jobs::resume))
        .route("/candidates/{id}/locate-citation", post(jobs::citation))
        .route("/match/evaluate-job", post(jobs::evaluate_job))
        .route("/dashboard/stats", get(platform::dashboard))
        .route("/analytics", get(platform::analytics))
        .route("/migration/import", post(crate::migration::import))
        .route(
            "/settings/workspace",
            axum::routing::patch(platform::update_workspace),
        )
        .route("/audit/logs", get(platform::audit_logs))
        .route("/taxonomy/version", get(platform::taxonomy_stats))
        .route(
            "/taxonomy/skills",
            get(platform::taxonomy_list).post(platform::taxonomy_create),
        )
        .route(
            "/taxonomy/skills/{id}/approve",
            axum::routing::patch(platform::taxonomy_approve),
        )
        .route(
            "/taxonomy/skills/{id}/reject",
            axum::routing::patch(platform::taxonomy_reject),
        )
        .route(
            "/taxonomy/skills/{id}/aliases",
            post(platform::taxonomy_alias),
        )
        .route(
            "/settings/members",
            get(platform::members).post(platform::add_member),
        )
        .route(
            "/clients",
            get(platform::clients).post(platform::create_client),
        )
        .route(
            "/submissions",
            get(platform::submissions).post(platform::create_submission),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::authenticated,
        ));
    let internal = Router::new()
        .route("/jobs/{id}/lease", post(jobs::lease))
        .route("/jobs/{id}/heartbeat", post(jobs::heartbeat))
        .route("/jobs/{id}/document", get(jobs::worker_document))
        .route("/jobs/{id}/result", post(jobs::result))
        .route("/jobs/{id}/artifact", post(jobs::artifact))
        .route("/documents/{id}", get(jobs::internal_document))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::service_auth,
        ));
    let cors = CorsLayer::new()
        .allow_origin(
            state
                .config
                .origins
                .iter()
                .filter_map(|v| v.parse::<HeaderValue>().ok())
                .collect::<Vec<_>>(),
        )
        .allow_credentials(true)
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("idempotency-key"),
        ]);
    let max = state.config.max_upload + 65536;
    Router::new()
        .route(
            "/openapi.json",
            get(|| async { Json(crate::openapi::document()) }),
        )
        .route(
            "/health",
            get(|| async { Json(json!({"status":"OK","engine":"ATS Rust core"})) }),
        )
        .route("/ready", get(ready))
        .route(
            "/api/v1/auth/config",
            get({
                let enabled = state.config.allow_signup;
                move || async move { Json(json!({"registration_enabled":enabled})) }
            }),
        )
        .route("/api/v1/auth/register", post(auth::register))
        .route("/api/v1/auth/login", post(auth::login))
        .route("/api/v1/auth/logout", post(auth::logout))
        .nest("/api/v1", business)
        .nest("/internal", internal)
        .layer(middleware::from_fn_with_state(state.clone(), auth::csrf))
        .layer(DefaultBodyLimit::max(max))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
async fn ready(State(state): State<AppState>) -> Result<Json<Value>> {
    sqlx::query("SELECT 1").execute(&state.db).await?;
    Ok(Json(json!({"status":"READY"})))
}
