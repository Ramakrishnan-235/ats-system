use crate::{ApiError, AppState, Result, audit, auth::Identity, bad, missing, tenant_tx, text};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use uuid::Uuid;

pub async fn update_workspace(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(v): Json<Value>,
) -> Result<Json<Value>> {
    user.admin()?;
    let name = text(&v, "name");
    if name.trim().is_empty() || name.len() > 200 {
        return Err(bad("Workspace name must contain 1 to 200 characters."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    sqlx::query("UPDATE ats_v2.tenants SET name=$2 WHERE id=$1")
        .bind(user.tenant_id)
        .bind(name.trim())
        .execute(&mut *tx)
        .await?;
    audit(&mut tx, &user, "UPDATE_WORKSPACE", "tenant", user.tenant_id).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":user.tenant_id,"name":name.trim()})))
}

pub async fn analytics(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let stages=sqlx::query("SELECT a.stage,count(*) count,avg(a.current_score) average_score FROM ats_v2.applications a JOIN ats_v2.candidates c ON c.id=a.candidate_id AND c.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND c.deleted_at IS NULL GROUP BY a.stage ORDER BY a.stage").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    let tasks=sqlx::query("SELECT state,count(*) count FROM ats_v2.processing_jobs WHERE tenant_id=$1 GROUP BY state ORDER BY state").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    let hires=sqlx::query("SELECT count(*) count,avg(extract(epoch FROM (h.hired_at-a.created_at))/86400)::float8 average_days FROM ats_v2.applications a JOIN (SELECT application_id,min(created_at) hired_at FROM ats_v2.stage_transitions WHERE tenant_id=$1 AND to_stage='Hired' GROUP BY application_id)h ON h.application_id=a.id WHERE a.tenant_id=$1").bind(user.tenant_id).fetch_one(&mut *tx).await?;
    Ok(Json(
        json!({"stages":stages.iter().map(|r|json!({"stage":r.get::<String,_>("stage"),"count":r.get::<i64,_>("count"),"average_score":r.get::<Option<f64>,_>("average_score")})).collect::<Vec<_>>(),"processing":tasks.iter().map(|r|json!({"state":r.get::<String,_>("state"),"count":r.get::<i64,_>("count")})).collect::<Vec<_>>(),"hires":hires.get::<i64,_>("count"),"average_days_to_hire":hires.get::<Option<f64>,_>("average_days"),"generated_at":chrono::Utc::now()}),
    ))
}

pub async fn submissions(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<Value>> {
    agency(&state, &user).await?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',s.id,'client_id',s.client_id,'client_name',cl.name,'application_id',s.application_id,'status',s.status,'snapshot',s.snapshot,'created_at',s.created_at) FROM ats_v2.submissions s JOIN ats_v2.clients cl ON cl.id=s.client_id AND cl.tenant_id=s.tenant_id WHERE s.tenant_id=$1 ORDER BY s.created_at DESC LIMIT 500").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    Ok(Json(json!(rows)))
}

pub async fn dashboard(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM ats_v2.candidates WHERE tenant_id=$1 AND deleted_at IS NULL",
    )
    .bind(user.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    let active: i64 =
        sqlx::query_scalar("SELECT count(*) FROM ats_v2.jobs WHERE tenant_id=$1 AND status='OPEN'")
            .bind(user.tenant_id)
            .fetch_one(&mut *tx)
            .await?;
    let evaluated=sqlx::query("SELECT count(*) count,count(*) FILTER(WHERE current_score>=70) matched FROM ats_v2.applications WHERE tenant_id=$1 AND current_score IS NOT NULL").bind(user.tenant_id).fetch_one(&mut *tx).await?;
    let n: i64 = evaluated.get("count");
    let matched: i64 = evaluated.get("matched");
    let rate = if n == 0 {
        0.0
    } else {
        100.0 * matched as f64 / n as f64
    };
    let processing:i64=sqlx::query_scalar("SELECT count(*) FROM ats_v2.processing_jobs WHERE tenant_id=$1 AND state IN('QUEUED','RUNNING')").bind(user.tenant_id).fetch_one(&mut *tx).await?;
    let today:i64=sqlx::query_scalar("SELECT count(*) FROM ats_v2.evaluations WHERE tenant_id=$1 AND created_at>=date_trunc('day',now())").bind(user.tenant_id).fetch_one(&mut *tx).await?;
    let rows=sqlx::query("SELECT c.id,c.profile,c.contact,a.id application_id,a.stage,a.current_score,j.id job_id,j.title FROM ats_v2.applications a JOIN ats_v2.candidates c ON c.id=a.candidate_id AND c.tenant_id=a.tenant_id JOIN ats_v2.jobs j ON j.id=a.job_id AND j.tenant_id=a.tenant_id WHERE a.tenant_id=$1 AND c.deleted_at IS NULL ORDER BY a.created_at DESC LIMIT 500").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    let mut pipeline = serde_json::Map::new();
    for stage in crate::domain::STAGES {
        pipeline.insert(stage.to_string(), json!([]));
    }
    for r in rows {
        let id: Uuid = r.get("id");
        let stage: String = r.get("stage");
        let mut p: Value = r.get("profile");
        crate::domain::redact_profile(&mut p, &r.get::<Value, _>("contact"));
        pipeline.entry(stage.clone()).or_insert(json!([])).as_array_mut().unwrap().push(json!({"id":id,"application_id":r.get::<Uuid,_>("application_id"),"job_id":r.get::<Uuid,_>("job_id"),"name":format!("Candidate #{}",&id.simple().to_string()[..8]),"role":p.get("target_headline").unwrap_or(&json!("Pending extraction")),"avatar":"CD","stage":stage,"match_score":r.get::<Option<f64>,_>("current_score"),"summary":r.get::<String,_>("title"),"probability":null,"applied_time":""}));
    }
    let weeks=sqlx::query("SELECT series.week,count(c.id) count FROM generate_series(date_trunc('week',now())-interval '7 weeks',date_trunc('week',now()),interval '1 week') series(week) LEFT JOIN ats_v2.candidates c ON c.created_at>=series.week AND c.created_at<series.week+interval '1 week' AND c.tenant_id=$1 AND c.deleted_at IS NULL GROUP BY series.week ORDER BY series.week").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    let stats=[("active_jobs","ACTIVE JOBS",active,"briefcase"),("candidates","CANDIDATES",total,"users"),("processing","PROCESSING",processing,"file"),("evaluations","EVALUATIONS TODAY",today,"sparkles")].iter().map(|(id,label,count,icon)|json!({"id":id,"label":label,"value":count.to_string(),"change":"From saved records","trend":"neutral","icon":icon,"style":"default"})).collect::<Vec<_>>();
    Ok(Json(
        json!({"stats":stats,"weekly_candidates":weeks.iter().enumerate().map(|(i,r)|json!({"week":format!("W{}",i+1),"count":r.get::<i64,_>("count"),"is_peak":false})).collect::<Vec<_>>(),"ai_match_rate":{"rate":rate,"matched_percent":rate,"not_matched_percent":100.0-rate,"precision_label":"Evaluated applications scoring at least 70"},"processing_resumes":processing,"today_evaluations":today,"pipeline":pipeline}),
    ))
}
#[derive(Deserialize)]
pub struct AuditFilters {
    pub limit: Option<i64>,
    pub actor_id: Option<Uuid>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
}
pub async fn audit_logs(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Query(f): Query<AuditFilters>,
) -> Result<Json<Value>> {
    user.pii()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let rows=sqlx::query("SELECT * FROM ats_v2.audit_events WHERE tenant_id=$1 AND ($2::uuid IS NULL OR actor_id=$2) AND ($3::text IS NULL OR action=$3) AND ($4::text IS NULL OR resource_type=$4) ORDER BY created_at DESC LIMIT $5").bind(user.tenant_id).bind(f.actor_id).bind(f.action).bind(f.resource_type).bind(f.limit.unwrap_or(50).clamp(1,1000)).fetch_all(&mut *tx).await?;
    Ok(Json(json!(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"timestamp":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"actor_id":r.get::<Option<Uuid>,_>("actor_id"),"actor_role":r.get::<String,_>("actor_role"),"action":r.get::<String,_>("action"),"resource_type":r.get::<String,_>("resource_type"),"resource_id":r.get::<String,_>("resource_id"),"decision":r.get::<String,_>("decision"),"details":""})).collect::<Vec<_>>())))
}
#[derive(Deserialize)]
pub struct TaxFilters {
    pub status: Option<String>,
    pub category: Option<String>,
    pub search: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}
fn tax_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({"id":r.get::<Uuid,_>("id"),"canonical_name":r.get::<String,_>("canonical_name"),"category":r.get::<String,_>("category"),"aliases":r.get::<Value,_>("aliases"),"is_ambiguous":r.get::<bool,_>("is_ambiguous"),"status":r.get::<String,_>("status"),"source":r.get::<String,_>("source"),"occurrence_count":0,"taxonomy_version":"tenant-v1","created_at":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"updated_at":r.get::<chrono::DateTime<chrono::Utc>,_>("updated_at")})
}
pub async fn taxonomy_stats(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let rows=sqlx::query("SELECT category,status,count(*) count FROM ats_v2.taxonomy WHERE tenant_id=$1 GROUP BY category,status").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    let mut total = 0;
    let mut counts = std::collections::HashMap::<String, i64>::new();
    let mut categories = std::collections::HashMap::<String, i64>::new();
    for r in rows {
        let n: i64 = r.get("count");
        total += n;
        *counts.entry(r.get("status")).or_default() += n;
        *categories.entry(r.get("category")).or_default() += n;
    }
    Ok(Json(
        json!({"version":"tenant-v1","total_skills":total,"approved_count":counts.get("approved").unwrap_or(&0),"pending_count":counts.get("pending").unwrap_or(&0),"rejected_count":counts.get("rejected").unwrap_or(&0),"categories":categories}),
    ))
}
pub async fn taxonomy_list(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Query(f): Query<TaxFilters>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let limit = f.limit.unwrap_or(100).clamp(1, 500);
    let offset = (f.page.unwrap_or(1).clamp(1, 10000) - 1) * limit;
    let rows=sqlx::query("SELECT *,count(*) OVER() total FROM ats_v2.taxonomy WHERE tenant_id=$1 AND ($2::text IS NULL OR status=$2) AND ($3::text IS NULL OR category=$3) AND ($4::text IS NULL OR canonical_name ILIKE '%'||$4||'%') ORDER BY canonical_name LIMIT $5 OFFSET $6").bind(user.tenant_id).bind(f.status).bind(f.category).bind(f.search).bind(limit).bind(offset).fetch_all(&mut *tx).await?;
    Ok(Json(
        json!({"items":rows.iter().map(tax_json).collect::<Vec<_>>(),"total":rows.first().map(|r|r.get::<i64,_>("total")).unwrap_or(0),"version":"tenant-v1"}),
    ))
}
pub async fn taxonomy_create(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(v): Json<Value>,
) -> Result<Json<Value>> {
    user.admin()?;
    let name = text(&v, "canonical_name");
    let category = text(&v, "category");
    if name.trim().is_empty() || name.len() > 100 || category.is_empty() || category.len() > 50 {
        return Err(bad("Invalid skill fields."));
    }
    let aliases = v.get("aliases").cloned().unwrap_or(json!([]));
    validate_aliases(&aliases)?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let id = Uuid::new_v4();
    let row=sqlx::query("INSERT INTO ats_v2.taxonomy(id,tenant_id,canonical_name,category,aliases,is_ambiguous) VALUES($1,$2,$3,$4,$5,$6) RETURNING *").bind(id).bind(user.tenant_id).bind(name.trim()).bind(category).bind(aliases).bind(v.get("is_ambiguous").and_then(Value::as_bool).unwrap_or(false)).fetch_one(&mut *tx).await?;
    audit(&mut tx, &user, "CREATE_SKILL", "taxonomy", id).await?;
    tx.commit().await?;
    Ok(Json(tax_json(&row)))
}
fn validate_aliases(v: &Value) -> Result<()> {
    if !v.as_array().is_some_and(|a| {
        a.len() <= 50
            && a.iter().all(|v| {
                v.as_str()
                    .is_some_and(|s| !s.trim().is_empty() && s.len() <= 100)
            })
    }) {
        return Err(bad("Invalid skill aliases."));
    }
    Ok(())
}
pub async fn taxonomy_approve(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(v): Json<Value>,
) -> Result<Json<Value>> {
    tax_change(&state, &user, id, "approved", v).await
}
pub async fn taxonomy_reject(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>> {
    tax_change(&state, &user, id, "rejected", json!({})).await
}
pub async fn taxonomy_alias(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(v): Json<Value>,
) -> Result<Json<Value>> {
    tax_change(&state, &user, id, "", v).await
}
async fn tax_change(
    state: &AppState,
    user: &Identity,
    id: Uuid,
    status: &str,
    v: Value,
) -> Result<Json<Value>> {
    user.admin()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row = sqlx::query("SELECT * FROM ats_v2.taxonomy WHERE id=$1 AND tenant_id=$2 FOR UPDATE")
        .bind(id)
        .bind(user.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let name = v
        .get("canonical_name")
        .and_then(Value::as_str)
        .unwrap_or_else(|| row.get::<&str, _>("canonical_name"));
    let category = v
        .get("category")
        .and_then(Value::as_str)
        .unwrap_or_else(|| row.get::<&str, _>("category"));
    let mut aliases = v.get("aliases").cloned().unwrap_or(row.get("aliases"));
    if let Some(alias) = v.get("alias").and_then(Value::as_str)
        && let Some(a) = aliases.as_array_mut()
        && !a.contains(&json!(alias))
    {
        a.push(json!(alias));
    }
    validate_aliases(&aliases)?;
    if name.is_empty() || name.len() > 100 || category.len() > 50 {
        return Err(bad("Invalid skill fields."));
    }
    let row=sqlx::query("UPDATE ats_v2.taxonomy SET canonical_name=$3,category=$4,aliases=$5,status=CASE WHEN $6='' THEN status ELSE $6 END,revision=revision+1,updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *").bind(id).bind(user.tenant_id).bind(name).bind(category).bind(aliases).bind(status).fetch_one(&mut *tx).await?;
    audit(&mut tx, user, "UPDATE_SKILL", "taxonomy", id).await?;
    tx.commit().await?;
    Ok(Json(tax_json(&row)))
}
pub async fn members(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<Value>> {
    user.admin()?;
    let rows=sqlx::query("SELECT u.id,u.name,u.email,m.role FROM ats_v2.memberships m JOIN ats_v2.users u ON u.id=m.user_id WHERE m.tenant_id=$1 ORDER BY u.name").bind(user.tenant_id).fetch_all(&state.db).await?;
    Ok(Json(json!(rows.iter().map(|r|json!({"id":r.get::<Uuid,_>("id"),"name":r.get::<String,_>("name"),"email":r.get::<String,_>("email"),"role":r.get::<String,_>("role")})).collect::<Vec<_>>())))
}
pub async fn add_member(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(v): Json<Value>,
) -> Result<Json<Value>> {
    user.admin()?;
    let email = text(&v, "email").trim().to_lowercase();
    let role = text(&v, "role");
    if !["admin", "recruiter", "viewer", "interviewer", "compliance"].contains(&role.as_str()) {
        return Err(bad("Invalid member role."));
    }
    let target: Uuid = sqlx::query_scalar("SELECT id FROM ats_v2.users WHERE email=$1")
        .bind(email)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| bad("This user must first create an account."))?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    sqlx::query("INSERT INTO ats_v2.memberships(tenant_id,user_id,role) VALUES($1,$2,$3)")
        .bind(user.tenant_id)
        .bind(target)
        .bind(role)
        .execute(&mut *tx)
        .await?;
    audit(&mut tx, &user, "ADD_MEMBER", "membership", target).await?;
    tx.commit().await?;
    Ok(Json(json!({"status":"added"})))
}
async fn agency(state: &AppState, user: &Identity) -> Result<()> {
    let kind: String = sqlx::query_scalar("SELECT kind FROM ats_v2.tenants WHERE id=$1")
        .bind(user.tenant_id)
        .fetch_one(&state.db)
        .await?;
    if kind != "agency" {
        return Err(ApiError(
            StatusCode::FORBIDDEN,
            "Agency workspace required.",
        ));
    }
    Ok(())
}
pub async fn clients(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
) -> Result<Json<Value>> {
    agency(&state, &user).await?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let rows:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'name',name) FROM ats_v2.clients WHERE tenant_id=$1 ORDER BY name LIMIT 500").bind(user.tenant_id).fetch_all(&mut *tx).await?;
    Ok(Json(json!(rows)))
}
pub async fn create_client(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(v): Json<Value>,
) -> Result<Json<Value>> {
    user.write()?;
    agency(&state, &user).await?;
    let name = text(&v, "name");
    if name.trim().is_empty() || name.len() > 200 {
        return Err(bad("Client name is required."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO ats_v2.clients(id,tenant_id,name,contact) VALUES($1,$2,$3,$4)")
        .bind(id)
        .bind(user.tenant_id)
        .bind(name.trim())
        .bind(v.get("contact").cloned().unwrap_or(json!({})))
        .execute(&mut *tx)
        .await?;
    audit(&mut tx, &user, "CREATE_CLIENT", "client", id).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":id,"name":name.trim()})))
}
#[derive(Deserialize)]
pub struct Submission {
    pub client_id: Uuid,
    pub application_id: Uuid,
}
pub async fn create_submission(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(v): Json<Submission>,
) -> Result<Json<Value>> {
    user.write()?;
    agency(&state, &user).await?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row=sqlx::query("SELECT c.profile,c.contact FROM ats_v2.applications a JOIN ats_v2.candidates c ON c.id=a.candidate_id AND c.tenant_id=a.tenant_id WHERE a.id=$1 AND a.tenant_id=$2 AND c.deleted_at IS NULL AND a.stage NOT IN ('Withdrawn','Rejected')").bind(v.application_id).bind(user.tenant_id).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    let mut p: Value = row.get("profile");
    crate::domain::redact_profile(&mut p, &row.get::<Value, _>("contact"));
    let mut snapshot = json!({});
    for k in [
        "target_headline",
        "core_skills",
        "highest_education",
        "years_of_experience",
    ] {
        if let Some(v) = p.get(k) {
            snapshot[k] = v.clone();
        }
    }
    let id = Uuid::new_v4();
    sqlx::query("INSERT INTO ats_v2.submissions(id,tenant_id,client_id,application_id,snapshot) VALUES($1,$2,$3,$4,$5)").bind(id).bind(user.tenant_id).bind(v.client_id).bind(v.application_id).bind(snapshot).execute(&mut *tx).await?;
    audit(&mut tx, &user, "CREATE_SUBMISSION", "submission", id).await?;
    tx.commit().await?;
    Ok(Json(json!({"id":id,"status":"SUBMITTED"})))
}
