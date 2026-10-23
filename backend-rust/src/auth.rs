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
use serde_json::{Value, json};
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

    pub fn can_manage_team(&self) -> bool {
        self.role == "admin"
    }

    pub fn can_create_jobs_and_edit_applications(&self) -> bool {
        ["admin", "recruiter"].contains(&self.role.as_str())
    }

    pub fn can_reveal_contacts(&self) -> bool {
        ["admin", "recruiter", "compliance"].contains(&self.role.as_str())
    }

    pub fn can_download_original_resumes(&self) -> bool {
        ["admin", "recruiter", "compliance"].contains(&self.role.as_str())
    }

    pub fn can_read_candidate_evaluations(&self) -> bool {
        ["admin", "recruiter", "interviewer", "viewer", "compliance"].contains(&self.role.as_str())
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
    if let Some(tok) = token(request.headers()) {
        let tok_hash = hash(tok.as_bytes());
        let row = sqlx::query(
            "SELECT s.user_id, s.tenant_id, m.role, u.name, u.email \
             FROM ats_v2.sessions s \
             JOIN ats_v2.memberships m ON m.user_id = s.user_id AND m.tenant_id = s.tenant_id \
             JOIN ats_v2.users u ON u.id = s.user_id \
             WHERE s.token_hash = $1 AND s.expires_at > now()",
        )
        .bind(&tok_hash)
        .fetch_optional(&state.db)
        .await?;

        if let Some(r) = row {
            let uid: Uuid = r.get("user_id");
            if !state.config.development_mode && uid == DEVELOPMENT_USER {
                return Err(ApiError(
                    StatusCode::UNAUTHORIZED,
                    "Developer sessions are not permitted in production mode.",
                ));
            }
            request.extensions_mut().insert(Identity {
                user_id: uid,
                tenant_id: r.get("tenant_id"),
                role: r.get("role"),
                name: r.get("name"),
                email: r.get("email"),
            });
            return Ok(next.run(request).await);
        } else {
            return Err(ApiError(
                StatusCode::UNAUTHORIZED,
                "Session expired or revoked. Sign in again.",
            ));
        }
    }

    if state.config.development_mode {
        request.extensions_mut().insert(Identity {
            user_id: DEVELOPMENT_USER,
            tenant_id: DEVELOPMENT_CORPORATE,
            role: "admin".into(),
            name: "Local Developer".into(),
            email: "developer@local.test".into(),
        });
        return Ok(next.run(request).await);
    }

    Err(ApiError(StatusCode::UNAUTHORIZED, "Sign in to continue."))
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
    #[serde(default)]
    pub invitation_token: Option<String>,
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
        Json(json!({
            "status": "authenticated",
            "token": value,
            "user_id": user_id,
            "tenant_id": tenant_id
        })),
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
    let email = input.email.trim().to_lowercase();
    auth_limit(&state, &format!("register:{email}")).await?;

    let existing: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM ats_v2.users WHERE email = $1)")
            .bind(&email)
            .fetch_one(&state.db)
            .await?;
    if existing {
        return Err(bad("An account with this email already exists."));
    }

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

    // Check if registering via an invitation token
    if let Some(inv_tok) = input
        .invitation_token
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        let inv_hash = hash(inv_tok.as_bytes());
        let mut tx = state.db.begin().await?;

        let inv_row = sqlx::query("SELECT id, tenant_id, email, role, status, expires_at FROM ats_v2.invitations WHERE token_hash = $1 FOR UPDATE")
            .bind(&inv_hash)
            .fetch_optional(&mut *tx)
            .await?;

        let inv = inv_row.ok_or_else(|| bad("Invalid invitation token."))?;
        let inv_id: Uuid = inv.get("id");
        let tenant_id: Uuid = inv.get("tenant_id");
        let inv_email: String = inv.get("email");
        let inv_role: String = inv.get("role");
        let inv_status: String = inv.get("status");
        let expires_at: chrono::DateTime<chrono::Utc> = inv.get("expires_at");

        if inv_status == "accepted" {
            return Err(bad(
                "Invitation has already been accepted and cannot be reused.",
            ));
        }
        if inv_status == "revoked" {
            return Err(bad("Invitation has been revoked."));
        }
        if inv_status == "expired" || expires_at < chrono::Utc::now() {
            sqlx::query("UPDATE ats_v2.invitations SET status = 'expired' WHERE id = $1")
                .bind(inv_id)
                .execute(&mut *tx)
                .await?;
            tx.commit().await?;
            return Err(bad("Invitation has expired."));
        }
        if inv_email.to_lowercase() != email {
            return Err(bad("Email address does not match invitation recipient."));
        }

        sqlx::query("INSERT INTO ats_v2.users(id, email, name, password_hash, email_verified) VALUES($1, $2, $3, $4, true)")
            .bind(user)
            .bind(&email)
            .bind(if input.name.trim().is_empty() { &email } else { input.name.trim() })
            .bind(encoded)
            .execute(&mut *tx)
            .await?;

        sqlx::query("INSERT INTO ats_v2.memberships(tenant_id, user_id, role) VALUES($1, $2, $3)")
            .bind(tenant_id)
            .bind(user)
            .bind(&inv_role)
            .execute(&mut *tx)
            .await?;

        sqlx::query("UPDATE ats_v2.invitations SET status = 'accepted', accepted_at = now(), updated_at = now() WHERE id = $1")
            .bind(inv_id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        return issue_session(&state, user, tenant_id).await;
    }

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

    let tenant = Uuid::new_v4();
    let mut tx = state.db.begin().await?;
    sqlx::query("INSERT INTO ats_v2.users(id,email,name,password_hash) VALUES($1,$2,$3,$4)")
        .bind(user)
        .bind(&email)
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

