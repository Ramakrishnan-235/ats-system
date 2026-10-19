use crate::{ApiError, AppState, Result, audit, auth::Identity, bad, missing, tenant_tx, text};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderName, HeaderValue, StatusCode},
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{Postgres, Row, Transaction, postgres::PgRow};
use uuid::Uuid;

pub fn pagination_headers(total: i64, page: i64, limit: i64, has_more: bool) -> HeaderMap {
    let mut headers = HeaderMap::new();
    if let Ok(v) = HeaderValue::from_str(&total.to_string()) {
        headers.insert(HeaderName::from_static("x-total-count"), v);
    }
    if let Ok(v) = HeaderValue::from_str(&page.to_string()) {
        headers.insert(HeaderName::from_static("x-page"), v);
    }
    if let Ok(v) = HeaderValue::from_str(&limit.to_string()) {
        headers.insert(HeaderName::from_static("x-limit"), v);
    }
    if let Ok(v) = HeaderValue::from_str(if has_more { "true" } else { "false" }) {
        headers.insert(HeaderName::from_static("x-has-more"), v);
    }
    headers
}

pub fn calculate_pagination(page: Option<i64>, limit: Option<i64>) -> (i64, i64) {
    let p = page.unwrap_or(1).max(1);
    let l = limit.unwrap_or(50).clamp(1, 1000);
    let offset = (p - 1) * l;
    (l, offset)
}

