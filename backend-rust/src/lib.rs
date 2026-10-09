pub mod api;
pub mod auth;
pub mod config;
pub mod domain;
pub mod jobs;
pub mod migration;
pub mod openapi;
pub mod platform;

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::{Value, json};
use sqlx::{PgPool, Postgres, Transaction};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub objects: Arc<dyn object_store::ObjectStore>,
    pub http: reqwest::Client,
    pub config: Arc<config::Config>,
}

#[derive(Debug)]
pub struct ApiError(pub StatusCode, pub &'static str);
pub type Result<T> = std::result::Result<T, ApiError>;
impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({"detail":self.1}))).into_response()
    }
}
impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        tracing::error!(error = %error, "database operation failed");
        if let Some(db) = error.as_database_error() {
            if db.is_unique_violation() {
                return Self(StatusCode::CONFLICT, "Record already exists.");
            }
            if db.is_foreign_key_violation() {
                return Self(StatusCode::BAD_REQUEST, "Related record is unavailable.");
            }
        }
        Self(
            StatusCode::SERVICE_UNAVAILABLE,
            "Database operation failed. Please retry.",
        )
    }
}
pub fn bad(message: &'static str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, message)
}
pub fn missing() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "Record not found.")
}
pub fn hash(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    format!("{:x}", Sha256::digest(bytes))
}
pub async fn tenant_tx(db: &PgPool, tenant: Uuid) -> Result<Transaction<'_, Postgres>> {
    let mut tx = db.begin().await?;
    sqlx::query("SELECT set_config('ats.tenant_id',$1,true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await?;
    Ok(tx)
}
pub async fn audit(
    tx: &mut Transaction<'_, Postgres>,
    user: &auth::Identity,
    action: &str,
    kind: &str,
    id: impl ToString,
) -> Result<()> {
    sqlx::query("INSERT INTO ats_v2.audit_events(id,tenant_id,actor_id,actor_role,action,resource_type,resource_id) VALUES($1,$2,$3,$4,$5,$6,$7)")
        .bind(Uuid::new_v4()).bind(user.tenant_id).bind(user.user_id).bind(&user.role).bind(action).bind(kind).bind(id.to_string()).execute(&mut **tx).await?;
    Ok(())
}
pub fn text(value: &Value, key: &str) -> String {
    value
        .get(key)
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_owned()
}
