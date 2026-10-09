use crate::{ApiError, AppState, Result, audit, auth::Identity, bad, missing, tenant_tx, text};
use axum::{
    Extension, Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::{Postgres, Row, Transaction, postgres::PgRow};
use uuid::Uuid;

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
}
#[derive(Deserialize, Serialize, utoipa::ToSchema)]
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
}
impl JobInput {
    pub(crate) fn validate(&self) -> Result<()> {
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
) -> Result<Json<Value>> {
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let rows=sqlx::query("SELECT j.*, (SELECT count(*) FROM ats_v2.applications a WHERE a.tenant_id=j.tenant_id AND a.job_id=j.id) candidates_count,(SELECT max(current_score) FROM ats_v2.applications a WHERE a.tenant_id=j.tenant_id AND a.job_id=j.id) top_score FROM ats_v2.jobs j WHERE j.tenant_id=$1 AND ($2::text IS NULL OR j.status=$2) AND ($3::text IS NULL OR j.department=$3) AND ($4::text IS NULL OR j.title ILIKE '%'||$4||'%') ORDER BY j.created_at DESC LIMIT 500")
        .bind(user.tenant_id).bind(f.status).bind(f.department).bind(f.search).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(Value::Array(rows.iter().map(job_json).collect())))
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
    let row=sqlx::query("INSERT INTO ats_v2.jobs(id,tenant_id,title,department,location,job_description,required_skills,min_years_experience) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *")
        .bind(id).bind(user.tenant_id).bind(input.title.trim()).bind(input.department).bind(input.location).bind(input.job_description).bind(json!(input.required_skills)).bind(input.min_years_experience).fetch_one(&mut *tx).await?;
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
    let row=sqlx::query("UPDATE ats_v2.jobs SET title=$3,department=$4,location=$5,job_description=$6,required_skills=$7,min_years_experience=$8,revision=revision+1,updated_at=now() WHERE id=$1 AND tenant_id=$2 RETURNING *")
        .bind(id).bind(user.tenant_id).bind(input.title.trim()).bind(input.department).bind(input.location).bind(input.job_description).bind(json!(input.required_skills)).bind(input.min_years_experience).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    audit(&mut tx, &user, "UPDATE_JOB", "job", id).await?;
    tx.commit().await?;
    Ok(Json(job_json(&row)))
}
pub fn empty_scorecard() -> Value {
    json!({"overall_match_score":null,"evaluation_status":"PENDING","match_tier":"Not Evaluated","model_version":"","evaluated_at":"","categories":[],"risk_flags":[],"suggested_improvements":[],"suggested_questions":[],"team_notes":[]})
}
pub async fn candidate_json(
    tx: &mut Transaction<'_, Postgres>,
    user: &Identity,
    row: &PgRow,
    pii: bool,
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
    let apps=sqlx::query("SELECT a.id,a.job_id,a.stage,a.current_score,j.title FROM ats_v2.applications a JOIN ats_v2.jobs j ON j.id=a.job_id AND j.tenant_id=a.tenant_id WHERE a.candidate_id=$1 AND a.tenant_id=$2 ORDER BY a.created_at DESC").bind(id).bind(user.tenant_id).fetch_all(&mut **tx).await?;
    p["applications"]=json!(apps.iter().map(|a|json!({"id":a.get::<Uuid,_>("id"),"job_id":a.get::<Uuid,_>("job_id"),"job_title":a.get::<String,_>("title"),"stage":a.get::<String,_>("stage"),"match_score":a.get::<Option<f64>,_>("current_score")})).collect::<Vec<_>>());
    p["stage"] = json!(
        apps.first()
            .map(|a| a.get::<String, _>("stage"))
            .unwrap_or("Talent Pool".into())
    );
    p["status"] = p["stage"].clone();
    p["applied_for_job"] = json!(
        apps.first()
            .map(|a| a.get::<String, _>("title"))
            .unwrap_or("Talent Pool".into())
    );
    p["applied_for_job_id"] = json!(apps.first().map(|a| a.get::<Uuid, _>("job_id")));
    let selected_application = apps.first().map(|a| a.get::<Uuid, _>("id"));
    let score:Option<Value>=sqlx::query_scalar("SELECT e.scorecard FROM ats_v2.evaluations e JOIN ats_v2.processing_jobs p ON p.id=e.processing_job_id WHERE e.application_id=$1 AND e.tenant_id=$2 AND p.input_revision=$3 ORDER BY e.created_at DESC LIMIT 1").bind(selected_application).bind(user.tenant_id).bind(row.get::<i32,_>("revision")).fetch_optional(&mut **tx).await?;
    p["scorecard"] = score.unwrap_or_else(empty_scorecard);
    let notes=sqlx::query("SELECT n.*,u.name FROM ats_v2.notes n JOIN ats_v2.users u ON u.id=n.actor_id WHERE n.candidate_id=$1 AND n.tenant_id=$2 ORDER BY n.created_at").bind(id).bind(user.tenant_id).fetch_all(&mut **tx).await?;
    p["scorecard"]["team_notes"] = json!(notes.iter().map(note_json).collect::<Vec<_>>());
    // Raw text/contact fields are intentionally never embedded in the public profile.
    if let Some(o) = p.as_object_mut() {
        o.remove("raw_text");
        o.remove("raw_anonymized_text");
        o.remove("structured_profile");
        o.remove("resume_filename");
    }
    if !pii {
        redact_profile(&mut p, &contact);
    }
    Ok(p)
}

