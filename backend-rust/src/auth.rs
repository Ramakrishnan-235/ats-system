use crate::{ApiError, AppState, Result, bad, hash};
use argon2::{
    Argon2, PasswordHasher, PasswordVerifier,
    password_hash::{PasswordHash, SaltString, rand_core::OsRng},
};
use axum::{
    Extension, Json,
    extract::{Request, State},
    http::{HeaderMap, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::Row;
use subtle::ConstantTimeEq;
use uuid::Uuid;

pub const DEVELOPMENT_USER: Uuid = Uuid::from_u128(0xade00000000000000000000000000001);
pub const DEVELOPMENT_CORPORATE: Uuid = Uuid::from_u128(0xade00000000000000000000000000002);
pub const DEVELOPMENT_AGENCY: Uuid = Uuid::from_u128(0xade00000000000000000000000000003);

pub async fn initialize_development(db: &sqlx::PgPool) -> Result<()> {
    let mut tx = db.begin().await?;
    sqlx::query("INSERT INTO ats_v2.users(id,email,name,password_hash) VALUES($1,'developer@local.test','Local Developer','login-disabled') ON CONFLICT(id) DO NOTHING")
        .bind(DEVELOPMENT_USER).execute(&mut *tx).await?;
    let seed: serde_json::Value = serde_json::from_str(include_str!("../taxonomy-seed.json"))
        .map_err(|_| bad("Taxonomy seed is invalid."))?;
    for (tenant, name, kind) in [
        (
            DEVELOPMENT_CORPORATE,
            "Local Corporate Testing",
            "corporate",
        ),
        (DEVELOPMENT_AGENCY, "Local Agency Testing", "agency"),
    ] {
        sqlx::query(
            "INSERT INTO ats_v2.tenants(id,name,kind) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING",
        )
        .bind(tenant)
        .bind(name)
        .bind(kind)
        .execute(&mut *tx)
        .await?;
        sqlx::query("INSERT INTO ats_v2.memberships(tenant_id,user_id,role) VALUES($1,$2,'admin') ON CONFLICT DO NOTHING")
            .bind(tenant).bind(DEVELOPMENT_USER).execute(&mut *tx).await?;
        sqlx::query("SELECT set_config('ats.tenant_id',$1,true)")
            .bind(tenant.to_string())
            .execute(&mut *tx)
            .await?;
        for skill in seed
            .as_array()
            .ok_or_else(|| bad("Taxonomy seed is invalid."))?
        {
            sqlx::query("INSERT INTO ats_v2.taxonomy(id,tenant_id,canonical_name,category,aliases,is_ambiguous,source) VALUES($1,$2,$3,$4,$5,$6,'builtin') ON CONFLICT(tenant_id,canonical_name) DO NOTHING")
                .bind(Uuid::new_v4()).bind(tenant).bind(crate::text(skill,"canonical_name")).bind(crate::text(skill,"category"))
                .bind(skill.get("aliases").cloned().unwrap_or(json!([]))).bind(skill.get("is_ambiguous").and_then(serde_json::Value::as_bool).unwrap_or(false)).execute(&mut *tx).await?;
        }
    }
    tx.commit().await?;
    Ok(())
}

#[derive(Clone, Serialize)]
pub struct Identity {
    pub user_id: Uuid,
    pub tenant_id: Uuid,
    pub role: String,
    pub name: String,
    pub email: String,
}
impl Identity {
    pub fn write(&self) -> Result<()> {
        if !["admin", "recruiter"].contains(&self.role.as_str()) {
            return Err(ApiError(
                StatusCode::FORBIDDEN,
                "Recruiter permission required.",
            ));
        }
        Ok(())
    }
    pub fn admin(&self) -> Result<()> {
        if self.role != "admin" {
            return Err(ApiError(
                StatusCode::FORBIDDEN,
                "Administrator permission required.",
            ));
        }
        Ok(())
    }
    pub fn pii(&self) -> Result<()> {
        if !["admin", "recruiter", "compliance"].contains(&self.role.as_str()) {
            return Err(ApiError(
                StatusCode::FORBIDDEN,
                "Personal information access denied.",
            ));
        }
        Ok(())
    }
}

pub fn token(headers: &HeaderMap) -> Option<String> {
    if let Some(v) = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
    {
        return Some(v.to_owned());
    }
    headers
        .get(header::COOKIE)?
        .to_str()
        .ok()?
        .split(';')
        .find_map(|v| v.trim().strip_prefix("ats_session=").map(str::to_owned))
}
pub async fn authenticated(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response> {
    if state.config.development_mode {
        let tenant = if let Some(token) = token(request.headers()) {
            sqlx::query_scalar("SELECT tenant_id FROM ats_v2.sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>now() AND tenant_id IN ($3,$4)")
                .bind(hash(token.as_bytes())).bind(DEVELOPMENT_USER).bind(DEVELOPMENT_CORPORATE).bind(DEVELOPMENT_AGENCY)
                .fetch_optional(&state.db).await?.unwrap_or(DEVELOPMENT_CORPORATE)
        } else {
            DEVELOPMENT_CORPORATE
        };
        request.extensions_mut().insert(Identity {
            user_id: DEVELOPMENT_USER,
            tenant_id: tenant,
            role: "admin".into(),
            name: "Local Developer".into(),
            email: "developer@local.test".into(),
        });
        return Ok(next.run(request).await);
    }
    let token = token(request.headers())
        .ok_or(ApiError(StatusCode::UNAUTHORIZED, "Sign in to continue."))?;
    let row=sqlx::query("SELECT s.user_id,s.tenant_id,m.role,u.name,u.email FROM ats_v2.sessions s JOIN ats_v2.memberships m ON m.user_id=s.user_id AND m.tenant_id=s.tenant_id JOIN ats_v2.users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>now() AND s.user_id<>$2")
        .bind(hash(token.as_bytes())).bind(DEVELOPMENT_USER).fetch_optional(&state.db).await?.ok_or(ApiError(StatusCode::UNAUTHORIZED,"Session expired. Sign in again."))?;
    request.extensions_mut().insert(Identity {
        user_id: row.get("user_id"),
        tenant_id: row.get("tenant_id"),
        role: row.get("role"),
        name: row.get("name"),
        email: row.get("email"),
    });
    Ok(next.run(request).await)
}
pub async fn service_auth(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Result<Response> {
    let supplied = request
        .headers()
        .get("x-service-key")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if !bool::from(
        hash(supplied.as_bytes())
            .as_bytes()
            .ct_eq(hash(state.config.service_key.as_bytes()).as_bytes()),
    ) {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "Invalid service identity.",
        ));
    }
    Ok(next.run(request).await)
}
pub async fn csrf(State(state): State<AppState>, request: Request, next: Next) -> Result<Response> {
    if !matches!(
        *request.method(),
        axum::http::Method::GET | axum::http::Method::HEAD | axum::http::Method::OPTIONS
    ) {
        if let Some(origin) = request.headers().get(header::ORIGIN) {
            if !state
                .config
                .origins
                .iter()
                .any(|allowed| origin.as_bytes() == allowed.as_bytes())
            {
                return Err(ApiError(
                    StatusCode::FORBIDDEN,
                    "Request origin is not allowed.",
                ));
            }
        } else if request.headers().contains_key(header::COOKIE) {
            return Err(ApiError(
                StatusCode::FORBIDDEN,
                "Browser mutations require an Origin header.",
            ));
        }
    }
    Ok(next.run(request).await)
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct Credentials {
    pub email: String,
    pub password: String,
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub workspace_name: String,
    #[serde(default = "corporate")]
    pub workspace_kind: String,
}
fn corporate() -> String {
    "corporate".into()
}
fn cookie(state: &AppState, value: &str, age: i32) -> String {
    format!(
        "ats_session={value}; Path=/; HttpOnly; SameSite=Lax; Max-Age={age}{}",
        if state.config.secure_cookie {
            "; Secure"
        } else {
            ""
        }
    )
}
async fn issue_session(state: &AppState, user_id: Uuid, tenant_id: Uuid) -> Result<Response> {
    let value = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    sqlx::query("INSERT INTO ats_v2.sessions(token_hash,user_id,tenant_id,expires_at) VALUES($1,$2,$3,now()+interval '12 hours')")
        .bind(hash(value.as_bytes())).bind(user_id).bind(tenant_id).execute(&state.db).await?;
    Ok((
        [(header::SET_COOKIE, cookie(state, &value, 43200))],
        Json(json!({"status":"authenticated"})),
    )
        .into_response())
}
async fn auth_limit(state: &AppState, identity: &str) -> Result<()> {
    let count:i32=sqlx::query_scalar("INSERT INTO ats_v2.auth_attempts(identity_hash,attempts) VALUES($1,1) ON CONFLICT(identity_hash) DO UPDATE SET attempts=CASE WHEN auth_attempts.window_start < now()-interval '15 minutes' THEN 1 ELSE auth_attempts.attempts+1 END,window_start=CASE WHEN auth_attempts.window_start < now()-interval '15 minutes' THEN now() ELSE auth_attempts.window_start END RETURNING attempts")
        .bind(hash(identity.as_bytes())).fetch_one(&state.db).await?;
    if count > 10 {
        return Err(ApiError(
            StatusCode::TOO_MANY_REQUESTS,
            "Too many sign-in attempts. Retry in 15 minutes.",
        ));
    }
    Ok(())
}
pub async fn register(
    State(state): State<AppState>,
    Json(input): Json<Credentials>,
) -> Result<Response> {
    if !state.config.allow_signup {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Workspace registration is disabled.",
        ));
    }
    validate_credentials(&input)?;
    if input.workspace_name.trim().is_empty()
        || input.workspace_name.len() > 200
        || input.name.trim().is_empty()
        || input.name.len() > 200
    {
        return Err(bad("Name and workspace name are required."));
    }
    if !["corporate", "agency"].contains(&input.workspace_kind.as_str()) {
        return Err(bad("Invalid workspace type."));
    }
    let email = input.email.trim().to_lowercase();
    auth_limit(&state, &format!("register:{email}")).await?;
    let password = input.password;
    let encoded = tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
            .map(|v| v.to_string())
    })
    .await
    .map_err(|_| bad("Password processing failed."))?
    .map_err(|_| bad("Password processing failed."))?;
    let user = Uuid::new_v4();
    let tenant = Uuid::new_v4();
    let mut tx = state.db.begin().await?;
    sqlx::query("INSERT INTO ats_v2.users(id,email,name,password_hash) VALUES($1,$2,$3,$4)")
        .bind(user)
        .bind(email)
        .bind(input.name.trim())
        .bind(encoded)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO ats_v2.tenants(id,name,kind) VALUES($1,$2,$3)")
        .bind(tenant)
        .bind(input.workspace_name.trim())
        .bind(input.workspace_kind)
        .execute(&mut *tx)
        .await?;
    sqlx::query("INSERT INTO ats_v2.memberships(tenant_id,user_id,role) VALUES($1,$2,'admin')")
        .bind(tenant)
        .bind(user)
        .execute(&mut *tx)
        .await?;
    sqlx::query("SELECT set_config('ats.tenant_id',$1,true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await?;
    let seed: serde_json::Value = serde_json::from_str(include_str!("../taxonomy-seed.json"))
        .map_err(|_| bad("Taxonomy seed is invalid."))?;
    for skill in seed
        .as_array()
        .ok_or_else(|| bad("Taxonomy seed is invalid."))?
    {
        sqlx::query("INSERT INTO ats_v2.taxonomy(id,tenant_id,canonical_name,category,aliases,is_ambiguous,source) VALUES($1,$2,$3,$4,$5,$6,'builtin')")
            .bind(Uuid::new_v4()).bind(tenant).bind(crate::text(skill,"canonical_name")).bind(crate::text(skill,"category"))
            .bind(skill.get("aliases").cloned().unwrap_or(json!([]))).bind(skill.get("is_ambiguous").and_then(serde_json::Value::as_bool).unwrap_or(false)).execute(&mut *tx).await?;
    }
    tx.commit().await?;
    issue_session(&state, user, tenant).await
}
fn validate_credentials(input: &Credentials) -> Result<()> {
    if input.email.len() > 254
        || !input.email.contains('@')
        || input.password.len() < 12
        || input.password.len() > 256
    {
        return Err(bad(
            "Use a valid email and a password of 12–256 characters.",
        ));
    }
    Ok(())
}
pub async fn login(
    State(state): State<AppState>,
    Json(input): Json<Credentials>,
) -> Result<Response> {
    let email = input.email.trim().to_lowercase();
    if email.len() > 254 || input.password.len() > 256 {
        return Err(bad("Invalid credentials."));
    }
    auth_limit(&state, &email).await?;
    let row=sqlx::query("SELECT u.id,u.password_hash,m.tenant_id FROM ats_v2.users u JOIN ats_v2.memberships m ON m.user_id=u.id WHERE u.email=$1 ORDER BY m.tenant_id LIMIT 1")
        .bind(&email).fetch_optional(&state.db).await?;
    let password = input.password;
    // Perform the same expensive password operation for unknown identities.
    let encoded = row.as_ref().map(|r| r.get::<String, _>("password_hash"));
    let valid = tokio::task::spawn_blocking(move || match encoded {
        Some(v) => PasswordHash::new(&v).is_ok_and(|v| {
            Argon2::default()
                .verify_password(password.as_bytes(), &v)
                .is_ok()
        }),
        None => {
            let _ = Argon2::default()
                .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng));
            false
        }
    })
    .await
    .map_err(|_| bad("Password processing failed."))?;
    if !valid {
        return Err(ApiError(
            StatusCode::UNAUTHORIZED,
            "Invalid email or password.",
        ));
    }
    let row = row.unwrap();
    sqlx::query("DELETE FROM ats_v2.auth_attempts WHERE identity_hash=$1")
        .bind(hash(email.as_bytes()))
        .execute(&state.db)
        .await?;
    issue_session(&state, row.get("id"), row.get("tenant_id")).await
}
pub async fn logout(State(state): State<AppState>, headers: HeaderMap) -> Result<Response> {
    if let Some(t) = token(&headers) {
        sqlx::query("DELETE FROM ats_v2.sessions WHERE token_hash=$1")
            .bind(hash(t.as_bytes()))
            .execute(&state.db)
            .await?;
    }
    Ok((
        [(header::SET_COOKIE, cookie(&state, "", 0))],
        Json(json!({"status":"signed_out"})),
    )
        .into_response())
}
pub async fn me(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<serde_json::Value>> {
    let rows=sqlx::query("SELECT t.id,t.name,t.kind,m.role FROM ats_v2.tenants t JOIN ats_v2.memberships m ON m.tenant_id=t.id WHERE m.user_id=$1 ORDER BY t.name").bind(user.user_id).fetch_all(&state.db).await?;
    Ok(Json(
        json!({"user":user,"development_mode":state.config.development_mode,"workspaces":rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"kind":r.get::<String,_>("kind"),"role":r.get::<String,_>("role")})).collect::<Vec<_>>()}),
    ))
}
#[derive(Deserialize)]
pub struct Switch {
    pub tenant_id: Uuid,
}
pub async fn switch_workspace(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    headers: HeaderMap,
    Json(input): Json<Switch>,
) -> Result<Response> {
    if state.config.development_mode {
        if ![DEVELOPMENT_CORPORATE, DEVELOPMENT_AGENCY].contains(&input.tenant_id) {
            return Err(ApiError(
                StatusCode::FORBIDDEN,
                "Choose a local testing workspace.",
            ));
        }
        return issue_session(&state, DEVELOPMENT_USER, input.tenant_id).await;
    }
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM ats_v2.memberships WHERE tenant_id=$1 AND user_id=$2)",
    )
    .bind(input.tenant_id)
    .bind(user.user_id)
    .fetch_one(&state.db)
    .await?;
    if !exists {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Workspace membership required.",
        ));
    }
    sqlx::query("UPDATE ats_v2.sessions SET tenant_id=$1 WHERE token_hash=$2")
        .bind(input.tenant_id)
        .bind(hash(token(&headers).unwrap_or_default().as_bytes()))
        .execute(&state.db)
        .await?;
    Ok(Json(json!({"status":"switched"})).into_response())
}