#[derive(Deserialize, Default)]
pub struct Filters {
    pub search: Option<String>,
    pub stage: Option<String>,
    pub skill: Option<String>,
    pub status: Option<String>,
    pub department: Option<String>,
    #[serde(default)]
    pub include_pii: bool,
    pub job_id: Option<Uuid>,
    pub new_stage: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    #[serde(default)]
    pub envelope: bool,
}
#[derive(Deserialize, Serialize, utoipa::ToSchema, Clone)]
pub struct JobInput {
    pub title: String,
    #[serde(default)]
    pub department: String,
    #[serde(default)]
    pub location: String,
    pub job_description: String,
    #[serde(default)]
    pub required_skills: Vec<String>,
    #[serde(default)]
    pub min_years_experience: f64,
    pub status: Option<String>,
}
impl JobInput {
    pub fn validate(&self) -> Result<()> {
        if self.title.trim().is_empty()
            || self.title.len() > 255
            || self.job_description.trim().is_empty()
            || self.job_description.len() > 50000
            || self.department.len() > 200
            || self.location.len() > 200
            || self.required_skills.len() > 100
            || !self.min_years_experience.is_finite()
            || !(0.0..=100.0).contains(&self.min_years_experience)
        {
            return Err(bad("Invalid job fields."));
        }
        if let Some(status) = &self.status
            && !["OPEN", "PAUSED", "CLOSED"].contains(&status.as_str())
        {
            return Err(bad("Job status must be OPEN, PAUSED, or CLOSED."));
        }
        Ok(())
    }
}
pub fn job_json(row: &PgRow) -> Value {
    json!({"id":row.get::<Uuid,_>("id"),"title":row.get::<String,_>("title"),"department":row.get::<String,_>("department"),"location":row.get::<String,_>("location"),
        "job_description":row.get::<String,_>("job_description"),"required_skills":row.get::<Value,_>("required_skills"),"min_years_experience":row.get::<f64,_>("min_years_experience"),
        "status":row.get::<String,_>("status"),"revision":row.get::<i32,_>("revision"),"posted_date":row.get::<chrono::DateTime<chrono::Utc>,_>("created_at").format("%d %b %Y").to_string(),
        "created_at":row.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"candidates_count":row.try_get::<i64,_>("candidates_count").unwrap_or(0),"avatars":[],"icon_type":"code",
        "top_match":{"score":row.try_get::<Option<f64>,_>("top_score").unwrap_or(None),"label":"Job-specific evaluation","last_run":"","status":"PENDING"}})
}
pub async fn list_jobs(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Query(f): Query<Filters>,
) -> Result<(HeaderMap, Json<Value>)> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM ats_v2.jobs j WHERE j.tenant_id=$1 AND ($2::text IS NULL OR j.status=$2) AND ($3::text IS NULL OR j.department=$3) AND ($4::text IS NULL OR j.title ILIKE '%'||$4||'%')"
    )
    .bind(user.tenant_id)
    .bind(&f.status)
    .bind(&f.department)
    .bind(&f.search)
    .fetch_one(&mut *tx)
    .await?;

    let limit = f.limit.unwrap_or(500).clamp(1, 1000);
    let offset = if let Some(offset) = f.offset {
        offset.max(0)
    } else if let Some(page) = f.page {
        (page.max(1) - 1) * limit
    } else {
        0
    };
    let page = (offset / limit) + 1;
    let has_more = offset + limit < total;

    let rows = sqlx::query(
        "SELECT j.*, (SELECT count(*) FROM ats_v2.applications a WHERE a.tenant_id=j.tenant_id AND a.job_id=j.id) candidates_count, (SELECT max(current_score) FROM ats_v2.applications a WHERE a.tenant_id=j.tenant_id AND a.job_id=j.id) top_score FROM ats_v2.jobs j WHERE j.tenant_id=$1 AND ($2::text IS NULL OR j.status=$2) AND ($3::text IS NULL OR j.department=$3) AND ($4::text IS NULL OR j.title ILIKE '%'||$4||'%') ORDER BY j.created_at DESC LIMIT $5 OFFSET $6"
    )
    .bind(user.tenant_id)
    .bind(&f.status)
    .bind(&f.department)
    .bind(&f.search)
    .bind(limit)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;
    tx.commit().await?;

    let items: Vec<Value> = rows.iter().map(job_json).collect();
    let headers = pagination_headers(total, page, limit, has_more);
    if f.envelope {
        Ok((
            headers,
            Json(json!({
                "items": items,
                "total": total,
                "page": page,
                "limit": limit,
                "has_more": has_more
            })),
        ))
    } else {
        Ok((headers, Json(Value::Array(items))))
    }
}
pub async fn get_job(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row=sqlx::query("SELECT j.*,(SELECT count(*) FROM ats_v2.applications a WHERE a.tenant_id=j.tenant_id AND a.job_id=j.id) candidates_count FROM ats_v2.jobs j WHERE j.id=$1 AND j.tenant_id=$2").bind(id).bind(user.tenant_id).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    Ok(Json(job_json(&row)))
}
pub async fn create_job(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(input): Json<JobInput>,
) -> Result<Json<Value>> {
    user.write()?;
    input.validate()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let id = Uuid::new_v4();
    let status = input.status.as_deref().unwrap_or("OPEN");
    let row = sqlx::query(
        "INSERT INTO ats_v2.jobs(id,tenant_id,title,department,location,job_description,required_skills,min_years_experience,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *"
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(input.title.trim())
    .bind(input.department)
    .bind(input.location)
    .bind(input.job_description)
    .bind(json!(input.required_skills))
    .bind(input.min_years_experience)
    .bind(status)
    .fetch_one(&mut *tx)
    .await?;
    audit(&mut tx, &user, "CREATE_JOB", "job", id).await?;
    tx.commit().await?;
    Ok(Json(job_json(&row)))
}
pub async fn update_job(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(input): Json<JobInput>,
) -> Result<Json<Value>> {
    user.write()?;
    input.validate()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let existing = sqlx::query(
        "SELECT title,department,location,job_description,required_skills,min_years_experience,status FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2 FOR UPDATE"
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;

    let old_status: String = existing.get("status");
    let new_status = input.status.as_deref().unwrap_or(&old_status);

    let old_desc: String = existing.get("job_description");
    let old_skills: Value = existing.get("required_skills");
    let old_exp: f64 = existing.get("min_years_experience");

    let criteria_changed = old_desc.trim() != input.job_description.trim()
        || old_skills != json!(input.required_skills)
        || (old_exp - input.min_years_experience).abs() > f64::EPSILON;

    let row = sqlx::query(
        "UPDATE ats_v2.jobs SET title=$3,department=$4,location=$5,job_description=$6,required_skills=$7,min_years_experience=$8,status=$9,revision=revision+1,updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *"
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(input.title.trim())
    .bind(input.department)
    .bind(input.location)
    .bind(input.job_description)
    .bind(json!(input.required_skills))
    .bind(input.min_years_experience)
    .bind(new_status)
    .fetch_one(&mut *tx)
    .await?;

    if criteria_changed {
        sqlx::query(
            "UPDATE ats_v2.applications SET current_score=NULL WHERE job_id=$1 AND tenant_id=$2",
        )
        .bind(id)
        .bind(user.tenant_id)
        .execute(&mut *tx)
        .await?;
    }

    if old_status != new_status {
        audit(&mut tx, &user, "CHANGE_JOB_STATUS", "job", id).await?;
    } else {
        audit(&mut tx, &user, "UPDATE_JOB", "job", id).await?;
    }
    tx.commit().await?;
    Ok(Json(job_json(&row)))
}
pub fn empty_scorecard() -> Value {
    json!({"overall_match_score":null,"evaluation_status":"PENDING","match_tier":"Not Evaluated","model_version":"","evaluated_at":"","categories":[],"risk_flags":[],"suggested_improvements":[],"suggested_questions":[],"team_notes":[]})
}
fn unscored_task_status(state: &str, result: Option<&Value>, error: Option<&str>) -> Value {
    let mut card = empty_scorecard();
    let status = match state {
        "QUEUED" | "RUNNING" => "PROCESSING",
        "FAILED" | "CANCELLED" | "STALE" => "FAILED",
        "SUCCEEDED" => match result.and_then(|r| r["evaluation_status"].as_str()) {
            Some("SKIPPED") => "SKIPPED",
            _ => "FAILED",
        },
        _ => "PENDING",
    };
    card["evaluation_status"] = json!(status);
    if status == "FAILED" {
        card["error_code"] = json!(error.unwrap_or("EVALUATION_UNAVAILABLE"));
        card["risk_flags"] = json!([]);
    }
    card
}

async fn unscored_candidate_status(
    tx: &mut Transaction<'_, Postgres>,
    tenant: Uuid,
    candidate: Uuid,
    job: Option<Uuid>,
) -> Result<Value> {
    let task = sqlx::query("SELECT p.state,p.result,p.error_code FROM ats_v2.processing_jobs p JOIN ats_v2.candidates c ON c.id=p.candidate_id AND c.tenant_id=p.tenant_id LEFT JOIN ats_v2.applications a ON a.id=p.application_id AND a.tenant_id=p.tenant_id LEFT JOIN ats_v2.jobs j ON j.id=a.job_id AND j.tenant_id=a.tenant_id WHERE p.tenant_id=$1 AND p.candidate_id=$2 AND p.input_revision=c.revision AND ($3::uuid IS NULL OR a.job_id=$3) AND (p.job_revision IS NULL OR p.job_revision=j.revision) ORDER BY p.created_at DESC,p.id DESC LIMIT 1")
        .bind(tenant).bind(candidate).bind(job).fetch_optional(&mut **tx).await?;
    Ok(match task {
        Some(row) => unscored_task_status(
            &row.get::<String, _>("state"),
            row.get::<Option<Value>, _>("result").as_ref(),
            row.get::<Option<String>, _>("error_code").as_deref(),
        ),
        None => empty_scorecard(),
    })
}
pub async fn candidate_json(
    tx: &mut Transaction<'_, Postgres>,
    user: &Identity,
    row: &PgRow,
    pii: bool,
    selected_job_id: Option<Uuid>,
) -> Result<Value> {
    let id: Uuid = row.get("id");
    let mut p: Value = row.get("profile");
    if !p.is_object() {
        p = json!({});
    }
    let anonymous = format!("Candidate #{}", &id.simple().to_string()[..8]);
    let contact: Value = row.get("contact");
    p["id"] = json!(id);
    p["anonymized_name"] = json!(anonymous);
    p["name"] = if pii {
        contact.get("name").cloned().unwrap_or(json!(anonymous))
    } else {
        json!(anonymous)
    };
    for k in ["email", "phone", "linkedin", "location"] {
        p[k] = if pii {
            contact.get(k).cloned().unwrap_or(json!("N/A"))
        } else {
            json!("[REDACTED]")
        };
    }
    p["avatar"] = json!("CD");
    p["is_pii_masked"] = json!(!pii);
    p["revision"] = json!(row.get::<i32, _>("revision"));
    p["processing_status"] = json!(row.get::<String, _>("processing_status"));
    p["applied_date"] = json!(
        row.get::<chrono::DateTime<chrono::Utc>, _>("created_at")
            .to_rfc3339()
    );
    for (k, v) in [
        ("target_headline", json!("Pending extraction")),
        ("role", json!("Pending extraction")),
        ("highest_education", json!("N/A")),
        ("years_of_experience", Value::Null),
        ("core_skills", json!([])),
        ("experience", json!([])),
    ] {
        if p.get(k).is_none() {
            p[k] = v;
        }
    }
    let apps = sqlx::query(
        "SELECT a.id,a.job_id,a.stage,a.current_score,a.interviews,a.offer,j.title FROM ats_v2.applications a JOIN ats_v2.jobs j ON j.id=a.job_id AND j.tenant_id=a.tenant_id WHERE a.candidate_id=$1 AND a.tenant_id=$2 ORDER BY a.created_at DESC"
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_all(&mut **tx)
    .await?;

    let apps_json: Vec<Value> = apps
        .iter()
        .map(|a| {
            json!({
                "id": a.get::<Uuid, _>("id"),
                "job_id": a.get::<Uuid, _>("job_id"),
                "job_title": a.get::<String, _>("title"),
                "stage": a.get::<String, _>("stage"),
                "match_score": a.get::<Option<f64>, _>("current_score"),
                "interviews": a.get::<Value, _>("interviews"),
                "offer": a.get::<Value, _>("offer"),
            })
        })
        .collect();
    p["applications"] = json!(apps_json);

    let target_app = if let Some(jid) = selected_job_id {
        apps.iter().find(|a| a.get::<Uuid, _>("job_id") == jid)
    } else {
        None
    }
    .or_else(|| apps.first());

    if let Some(app) = target_app {
        p["stage"] = json!(app.get::<String, _>("stage"));
        p["status"] = p["stage"].clone();
        p["applied_for_job"] = json!(app.get::<String, _>("title"));
        p["applied_for_job_id"] = json!(app.get::<Uuid, _>("job_id"));
        p["interviews"] = app.get::<Value, _>("interviews");
        p["offer"] = app.get::<Value, _>("offer");
    } else {
        p["stage"] = json!("Talent Pool");
        p["status"] = json!("Talent Pool");
        p["applied_for_job"] = json!("Talent Pool");
        p["applied_for_job_id"] = Value::Null;
        p["interviews"] = json!([]);
        p["offer"] = json!({});
    }

    let selected_application = target_app.map(|a| a.get::<Uuid, _>("id"));
    let score: Option<Value> = if let Some(app_id) = selected_application {
        sqlx::query_scalar(
            "SELECT e.scorecard FROM ats_v2.evaluations e WHERE e.application_id=$1 AND e.tenant_id=$2 ORDER BY e.created_at DESC LIMIT 1"
        )
        .bind(app_id)
        .bind(user.tenant_id)
        .fetch_optional(&mut **tx)
        .await?
    } else {
        None
    };

    p["scorecard"] = match score {
        Some(score) => score,
        None => {
            unscored_candidate_status(
                tx,
                user.tenant_id,
                id,
                target_app.map(|a| a.get::<Uuid, _>("job_id")),
            )
            .await?
        }
    };
    let notes = sqlx::query(
        "SELECT n.*,u.name FROM ats_v2.notes n JOIN ats_v2.users u ON u.id=n.actor_id WHERE n.candidate_id=$1 AND n.tenant_id=$2 ORDER BY n.created_at DESC"
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_all(&mut **tx)
    .await?;
    let notes_json = json!(notes.iter().map(note_json).collect::<Vec<_>>());
    p["scorecard"]["team_notes"] = notes_json.clone();
    p["team_notes"] = notes_json;

    // Raw text/contact fields are intentionally never embedded in the public profile.
    if let Some(o) = p.as_object_mut() {
        o.remove("raw_text");
        o.remove("raw_anonymized_text");
        o.remove("structured_profile");
        o.remove("resume_filename");
        o.remove("_submitted_headline");
    }
    if !pii {
        redact_profile(&mut p, &contact);
    }
    Ok(p)
}

const REDACTION_STOPWORDS: &[&str] = &[
    "remote",
    "hybrid",
    "onsite",
    "on-site",
    "in-office",
    "office",
    "home",
    "unknown",
    "n/a",
    "na",
    "none",
    "null",
    "undefined",
    "not specified",
    "tbd",
    "location",
    "city",
    "state",
    "country",
    "flexible",
    "relocation",
    "anywhere",
    "worldwide",
    "global",
    "candidate",
    "applicant",
    "resume",
    "profile",
    "summary",
    "contact",
    "engineer",
    "developer",
    "manager",
    "lead",
    "senior",
    "junior",
    "staff",
    "principal",
    "architect",
    "analyst",
    "specialist",
    "intern",
    "director",
    "consultant",
    "software",
    "email",
    "phone",
    "mobile",
    "tel",
    "cell",
    "telephone",
    "and",
    "the",
    "for",
    "with",
    "from",
    "http",
    "https",
    "www",
    "com",
    "org",
    "net",
    "linkedin",
    "github",
];

fn is_redaction_stopword(s: &str) -> bool {
    let lower = s.trim().to_lowercase();
    lower.is_empty() || REDACTION_STOPWORDS.contains(&lower.as_str())
}

/// Apply the same privacy policy to recruiter edits, notes and AI-produced fields.
pub fn redact_profile(value: &mut Value, contact: &Value) {
    let mut patterns = vec![
        r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b".to_owned(),
        r##"\b(?:https?://|www\.)[^\s<>'"]+|\b(?:[a-z0-9_-]+\.)*(?:linkedin\.com|github\.com|gitlab\.com|twitter\.com|x\.com)/[^\s<>'"]+"##.to_owned(),
        r"(?:\+\d{1,4}[-.\s]*\(?\d{2,5}\)?[-.\s]*\d{3,5}[-.\s]*\d{3,5}\b)".to_owned(),
        r"(?:\(\d{3}\)|\b\d{3})[-.\s]*\d{3}[-.\s]*\d{4}\b".to_owned(),
    ];
    if let Some(fields) = contact.as_object() {
        if let Some(email) = fields.get("email").and_then(Value::as_str) {
            let email = email.trim();
            if email.len() >= 3 && !is_redaction_stopword(email) && email.contains('@') {
                patterns.push(format!(r"\b{}\b", regex::escape(email)));
            }
        }
        if let Some(phone) = fields.get("phone").and_then(Value::as_str) {
            let phone = phone.trim();
            if phone.len() >= 6 && !is_redaction_stopword(phone) {
                let phone_no_plus = phone.trim_start_matches('+').trim();
                if !phone_no_plus.is_empty() {
                    patterns.push(format!(r"(?:\+)?\b{}\b", regex::escape(phone_no_plus)));
                }
            }
        }
        if let Some(url) = fields.get("linkedin").and_then(Value::as_str) {
            let url = url.trim();
            if url.len() >= 5 && !is_redaction_stopword(url) {
                let clean_url = url
                    .trim_start_matches("https://")
                    .trim_start_matches("http://");
                patterns.push(format!(r"(?:https?://)?\b{}\b", regex::escape(clean_url)));
            }
        }
        for key in ["name", "_submitted_name"] {
            if let Some(name) = fields.get(key).and_then(Value::as_str) {
                let name = name.trim();
                if name.len() >= 3 && !is_redaction_stopword(name) {
                    patterns.push(format!(r"\b{}\b", regex::escape(name)));
                    for token in name.split(|c: char| !c.is_alphanumeric() && c != '\'') {
                        let t = token.trim();
                        if t.len() >= 3 && !is_redaction_stopword(t) {
                            patterns.push(format!(r"\b{}\b", regex::escape(t)));
                        }
                    }
                }
            }
        }
        if let Some(loc) = fields.get("location").and_then(Value::as_str) {
            let loc = loc.trim();
            if loc.len() >= 3 && !is_redaction_stopword(loc) {
                for segment in loc.split([',', '/', ';']) {
                    let seg = segment
                        .trim()
                        .trim_start_matches('-')
                        .trim_end_matches('-')
                        .trim();
                    if seg.len() >= 3 && !is_redaction_stopword(seg) {
                        patterns.push(format!(r"\b{}\b", regex::escape(seg)));
                    }
                }
            }
        }
    }
    patterns.sort();
    patterns.dedup();
    let re = regex::RegexBuilder::new(&patterns.join("|"))
        .case_insensitive(true)
        .build()
        .expect("escaped contact patterns");
    fn walk(value: &mut Value, re: &regex::Regex) {
        match value {
            Value::String(s) if Uuid::parse_str(s).is_ok() => {}
            Value::String(s) => *s = re.replace_all(s, "[REDACTED]").into_owned(),
            Value::Array(items) => items.iter_mut().for_each(|v| walk(v, re)),
            Value::Object(items) => items.values_mut().for_each(|v| walk(v, re)),
            _ => {}
        }
    }
    walk(value, &re);
}
pub async fn list_candidates(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Query(f): Query<Filters>,
) -> Result<(HeaderMap, Json<Value>)> {
    if f.include_pii {
        user.pii()?;
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let total: i64 = sqlx::query_scalar(
        "SELECT count(*) FROM ats_v2.candidates c WHERE c.tenant_id=$1 AND c.deleted_at IS NULL AND ($2::text IS NULL OR c.sanitized_text ILIKE '%'||$2||'%' OR ($5 AND c.contact->>'name' ILIKE '%'||$2||'%')) AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM ats_v2.applications a WHERE a.tenant_id=c.tenant_id AND a.candidate_id=c.id AND a.stage=$3)) AND ($4::text IS NULL OR c.profile->'core_skills' ? $4)"
    )
    .bind(user.tenant_id)
    .bind(&f.search)
    .bind(&f.stage)
    .bind(&f.skill)
    .bind(f.include_pii)
    .fetch_one(&mut *tx)
    .await?;

    let limit = f.limit.unwrap_or(500).clamp(1, 1000);
    let offset = if let Some(offset) = f.offset {
        offset.max(0)
    } else if let Some(page) = f.page {
        (page.max(1) - 1) * limit
    } else {
        0
    };
    let page = (offset / limit) + 1;
    let has_more = offset + limit < total;

    let rows = sqlx::query(
        "SELECT c.* FROM ats_v2.candidates c WHERE c.tenant_id=$1 AND c.deleted_at IS NULL AND ($2::text IS NULL OR c.sanitized_text ILIKE '%'||$2||'%' OR ($5 AND c.contact->>'name' ILIKE '%'||$2||'%')) AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM ats_v2.applications a WHERE a.tenant_id=c.tenant_id AND a.candidate_id=c.id AND a.stage=$3)) AND ($4::text IS NULL OR c.profile->'core_skills' ? $4) ORDER BY c.created_at DESC LIMIT $6 OFFSET $7"
    )
    .bind(user.tenant_id)
    .bind(&f.search)
    .bind(&f.stage)
    .bind(&f.skill)
    .bind(f.include_pii)
    .bind(limit)
    .bind(offset)
    .fetch_all(&mut *tx)
    .await?;

    let mut values = vec![];
    for row in rows {
        values.push(candidate_json(&mut tx, &user, &row, f.include_pii, f.job_id).await?);
    }
    if f.include_pii {
        audit(&mut tx, &user, "VIEW_CANDIDATES_PII", "candidate", "list").await?;
    }
    tx.commit().await?;

    let headers = pagination_headers(total, page, limit, has_more);
    if f.envelope {
        Ok((
            headers,
            Json(json!({
                "items": values,
                "total": total,
                "page": page,
                "limit": limit,
                "has_more": has_more
            })),
        ))
    } else {
        Ok((headers, Json(Value::Array(values))))
    }
}
pub async fn get_candidate(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Query(f): Query<Filters>,
) -> Result<Json<Value>> {
    if f.include_pii {
        user.pii()?;
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row = sqlx::query(
        "SELECT * FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;
    let value = candidate_json(&mut tx, &user, &row, f.include_pii, f.job_id).await?;
    if f.include_pii {
        audit(&mut tx, &user, "VIEW_CANDIDATE_PII", "candidate", id).await?;
    }
    tx.commit().await?;
    Ok(Json(value))
}
pub async fn get_scorecard(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Query(f): Query<Filters>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let contact: Value = sqlx::query_scalar(
        "SELECT contact FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL",
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;
    let score: Option<Value> = sqlx::query_scalar(
        "SELECT e.scorecard FROM ats_v2.evaluations e JOIN ats_v2.applications a ON a.id=e.application_id AND a.tenant_id=e.tenant_id WHERE a.candidate_id=$1 AND e.tenant_id=$2 AND ($3::uuid IS NULL OR a.job_id=$3) ORDER BY e.created_at DESC LIMIT 1"
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(f.job_id)
    .fetch_optional(&mut *tx)
    .await?;
    let mut score = match score {
        Some(score) => score,
        None => unscored_candidate_status(&mut tx, user.tenant_id, id, f.job_id).await?,
    };
    let notes = sqlx::query(
        "SELECT n.*,u.name FROM ats_v2.notes n JOIN ats_v2.users u ON u.id=n.actor_id WHERE n.candidate_id=$1 AND n.tenant_id=$2 ORDER BY n.created_at DESC"
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_all(&mut *tx)
    .await?;
    score["team_notes"] = json!(notes.iter().map(note_json).collect::<Vec<_>>());
    redact_profile(&mut score, &contact);
    Ok(Json(score))
}
fn note_json(r: &PgRow) -> Value {
    json!({"id":r.get::<Uuid,_>("id"),"author":r.get::<String,_>("name"),"initials":"RC","role":"Recruiter","timestamp":r.get::<chrono::DateTime<chrono::Utc>,_>("created_at"),"content":r.get::<String,_>("content")})
}
#[derive(Deserialize)]
pub struct NoteInput {
    pub content: String,
}
pub async fn add_note(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(input): Json<NoteInput>,
) -> Result<Json<Value>> {
    user.write()?;
    if input.content.trim().is_empty() || input.content.len() > 10000 {
        return Err(bad("Invalid note."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let cand_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL)"
    )
    .bind(id)
    .bind(user.tenant_id)
    .fetch_one(&mut *tx)
    .await?;
    if !cand_exists {
        return Err(missing());
    }
    let nid = Uuid::new_v4();
    sqlx::query("INSERT INTO ats_v2.notes(id,tenant_id,candidate_id,actor_id,content) VALUES($1,$2,$3,$4,$5)").bind(nid).bind(user.tenant_id).bind(id).bind(user.user_id).bind(input.content.trim()).execute(&mut *tx).await?;
    audit(&mut tx, &user, "ADD_NOTE", "candidate", id).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"id":nid,"author":user.name,"initials":"RC","role":user.role,"timestamp":chrono::Utc::now(),"content":input.content.trim()}),
    ))
}
pub const STAGES: &[&str] = &[
    "Screening",
    "Review Required",
    "Qualified",
    "Contacted",
    "Interview",
    "Negotiation",
    "Offer",
    "Offered",
    "Hired",
    "Rejected",
    "Withdrawn",
    "Recruiter Review",
];
async fn move_stage(
    tx: &mut Transaction<'_, Postgres>,
    user: &Identity,
    job: Uuid,
    candidate: Uuid,
    stage: &str,
) -> Result<()> {
    if !STAGES.contains(&stage) {
        return Err(bad("Invalid application stage."));
    }
    let job_status: Option<String> =
        sqlx::query_scalar("SELECT status FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2")
            .bind(job)
            .bind(user.tenant_id)
            .fetch_optional(&mut **tx)
            .await?;
    if let Some(status) = job_status
        && status == "CLOSED"
        && stage != "Withdrawn"
    {
        return Err(bad("Job is closed. Application stages cannot be changed."));
    }
    let row = sqlx::query(
        "SELECT id,stage FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3 FOR UPDATE",
    )
    .bind(user.tenant_id)
    .bind(job)
    .bind(candidate)
    .fetch_optional(&mut **tx)
    .await?
    .ok_or_else(missing)?;
    let application: Uuid = row.get("id");
    sqlx::query(
        "UPDATE ats_v2.applications SET stage=$1,revision=revision+1 WHERE id=$2 AND tenant_id=$3",
    )
    .bind(stage)
    .bind(application)
    .bind(user.tenant_id)
    .execute(&mut **tx)
    .await?;
    sqlx::query("INSERT INTO ats_v2.stage_transitions(id,tenant_id,application_id,actor_id,from_stage,to_stage) VALUES($1,$2,$3,$4,$5,$6)").bind(Uuid::new_v4()).bind(user.tenant_id).bind(application).bind(user.user_id).bind(row.get::<String,_>("stage")).bind(stage).execute(&mut **tx).await?;
    audit(tx, user, "MOVE_APPLICATION", "application", application).await
}
pub async fn candidate_stage(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(candidate): Path<Uuid>,
    Query(f): Query<Filters>,
) -> Result<Json<Value>> {
    user.write()?;
    let stage = f.new_stage.ok_or_else(|| bad("Stage is required."))?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let ids: Vec<Uuid> = sqlx::query_scalar("SELECT job_id FROM ats_v2.applications WHERE candidate_id=$1 AND tenant_id=$2 AND ($3::uuid IS NULL OR job_id=$3)").bind(candidate).bind(user.tenant_id).bind(f.job_id).fetch_all(&mut *tx).await?;
    if ids.is_empty() {
        return Err(missing());
    }
    if ids.len() != 1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Select the application whose stage should change.",
        ));
    }
    move_stage(&mut tx, &user, ids[0], candidate, &stage).await?;
    tx.commit().await?;
    Ok(Json(json!({"status":"updated","stage":stage})))
}
pub async fn job_candidate_stage(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate)): Path<(Uuid, Uuid)>,
    Query(f): Query<Filters>,
) -> Result<Json<Value>> {
    user.write()?;
    let stage = f.new_stage.ok_or_else(|| bad("Stage is required."))?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    move_stage(&mut tx, &user, job, candidate, &stage).await?;
    let values = ranked(&mut tx, &user, job).await?;
    tx.commit().await?;
    if let Some(candidate_val) = values.into_iter().find(|v| v["id"] == json!(candidate)) {
        Ok(Json(candidate_val))
    } else {
        Ok(Json(json!({"id": candidate, "jobId": job, "stage": stage})))
    }
}
pub async fn ranked(
    tx: &mut Transaction<'_, Postgres>,
    user: &Identity,
    job: Uuid,
) -> Result<Vec<Value>> {
    let exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2)")
            .bind(job)
            .bind(user.tenant_id)
            .fetch_one(&mut **tx)
            .await?;
    if !exists {
        return Err(missing());
    }
    let rows = sqlx::query("SELECT c.*,a.id application_id,a.stage application_stage,a.current_score,a.interviews,a.offer FROM ats_v2.applications a JOIN ats_v2.candidates c ON c.id=a.candidate_id AND c.tenant_id=a.tenant_id WHERE a.job_id=$1 AND a.tenant_id=$2 AND c.deleted_at IS NULL AND a.stage != 'Withdrawn' ORDER BY a.current_score DESC NULLS LAST,a.created_at").bind(job).bind(user.tenant_id).fetch_all(&mut **tx).await?;
    Ok(rows.iter().enumerate().map(|(i,r)| {let mut p:Value=r.get("profile");redact_profile(&mut p,&r.get::<Value,_>("contact"));let id:Uuid=r.get("id");json!({"id":id,"application_id":r.get::<Uuid,_>("application_id"),"jobId":job,"rank":i+1,"name":format!("Candidate #{}",&id.simple().to_string()[..8]),"headline":p.get("target_headline").unwrap_or(&json!("Pending extraction")),"avatar":"CD","isImageAvatar":false,"matchScore":r.get::<Option<f64>,_>("current_score"),"matchLabel":"Job-specific evaluation","skills":p.get("core_skills").unwrap_or(&json!([])),"stage":r.get::<String,_>("application_stage"),"interviews":r.get::<Value,_>("interviews"),"offer":r.get::<Value,_>("offer"),"sourceResumeLink":format!("/candidates/{id}"),"quote":"","suggestedQuestions":[]})}).collect())
}
pub async fn job_candidates(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(job): Path<Uuid>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    Ok(Json(json!(ranked(&mut tx, &user, job).await?)))
}
pub async fn add_job_candidate(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(job): Path<Uuid>,
    Json(input): Json<Value>,
) -> Result<Json<Value>> {
    user.write()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let job_row = sqlx::query("SELECT status FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2")
        .bind(job)
        .bind(user.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let status: String = job_row.get("status");
    if status == "CLOSED" {
        return Err(bad("Job is closed. Cannot add candidates to a closed job."));
    }
    if status == "PAUSED" {
        return Err(bad("Job is paused. Cannot add candidates to a paused job."));
    }
    let candidate = if let Some(id) = input.get("id").and_then(Value::as_str) {
        let cid = Uuid::parse_str(id).map_err(|_| bad("Invalid candidate ID."))?;
        let cand_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL)"
        )
        .bind(cid)
        .bind(user.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if !cand_exists {
            return Err(missing());
        }
        cid
    } else {
        let name = text(&input, "name");
        if name.trim().is_empty() || name.len() > 200 {
            return Err(bad("Candidate name is required."));
        }
        let id = Uuid::new_v4();
        let contact = json!({"name":name,"email":text(&input,"email"),"phone":text(&input,"phone"),"linkedin":text(&input,"linkedin"),"location":text(&input,"location")});
        // Client-supplied scores, employment history and raw documents never become AI evidence.
        let profile = json!({"target_headline":text(&input,"headline"),"role":text(&input,"headline"),"core_skills":input.get("skills").cloned().unwrap_or(json!([])),"experience":[],"highest_education":text(&input,"highest_education"),"years_of_experience":input.get("experienceYears")});
        sqlx::query("INSERT INTO ats_v2.candidates(id,tenant_id,profile,contact,processing_status) VALUES($1,$2,$3,$4,'MANUAL')").bind(id).bind(user.tenant_id).bind(profile).bind(contact).execute(&mut *tx).await?;
        id
    };
    sqlx::query("INSERT INTO ats_v2.applications(id,tenant_id,candidate_id,job_id) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,candidate_id,job_id) DO NOTHING").bind(Uuid::new_v4()).bind(user.tenant_id).bind(candidate).bind(job).execute(&mut *tx).await?;
    audit(&mut tx, &user, "ADD_APPLICATION", "candidate", candidate).await?;
    let results = ranked(&mut tx, &user, job).await?;
    tx.commit().await?;
    Ok(Json(json!(results)))
}
pub async fn remove_job_candidate(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>> {
    user.write()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    // Preserve history and prevent pending AI callbacks from reviving a withdrawn application.
    move_stage(&mut tx, &user, job, candidate, "Withdrawn").await?;
    sqlx::query("UPDATE ats_v2.processing_jobs SET state='CANCELLED',updated_at=now() WHERE tenant_id=$1 AND application_id IN(SELECT id FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3) AND state IN('QUEUED','RUNNING')").bind(user.tenant_id).bind(job).bind(candidate).execute(&mut *tx).await?;
    let results = ranked(&mut tx, &user, job).await?;
    tx.commit().await?;
    Ok(Json(json!(results)))
}
#[derive(Deserialize, utoipa::ToSchema)]
pub struct ProfileEdit {
    pub revision: i32,
    pub profile: Value,
    pub contact: Value,
}
pub async fn edit_candidate(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
    Json(input): Json<ProfileEdit>,
) -> Result<Json<Value>> {
    user.write()?;
    user.pii()?;
    if !input.profile.is_object()
        || !input.contact.is_object()
        || input.profile.to_string().len() > 50000
        || input.contact.to_string().len() > 5000
    {
        return Err(bad("Invalid profile."));
    }
    let mut safe = json!({});
    for k in [
        "target_headline",
        "role",
        "core_skills",
        "highest_education",
        "years_of_experience",
        "experience",
    ] {
        if let Some(v) = input.profile.get(k) {
            safe[k] = v.clone();
        }
    }
    let mut contact = json!({});
    for k in ["name", "email", "phone", "linkedin", "location"] {
        if let Some(v) = input.contact.get(k) {
            contact[k] = v.clone();
        }
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let old = sqlx::query("SELECT profile,contact,sanitized_text,processing_status FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND revision=$3 AND deleted_at IS NULL FOR UPDATE")
        .bind(id)
        .bind(user.tenant_id)
        .bind(input.revision)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(ApiError(StatusCode::CONFLICT, "Profile changed. Refresh before saving."))?;

    let old_proc_status: String = old.get("processing_status");
    let next_proc_status = if old_proc_status == "FAILED" {
        "COMPLETED"
    } else {
        &old_proc_status
    };

    let mut merged: Value = old.get("profile");
    if let Some(obj) = merged.as_object_mut()
        && let Some(safe_obj) = safe.as_object()
    {
        obj.extend(safe_obj.clone());
    }
    let mut merged_contact: Value = old.get("contact");
    if let Some(obj) = merged_contact.as_object_mut()
        && let Some(contact_obj) = contact.as_object()
    {
        obj.extend(contact_obj.clone());
    }
    let existing_sanitized: String = old.get("sanitized_text");
    let sanitized = if existing_sanitized.trim().is_empty() {
        merged.to_string()
    } else {
        existing_sanitized
    };
    let new_revision = input.revision + 1;
    let updated = sqlx::query(
        "UPDATE ats_v2.candidates SET profile=$4,contact=$5,sanitized_text=$6,revision=$7,processing_status=$8,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND revision=$3 AND deleted_at IS NULL"
    )
    .bind(id)
    .bind(user.tenant_id)
    .bind(input.revision)
    .bind(&merged)
    .bind(&merged_contact)
    .bind(&sanitized)
    .bind(new_revision)
    .bind(next_proc_status)
    .execute(&mut *tx)
    .await?;
    if updated.rows_affected() != 1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Profile changed. Refresh before saving.",
        ));
    }
    sqlx::query(
        "UPDATE ats_v2.applications SET current_score=NULL WHERE tenant_id=$1 AND candidate_id=$2",
    )
    .bind(user.tenant_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;

    let latest_doc = sqlx::query(
        "SELECT id, version FROM ats_v2.documents WHERE tenant_id=$1 AND candidate_id=$2 ORDER BY version DESC LIMIT 1"
    )
    .bind(user.tenant_id)
    .bind(id)
    .fetch_optional(&mut *tx)
    .await?;

    if let Some(doc) = latest_doc {
        let doc_id: Uuid = doc.get("id");
        let doc_version: i32 = doc.get("version");

        let apps = sqlx::query(
            "SELECT a.id as application_id, j.revision as job_revision FROM ats_v2.applications a JOIN ats_v2.jobs j ON j.id=a.job_id AND j.tenant_id=a.tenant_id WHERE a.candidate_id=$1 AND a.tenant_id=$2 AND a.stage NOT IN ('Withdrawn', 'Rejected')"
        )
        .bind(id)
        .bind(user.tenant_id)
        .fetch_all(&mut *tx)
        .await?;

        if !apps.is_empty() {
            for app in apps {
                let app_id: Uuid = app.get("application_id");
                let job_rev: i32 = app.get("job_revision");
                let job_id = Uuid::new_v4();
                sqlx::query(
                    "INSERT INTO ats_v2.processing_jobs(id,tenant_id,candidate_id,document_id,application_id,operation,input_revision,job_revision,document_version) VALUES($1,$2,$3,$4,$5,'evaluate',$6,$7,$8)"
                )
                .bind(job_id)
                .bind(user.tenant_id)
                .bind(id)
                .bind(doc_id)
                .bind(app_id)
                .bind(new_revision)
                .bind(job_rev)
                .bind(doc_version)
                .execute(&mut *tx)
                .await?;

                sqlx::query("INSERT INTO ats_v2.outbox(job_id) VALUES($1)")
                    .bind(job_id)
                    .execute(&mut *tx)
                    .await?;
            }
        } else {
            let job_id = Uuid::new_v4();
            sqlx::query(
                "INSERT INTO ats_v2.processing_jobs(id,tenant_id,candidate_id,document_id,application_id,operation,input_revision,job_revision,document_version) VALUES($1,$2,$3,$4,NULL,'evaluate',$5,NULL,$6)"
            )
            .bind(job_id)
            .bind(user.tenant_id)
            .bind(id)
            .bind(doc_id)
            .bind(new_revision)
            .bind(doc_version)
            .execute(&mut *tx)
            .await?;

            sqlx::query("INSERT INTO ats_v2.outbox(job_id) VALUES($1)")
                .bind(job_id)
                .execute(&mut *tx)
                .await?;
        }
    }

    audit(&mut tx, &user, "EDIT_CANDIDATE", "candidate", id).await?;
    tx.commit().await?;
    Ok(Json(json!({"status":"updated","revision":new_revision})))
}

#[derive(Deserialize, Serialize, utoipa::ToSchema, Clone)]
pub struct InterviewInput {
    pub round: String,
    pub scheduled_at: String,
    #[serde(default)]
    pub interviewer_name: String,
    pub interviewer_email: Option<String>,
    pub notes: Option<String>,
    #[serde(default = "default_interview_outcome")]
    pub outcome: String,
}
fn default_interview_outcome() -> String {
    "SCHEDULED".into()
}

impl InterviewInput {
    pub fn validate(&self) -> Result<()> {
        if self.round.trim().is_empty() || self.round.len() > 200 {
            return Err(bad(
                "Interview round name must be between 1 and 200 characters.",
            ));
        }
        if self.scheduled_at.trim().is_empty() {
            return Err(bad("Interview scheduled date is required."));
        }
        if !["SCHEDULED", "PASSED", "FAILED", "CANCELLED", "COMPLETED"]
            .contains(&self.outcome.as_str())
        {
            return Err(bad(
                "Interview outcome must be SCHEDULED, PASSED, FAILED, CANCELLED, or COMPLETED.",
            ));
        }
        Ok(())
    }
}

pub async fn list_interviews(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row = sqlx::query(
        "SELECT interviews FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3",
    )
    .bind(user.tenant_id)
    .bind(job)
    .bind(candidate)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;
    let interviews: Value = row.get("interviews");
    tx.commit().await?;
    Ok(Json(interviews))
}

pub async fn record_interview(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate)): Path<(Uuid, Uuid)>,
    Json(input): Json<InterviewInput>,
) -> Result<Json<Value>> {
    user.write()?;
    input.validate()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;

    let job_row = sqlx::query("SELECT status FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2")
        .bind(job)
        .bind(user.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let job_status: String = job_row.get("status");
    if job_status == "CLOSED" {
        return Err(bad("Job is closed. Cannot schedule or record interviews."));
    }

    let app_row = sqlx::query(
        "SELECT id, stage, interviews FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3 FOR UPDATE",
    )
    .bind(user.tenant_id)
    .bind(job)
    .bind(candidate)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;

    let app_id: Uuid = app_row.get("id");
    let current_stage: String = app_row.get("stage");
    let mut interviews: Vec<Value> =
        serde_json::from_value(app_row.get("interviews")).unwrap_or_default();

    let interview_id = Uuid::new_v4();
    let interviewer = if input.interviewer_name.trim().is_empty() {
        &user.name
    } else {
        input.interviewer_name.trim()
    };
    let new_entry = json!({
        "id": interview_id,
        "round": input.round.trim(),
        "scheduled_at": input.scheduled_at.trim(),
        "interviewer_name": interviewer,
        "interviewer_email": input.interviewer_email,
        "notes": input.notes,
        "outcome": input.outcome,
        "created_at": chrono::Utc::now(),
    });
    interviews.push(new_entry.clone());

    let next_stage = if [
        "Screening",
        "Review Required",
        "Qualified",
        "Talent Pool",
        "Applied",
    ]
    .contains(&current_stage.as_str())
    {
        "Interview"
    } else {
        &current_stage
    };

    sqlx::query(
        "UPDATE ats_v2.applications SET interviews=$1, stage=$2, revision=revision+1 WHERE id=$3 AND tenant_id=$4",
    )
    .bind(json!(interviews))
    .bind(next_stage)
    .bind(app_id)
    .bind(user.tenant_id)
    .execute(&mut *tx)
    .await?;

    if next_stage != current_stage {
        sqlx::query(
            "INSERT INTO ats_v2.stage_transitions(id,tenant_id,application_id,actor_id,from_stage,to_stage) VALUES($1,$2,$3,$4,$5,$6)",
        )
        .bind(Uuid::new_v4())
        .bind(user.tenant_id)
        .bind(app_id)
        .bind(user.user_id)
        .bind(&current_stage)
        .bind(next_stage)
        .execute(&mut *tx)
        .await?;
    }

    audit(&mut tx, &user, "RECORD_INTERVIEW", "application", app_id).await?;
    tx.commit().await?;
    Ok(Json(new_entry))
}

pub async fn update_interview(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate, interview_id)): Path<(Uuid, Uuid, Uuid)>,
    Json(input): Json<Value>,
) -> Result<Json<Value>> {
    user.write()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;

    let job_row = sqlx::query("SELECT status FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2")
        .bind(job)
        .bind(user.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let job_status: String = job_row.get("status");
    if job_status == "CLOSED" {
        return Err(bad("Job is closed. Cannot modify interviews."));
    }

    let app_row = sqlx::query(
        "SELECT id, interviews FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3 FOR UPDATE",
    )
    .bind(user.tenant_id)
    .bind(job)
    .bind(candidate)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;

    let app_id: Uuid = app_row.get("id");
    let mut interviews: Vec<Value> =
        serde_json::from_value(app_row.get("interviews")).unwrap_or_default();
    let interview_id_str = interview_id.to_string();
    let found = interviews
        .iter_mut()
        .find(|item| item.get("id").and_then(Value::as_str) == Some(&interview_id_str));
    let entry = found.ok_or_else(missing)?;

    if let Some(outcome) = input.get("outcome").and_then(Value::as_str) {
        if !["SCHEDULED", "PASSED", "FAILED", "CANCELLED", "COMPLETED"].contains(&outcome) {
            return Err(bad("Invalid interview outcome."));
        }
        entry["outcome"] = json!(outcome);
    }
    if let Some(notes) = input.get("notes") {
        entry["notes"] = notes.clone();
    }
    if let Some(scheduled_at) = input.get("scheduled_at").and_then(Value::as_str) {
        entry["scheduled_at"] = json!(scheduled_at);
    }
    if let Some(interviewer) = input.get("interviewer_name").and_then(Value::as_str) {
        entry["interviewer_name"] = json!(interviewer);
    }
    entry["updated_at"] = json!(chrono::Utc::now());

    let updated_entry = entry.clone();

    sqlx::query(
        "UPDATE ats_v2.applications SET interviews=$1, revision=revision+1 WHERE id=$2 AND tenant_id=$3",
    )
    .bind(json!(interviews))
    .bind(app_id)
    .bind(user.tenant_id)
    .execute(&mut *tx)
    .await?;

    audit(&mut tx, &user, "UPDATE_INTERVIEW", "application", app_id).await?;
    tx.commit().await?;
    Ok(Json(updated_entry))
}

#[derive(Deserialize, Serialize, utoipa::ToSchema, Clone)]
pub struct OfferInput {
    pub status: String,
    pub base_salary: Option<f64>,
    #[serde(default = "default_currency")]
    pub currency: String,
    pub equity: Option<String>,
    pub sign_on_bonus: Option<f64>,
    pub start_date: Option<String>,
    pub notes: Option<String>,
}
fn default_currency() -> String {
    "USD".into()
}

impl OfferInput {
    pub fn validate(&self) -> Result<()> {
        if ![
            "NOT_STARTED",
            "DRAFTED",
            "EXTENDED",
            "ACCEPTED",
            "DECLINED",
            "REVISED",
        ]
        .contains(&self.status.as_str())
        {
            return Err(bad(
                "Offer status must be NOT_STARTED, DRAFTED, EXTENDED, ACCEPTED, DECLINED, or REVISED.",
            ));
        }
        if let Some(s) = self.base_salary
            && (!s.is_finite() || s < 0.0)
        {
            return Err(bad("Base salary must be a positive number."));
        }
        if let Some(b) = self.sign_on_bonus
            && (!b.is_finite() || b < 0.0)
        {
            return Err(bad("Sign-on bonus must be a positive number."));
        }
        Ok(())
    }
}

pub async fn get_offer(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate)): Path<(Uuid, Uuid)>,
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row = sqlx::query(
        "SELECT offer FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3",
    )
    .bind(user.tenant_id)
    .bind(job)
    .bind(candidate)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;
    let offer: Value = row.get("offer");
    tx.commit().await?;
    Ok(Json(offer))
}