/// Apply the same privacy policy to recruiter edits, notes and AI-produced fields.
pub fn redact_profile(value: &mut Value, contact: &Value) {
    let mut patterns = vec![
        r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}".to_owned(),
        r"\+?\d[\d ()-]{8,}\d".to_owned(),
    ];
    if let Some(fields) = contact.as_object() {
        for item in fields
            .values()
            .filter_map(Value::as_str)
            .filter(|s| s.trim().len() >= 3 && *s != "N/A")
        {
            patterns.push(regex::escape(item.trim()));
        }
    }
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
) -> Result<Json<Value>> {
    if f.include_pii {
        user.pii()?;
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let rows=sqlx::query("SELECT c.* FROM ats_v2.candidates c WHERE c.tenant_id=$1 AND c.deleted_at IS NULL AND ($2::text IS NULL OR c.sanitized_text ILIKE '%'||$2||'%' OR ($5 AND c.contact->>'name' ILIKE '%'||$2||'%')) AND ($3::text IS NULL OR EXISTS(SELECT 1 FROM ats_v2.applications a WHERE a.tenant_id=c.tenant_id AND a.candidate_id=c.id AND a.stage=$3)) AND ($4::text IS NULL OR c.profile->'core_skills' ? $4) ORDER BY c.created_at DESC LIMIT 500")
        .bind(user.tenant_id).bind(f.search).bind(f.stage).bind(f.skill).bind(f.include_pii).fetch_all(&mut *tx).await?;
    let mut values = vec![];
    for row in rows {
        values.push(candidate_json(&mut tx, &user, &row, f.include_pii).await?);
    }
    if f.include_pii {
        audit(&mut tx, &user, "VIEW_CANDIDATES_PII", "candidate", "list").await?;
    }
    tx.commit().await?;
    Ok(Json(json!(values)))
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
    let value = candidate_json(&mut tx, &user, &row, f.include_pii).await?;
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
    let score:Option<Value>=sqlx::query_scalar("SELECT e.scorecard FROM ats_v2.evaluations e JOIN ats_v2.applications a ON a.id=e.application_id AND a.tenant_id=e.tenant_id JOIN ats_v2.candidates c ON c.id=a.candidate_id AND c.tenant_id=a.tenant_id JOIN ats_v2.processing_jobs p ON p.id=e.processing_job_id WHERE a.candidate_id=$1 AND e.tenant_id=$2 AND p.input_revision=c.revision AND ($3::uuid IS NULL OR a.job_id=$3) ORDER BY e.created_at DESC LIMIT 1").bind(id).bind(user.tenant_id).bind(f.job_id).fetch_optional(&mut *tx).await?;
    let mut score = score.unwrap_or_else(empty_scorecard);
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
    let row=sqlx::query("SELECT id,stage FROM ats_v2.applications WHERE tenant_id=$1 AND job_id=$2 AND candidate_id=$3 FOR UPDATE").bind(user.tenant_id).bind(job).bind(candidate).fetch_optional(&mut **tx).await?.ok_or_else(missing)?;
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
    let ids:Vec<Uuid>=sqlx::query_scalar("SELECT job_id FROM ats_v2.applications WHERE candidate_id=$1 AND tenant_id=$2 AND ($3::uuid IS NULL OR job_id=$3)").bind(candidate).bind(user.tenant_id).bind(f.job_id).fetch_all(&mut *tx).await?;
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
    Ok(Json(
        values
            .into_iter()
            .find(|v| v["id"] == json!(candidate))
            .ok_or_else(missing)?,
    ))
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
    let rows=sqlx::query("SELECT c.*,a.id application_id,a.stage application_stage,a.current_score FROM ats_v2.applications a JOIN ats_v2.candidates c ON c.id=a.candidate_id AND c.tenant_id=a.tenant_id WHERE a.job_id=$1 AND a.tenant_id=$2 AND c.deleted_at IS NULL ORDER BY a.current_score DESC NULLS LAST,a.created_at").bind(job).bind(user.tenant_id).fetch_all(&mut **tx).await?;
    Ok(rows.iter().enumerate().map(|(i,r)| {let mut p:Value=r.get("profile");redact_profile(&mut p,&r.get::<Value,_>("contact"));let id:Uuid=r.get("id");json!({"id":id,"application_id":r.get::<Uuid,_>("application_id"),"jobId":job,"rank":i+1,"name":format!("Candidate #{}",&id.simple().to_string()[..8]),"headline":p.get("target_headline").unwrap_or(&json!("Pending extraction")),"avatar":"CD","isImageAvatar":false,"matchScore":r.get::<Option<f64>,_>("current_score"),"matchLabel":"Job-specific evaluation","skills":p.get("core_skills").unwrap_or(&json!([])),"stage":r.get::<String,_>("application_stage"),"sourceResumeLink":format!("/candidates/{id}"),"quote":"","suggestedQuestions":[]})}).collect())
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
    let candidate = if let Some(id) = input.get("id").and_then(Value::as_str) {
        Uuid::parse_str(id).map_err(|_| bad("Invalid candidate ID."))?
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
    let old=sqlx::query("SELECT profile,contact FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND revision=$3 AND deleted_at IS NULL FOR UPDATE").bind(id).bind(user.tenant_id).bind(input.revision).fetch_optional(&mut *tx).await?.ok_or(ApiError(StatusCode::CONFLICT,"Profile changed. Refresh before saving."))?;
    let mut merged: Value = old.get("profile");
    merged
        .as_object_mut()
        .unwrap()
        .extend(safe.as_object().unwrap().clone());
    redact_profile(&mut merged, &old.get::<Value, _>("contact"));
    let mut merged_contact: Value = old.get("contact");
    merged_contact
        .as_object_mut()
        .unwrap()
        .extend(contact.as_object().unwrap().clone());
    redact_profile(&mut merged, &merged_contact);
    let sanitized = merged.to_string();
    let updated=sqlx::query("UPDATE ats_v2.candidates SET profile=$4,contact=$5,sanitized_text=$6,revision=revision+1,updated_at=now() WHERE id=$1 AND tenant_id=$2 AND revision=$3 AND deleted_at IS NULL").bind(id).bind(user.tenant_id).bind(input.revision).bind(merged).bind(merged_contact).bind(sanitized).execute(&mut *tx).await?;
    if updated.rows_affected() != 1 {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Profile changed. Refresh before saving.",
        ));
    }
    sqlx::query("DELETE FROM ats_v2.embeddings WHERE tenant_id=$1 AND document_id IN (SELECT id FROM ats_v2.documents WHERE tenant_id=$1 AND candidate_id=$2)").bind(user.tenant_id).bind(id).execute(&mut *tx).await?;
    sqlx::query(
        "UPDATE ats_v2.applications SET current_score=NULL WHERE tenant_id=$1 AND candidate_id=$2",
    )
    .bind(user.tenant_id)
    .bind(id)
    .execute(&mut *tx)
    .await?;
    audit(&mut tx, &user, "EDIT_CANDIDATE", "candidate", id).await?;
    tx.commit().await?;
    Ok(Json(
        json!({"status":"updated","revision":input.revision+1}),
    ))
}