#[derive(Deserialize, utoipa::ToSchema)]
pub struct AcceptInvitationInput {
    pub token: String,
}

pub async fn accept_invitation(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    headers: HeaderMap,
    Json(input): Json<AcceptInvitationInput>,
) -> Result<Json<Value>> {
    let raw_token = input.token.trim();
    if raw_token.is_empty() {
        return Err(bad("Invitation token is required."));
    }
    let token_hash = hash(raw_token.as_bytes());

    let mut tx = state.db.begin().await?;

    let inv_row = sqlx::query("SELECT id, tenant_id, email, role, status, expires_at FROM ats_v2.invitations WHERE token_hash = $1 FOR UPDATE")
        .bind(&token_hash)
        .fetch_optional(&mut *tx)
        .await?;

    let inv = inv_row.ok_or_else(|| bad("Invalid invitation token."))?;
    let inv_id: Uuid = inv.get("id");
    let tenant_id: Uuid = inv.get("tenant_id");
    let inv_email: String = inv.get("email");
    let role: String = inv.get("role");
    let status: String = inv.get("status");
    let expires_at: chrono::DateTime<chrono::Utc> = inv.get("expires_at");

    if status == "accepted" {
        return Err(bad(
            "Invitation has already been accepted and cannot be reused.",
        ));
    }
    if status == "revoked" {
        return Err(bad("Invitation has been revoked."));
    }
    if status == "expired" || expires_at < chrono::Utc::now() {
        sqlx::query("UPDATE ats_v2.invitations SET status = 'expired' WHERE id = $1")
            .bind(inv_id)
            .execute(&mut *tx)
            .await?;
        tx.commit().await?;
        return Err(bad("Invitation has expired."));
    }

    if user.email.trim().to_lowercase() != inv_email.trim().to_lowercase() {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Invitation email does not match the signed-in account.",
        ));
    }

    let already_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM ats_v2.memberships WHERE tenant_id = $1 AND user_id = $2)",
    )
    .bind(tenant_id)
    .bind(user.user_id)
    .fetch_one(&mut *tx)
    .await?;

    if already_member {
        return Err(bad("You are already a member of this workspace."));
    }

    // Add membership for the accepting user
    sqlx::query("INSERT INTO ats_v2.memberships(tenant_id, user_id, role) VALUES($1, $2, $3)")
        .bind(tenant_id)
        .bind(user.user_id)
        .bind(&role)
        .execute(&mut *tx)
        .await?;

    // Mark invitation accepted
    sqlx::query("UPDATE ats_v2.invitations SET status = 'accepted', accepted_at = now(), updated_at = now() WHERE id = $1")
        .bind(inv_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE ats_v2.users SET email_verified = true WHERE id = $1")
        .bind(user.user_id)
        .execute(&mut *tx)
        .await?;

    // Update current session's tenant_id if available
    if let Some(tok) = token(&headers) {
        sqlx::query(
            "UPDATE ats_v2.sessions SET tenant_id = $1 WHERE token_hash = $2 AND user_id = $3",
        )
        .bind(tenant_id)
        .bind(hash(tok.as_bytes()))
        .bind(user.user_id)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    Ok(Json(json!({
        "status": "accepted",
        "workspace_id": tenant_id,
        "role": role,
        "invitation_id": inv_id
    })))
}

pub async fn inspect_invitation(
    State(state): State<AppState>,
    axum::extract::Path(token_val): axum::extract::Path<String>,
) -> Result<Json<Value>> {
    let token_hash = hash(token_val.trim().as_bytes());
    let row = sqlx::query(
        "SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.expires_at, t.name as workspace_name \
         FROM ats_v2.invitations i \
         JOIN ats_v2.tenants t ON t.id = i.tenant_id \
         WHERE i.token_hash = $1"
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or(ApiError(StatusCode::NOT_FOUND, "Invitation not found."))?;
    let status: String = row.get("status");
    let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");

    if status == "accepted" {
        return Err(bad(
            "Invitation has already been accepted and cannot be reused.",
        ));
    }
    if status == "revoked" {
        return Err(bad("Invitation has been revoked."));
    }
    if status == "expired" || expires_at < chrono::Utc::now() {
        return Err(bad("Invitation has expired."));
    }

    Ok(Json(json!({
        "id": row.get::<Uuid, _>("id"),
        "workspace_id": row.get::<Uuid, _>("tenant_id"),
        "workspace_name": row.get::<String, _>("workspace_name"),
        "email": row.get::<String, _>("email"),
        "role": row.get::<String, _>("role"),
        "status": status,
        "expires_at": expires_at
    })))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct PasswordResetRequest {
    pub email: String,
}

pub async fn password_reset_request(
    State(state): State<AppState>,
    Json(input): Json<PasswordResetRequest>,
) -> Result<Json<Value>> {
    let email = input.email.trim().to_lowercase();
    if email.is_empty() || !email.contains('@') {
        return Err(bad("Enter a valid email address."));
    }
    auth_limit(&state, &format!("reset-req:{email}")).await?;

    let user_row = sqlx::query("SELECT id, name FROM ats_v2.users WHERE email = $1")
        .bind(&email)
        .fetch_optional(&state.db)
        .await?;

    if let Some(user) = user_row {
        let user_id: Uuid = user.get("id");
        let raw_token = format!("rst_{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
        let token_hash = hash(raw_token.as_bytes());
        let task_id = Uuid::new_v4();
        let token_id = Uuid::new_v4();

        let mut tx = state.db.begin().await?;

        // Invalidate prior unused tokens
        sqlx::query(
            "DELETE FROM ats_v2.password_reset_tokens WHERE user_id = $1 AND used_at IS NULL",
        )
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

        // Insert new reset token (1 hour expiry)
        sqlx::query("INSERT INTO ats_v2.password_reset_tokens(id, user_id, token_hash, expires_at) VALUES($1, $2, $3, now() + interval '1 hour')")
            .bind(token_id)
            .bind(user_id)
            .bind(&token_hash)
            .execute(&mut *tx)
            .await?;

        // Save email delivery task in same transaction
        let payload = json!({
            "token_id": token_id,
            "user_id": user_id,
            "email": email,
            "token": raw_token,
            "expires_in": "1 hour"
        });
        sqlx::query("INSERT INTO ats_v2.email_tasks(id, recipient_email, template, payload, status) VALUES($1, $2, 'password_reset', $3, 'queued')")
            .bind(task_id)
            .bind(&email)
            .bind(payload)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
    } else {
        // OWASP timing defense: perform dummy Argon2 operation
        tokio::task::spawn_blocking(|| {
            let _ = Argon2::default()
                .hash_password(b"dummy-timing-password", &SaltString::generate(&mut OsRng));
        })
        .await
        .ok();
    }

    // OWASP constant response: never disclose whether an account exists
    Ok(Json(json!({
        "status": "ok",
        "message": "If an account with that email exists, password reset instructions have been sent."
    })))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct PasswordResetConfirm {
    pub token: String,
    pub password: String,
}

pub async fn password_reset_confirm(
    State(state): State<AppState>,
    Json(input): Json<PasswordResetConfirm>,
) -> Result<Json<Value>> {
    let raw_token = input.token.trim();
    if raw_token.is_empty() {
        return Err(bad("Reset token is required."));
    }
    if input.password.len() < 12 || input.password.len() > 256 {
        return Err(bad("Password must be between 12 and 256 characters."));
    }
    auth_limit(&state, "reset-confirm").await?;

    let token_hash = hash(raw_token.as_bytes());
    let mut tx = state.db.begin().await?;

    let row = sqlx::query("SELECT id, user_id, expires_at, used_at FROM ats_v2.password_reset_tokens WHERE token_hash = $1 FOR UPDATE")
        .bind(&token_hash)
        .fetch_optional(&mut *tx)
        .await?;

    let row = row.ok_or_else(|| bad("Invalid or expired password reset token."))?;
    let token_id: Uuid = row.get("id");
    let user_id: Uuid = row.get("user_id");
    let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
    let used_at: Option<chrono::DateTime<chrono::Utc>> = row.get("used_at");

    if used_at.is_some() {
        return Err(bad(
            "This password reset token has already been used and cannot be reused.",
        ));
    }
    if expires_at < chrono::Utc::now() {
        return Err(bad("This password reset token has expired."));
    }

    let password = input.password;
    let encoded = tokio::task::spawn_blocking(move || {
        Argon2::default()
            .hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng))
            .map(|v| v.to_string())
    })
    .await
    .map_err(|_| bad("Password processing failed."))?
    .map_err(|_| bad("Password processing failed."))?;

    // Update password
    sqlx::query("UPDATE ats_v2.users SET password_hash = $1 WHERE id = $2")
        .bind(encoded)
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Mark token as used
    sqlx::query("UPDATE ats_v2.password_reset_tokens SET used_at = now() WHERE id = $1")
        .bind(token_id)
        .execute(&mut *tx)
        .await?;

    // Invalidate all active sessions for this user (OWASP password-recovery practice)
    sqlx::query("DELETE FROM ats_v2.sessions WHERE user_id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    // Delete any other unused reset tokens for this user
    sqlx::query("DELETE FROM ats_v2.password_reset_tokens WHERE user_id = $1 AND used_at IS NULL")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "status": "success",
        "message": "Your password has been reset successfully. Please sign in with your new password."
    })))
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct VerifyEmailInput {
    pub token: String,
}

pub async fn verify_email_confirm(
    State(state): State<AppState>,
    Json(input): Json<VerifyEmailInput>,
) -> Result<Json<Value>> {
    let raw_token = input.token.trim();
    if raw_token.is_empty() {
        return Err(bad("Verification token is required."));
    }
    let token_hash = hash(raw_token.as_bytes());
    let mut tx = state.db.begin().await?;

    let row = sqlx::query("SELECT id, user_id, expires_at, used_at FROM ats_v2.email_verification_tokens WHERE token_hash = $1 FOR UPDATE")
        .bind(&token_hash)
        .fetch_optional(&mut *tx)
        .await?;

    let row = row.ok_or_else(|| bad("Invalid or expired verification token."))?;
    let token_id: Uuid = row.get("id");
    let user_id: Uuid = row.get("user_id");
    let expires_at: chrono::DateTime<chrono::Utc> = row.get("expires_at");
    let used_at: Option<chrono::DateTime<chrono::Utc>> = row.get("used_at");

    if used_at.is_some() {
        return Err(bad(
            "This verification token has already been used and cannot be reused.",
        ));
    }
    if expires_at < chrono::Utc::now() {
        return Err(bad("This verification token has expired."));
    }

    sqlx::query("UPDATE ats_v2.email_verification_tokens SET used_at = now() WHERE id = $1")
        .bind(token_id)
        .execute(&mut *tx)
        .await?;

    sqlx::query("UPDATE ats_v2.users SET email_verified = true WHERE id = $1")
        .bind(user_id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;

    Ok(Json(json!({
        "status": "verified",
        "message": "Email verified successfully."
    })))
}

pub async fn list_email_tasks(State(state): State<AppState>) -> Result<Json<Value>> {
    if !state.config.development_mode {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Email task inspection is only permitted in development mode.",
        ));
    }
    let rows = sqlx::query(
        "SELECT id, tenant_id, recipient_email, template, payload, status, attempts, available_at, sent_at, created_at \
         FROM ats_v2.email_tasks \
         ORDER BY created_at DESC \
         LIMIT 50"
    )
    .fetch_all(&state.db)
    .await?;

    Ok(Json(json!(
        rows.iter()
            .map(|r| json!({
                "id": r.get::<Uuid, _>("id"),
                "tenant_id": r.get::<Option<Uuid>, _>("tenant_id"),
                "recipient_email": r.get::<String, _>("recipient_email"),
                "template": r.get::<String, _>("template"),
                "payload": r.get::<serde_json::Value, _>("payload"),
                "status": r.get::<String, _>("status"),
                "attempts": r.get::<i32, _>("attempts"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            }))
            .collect::<Vec<_>>()
    )))
}