pub async fn record_offer(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path((job, candidate)): Path<(Uuid, Uuid)>,
    Json(input): Json<OfferInput>,
) -> Result<Json<Value>> {
    user.write()?;
    input.validate()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;

    let job_row = sqlx::query("SELECT status FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2")
        .bind(job)
        .bind(user.tenant_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let job_status: String = job_row.get("status");
    if job_status == "CLOSED" {
        return Err(bad("Job is closed. Cannot record offers."));
    }

    let app_row = sqlx::query(
        "SELECT id, stage FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3 FOR UPDATE",
    )
    .bind(user.tenant_id)
    .bind(job)
    .bind(candidate)
    .fetch_optional(&mut *tx)
    .await?
    .ok_or_else(missing)?;

    let app_id: Uuid = app_row.get("id");
    let current_stage: String = app_row.get("stage");

    let offer_obj = json!({
        "status": input.status,
        "base_salary": input.base_salary,
        "currency": input.currency,
        "equity": input.equity,
        "sign_on_bonus": input.sign_on_bonus,
        "start_date": input.start_date,
        "notes": input.notes,
        "recorded_by": user.name,
        "updated_at": chrono::Utc::now(),
    });

    let next_stage = match input.status.as_str() {
        "EXTENDED" => "Offered",
        "ACCEPTED" => "Hired",
        "DECLINED" => "Rejected",
        _ => &current_stage,
    };

    sqlx::query(
        "UPDATE ats_v2.applications SET offer=$1, stage=$2, revision=revision+1 WHERE id=$3 AND tenant_id=$4",
    )
    .bind(&offer_obj)
    .bind(next_stage)
    .bind(app_id)
    .bind(user.tenant_id)
    .execute(&mut *tx)
    .await?;

    if next_stage != current_stage {
        sqlx::query(
            "INSERT INTO ats_v2.stage_transitions(id,tenant_id,application_id,actor_id,from_stage,to_stage) VALUES($1,$2,$3,$4,$5,$6)",
        )
        .bind(Uuid::new_v4())
        .bind(user.tenant_id)
        .bind(app_id)
        .bind(user.user_id)
        .bind(&current_stage)
        .bind(next_stage)
        .execute(&mut *tx)
        .await?;
    }

    audit(&mut tx, &user, "RECORD_OFFER", "application", app_id).await?;
    tx.commit().await?;
    Ok(Json(offer_obj))
}
