use crate::{
    ApiError, AppState, Result, audit, auth::Identity, bad, domain, hash, missing, tenant_tx,
};
use axum::{
    Extension, Json,
    extract::{Multipart, Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};
use object_store::path::Path as ObjectPath;
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::Row;
use uuid::Uuid;

pub async fn upload(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<Value>)> {
    user.write()?;
    let mut data = None;
    let mut filename = String::new();
    let mut job_id = None;
    let mut existing_candidate = None;
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| bad("Invalid upload."))?
    {
        match field.name().unwrap_or("") {
            "file" => {
                if data.is_some() {
                    return Err(bad("Upload one PDF at a time."));
                }
                filename = field
                    .file_name()
                    .unwrap_or("resume.pdf")
                    .split(['/', '\\'])
                    .next_back()
                    .unwrap_or("resume.pdf")
                    .chars()
                    .take(200)
                    .collect();
                data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|_| bad("Invalid PDF upload."))?,
                );
            }
            "job_id" => {
                let text = field.text().await.map_err(|_| bad("Invalid job ID."))?;
                if !text.is_empty() {
                    job_id = Some(Uuid::parse_str(&text).map_err(|_| bad("Invalid job ID."))?);
                }
            }
            "candidate_id" => {
                let text = field
                    .text()
                    .await
                    .map_err(|_| bad("Invalid candidate ID."))?;
                existing_candidate =
                    Some(Uuid::parse_str(&text).map_err(|_| bad("Invalid candidate ID."))?);
            }
            _ => return Err(bad("Unexpected upload field.")),
        }
    }
    let data = data.ok_or_else(|| bad("PDF is required."))?;
    if !data.starts_with(b"%PDF-")
        || data.len() > state.config.max_upload
        || !filename.to_lowercase().ends_with(".pdf")
    {
        return Err(bad("Upload a PDF within the configured size limit."));
    }
    let source = hash(&data);
    let fingerprint = hash(format!("{source}:{job_id:?}:{existing_candidate:?}").as_bytes());
    let idem = headers
        .get("idempotency-key")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned)
        .unwrap_or_else(|| Uuid::new_v4().to_string());
    if idem.is_empty() || idem.len() > 200 {
        return Err(bad("Invalid idempotency key."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("{}:{idem}", user.tenant_id))
        .execute(&mut *tx)
        .await?;
    if let Some(row)=sqlx::query("SELECT r.source_hash,p.id,p.candidate_id,p.application_id FROM ats_v2.upload_requests r JOIN ats_v2.processing_jobs p ON p.id=r.job_id WHERE r.tenant_id=$1 AND r.idempotency_key=$2").bind(user.tenant_id).bind(&idem).fetch_optional(&mut *tx).await? {
        if row.get::<String,_>("source_hash")!=fingerprint{return Err(ApiError(StatusCode::CONFLICT,"Idempotency key was used for different input."));}
        return Ok((StatusCode::ACCEPTED,Json(upload_response(row.get("id"),row.get("candidate_id"),&filename,job_id))));
    }
    let job_revision = if let Some(id) = job_id {
        Some(
            sqlx::query_scalar::<_, i32>(
                "SELECT revision FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2 AND status='OPEN'",
            )
            .bind(id)
            .bind(user.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(missing)?,
        )
    } else {
        None
    };
    let candidate = existing_candidate.unwrap_or_else(Uuid::new_v4);
    let (revision, version) = if existing_candidate.is_some() {
        user.pii()?;
        let revision:i32=sqlx::query_scalar("SELECT revision FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL FOR UPDATE").bind(candidate).bind(user.tenant_id).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
        let version:i32=sqlx::query_scalar("SELECT coalesce(max(version),0)+1 FROM ats_v2.documents WHERE candidate_id=$1 AND tenant_id=$2").bind(candidate).bind(user.tenant_id).fetch_one(&mut *tx).await?;
        (revision + 1, version)
    } else {
        (1, 1)
    };
    let document = Uuid::new_v4();
    let task = Uuid::new_v4();
    let mut application = job_id.map(|_| Uuid::new_v4());
    let key = format!("{}/{candidate}/{document}.pdf", user.tenant_id);
    state
        .objects
        .put(&ObjectPath::from(key.clone()), data.clone().into())
        .await
        .map_err(|_| {
            ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Document storage is unavailable.",
            )
        })?;
    let writes=async {
        if existing_candidate.is_some() {
            sqlx::query("UPDATE ats_v2.candidates SET revision=$3,processing_status='PENDING',updated_at=now() WHERE id=$1 AND tenant_id=$2").bind(candidate).bind(user.tenant_id).bind(revision).execute(&mut *tx).await?;
            sqlx::query("UPDATE ats_v2.applications SET current_score=NULL WHERE candidate_id=$1 AND tenant_id=$2").bind(candidate).bind(user.tenant_id).execute(&mut *tx).await?;
        } else {sqlx::query("INSERT INTO ats_v2.candidates(id,tenant_id) VALUES($1,$2)").bind(candidate).bind(user.tenant_id).execute(&mut *tx).await?;}
        sqlx::query("INSERT INTO ats_v2.documents(id,tenant_id,candidate_id,version,object_key,source_hash,filename,size_bytes) VALUES($1,$2,$3,$8,$4,$5,$6,$7)").bind(document).bind(user.tenant_id).bind(candidate).bind(&key).bind(&source).bind(&filename).bind(data.len() as i64).bind(version).execute(&mut *tx).await?;
        if let (Some(app),Some(job))=(application,job_id) {application=Some(sqlx::query_scalar("INSERT INTO ats_v2.applications(id,tenant_id,candidate_id,job_id) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,candidate_id,job_id) DO UPDATE SET candidate_id=EXCLUDED.candidate_id RETURNING id").bind(app).bind(user.tenant_id).bind(candidate).bind(job).fetch_one(&mut *tx).await?);}
        sqlx::query("INSERT INTO ats_v2.processing_jobs(id,tenant_id,candidate_id,document_id,application_id,operation,input_revision,job_revision,document_version) VALUES($1,$2,$3,$4,$5,'ingest',$7,$6,$8)").bind(task).bind(user.tenant_id).bind(candidate).bind(document).bind(application).bind(job_revision).bind(revision).bind(version).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO ats_v2.outbox(job_id) VALUES($1)").bind(task).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO ats_v2.upload_requests(tenant_id,idempotency_key,source_hash,job_id) VALUES($1,$2,$3,$4)").bind(user.tenant_id).bind(idem).bind(fingerprint).bind(task).execute(&mut *tx).await?;
        audit(&mut tx,&user,"UPLOAD_RESUME","document",document).await?;
        std::result::Result::<(),ApiError>::Ok(())
    }.await;
    if let Err(error) = writes {
        let _ = state.objects.delete(&ObjectPath::from(key)).await;
        return Err(error);
    }
    // If commit outcome is uncertain, retain the object for reconciliation rather than delete a potentially committed document.
    tx.commit().await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(upload_response(task, candidate, &filename, job_id)),
    ))
}
fn upload_response(task: Uuid, candidate: Uuid, filename: &str, job_id: Option<Uuid>) -> Value {
    json!({"status":"ACCEPTED","task_id":task,"candidate_id":candidate,"filename":filename,"execution_mode":"durable_queue","evaluation_status":"PROCESSING","match_score":null,"job_id":job_id,"applied_for_job_id":job_id,"message":"Resume stored and queued for processing."})
}
pub async fn task_status(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Json<Value>> {
    let row = sqlx::query("SELECT * FROM ats_v2.processing_jobs WHERE id=$1 AND tenant_id=$2")
        .bind(id)
        .bind(user.tenant_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(missing)?;
    let status: String = row.get("state");
    let public = match status.as_str() {
        "SUCCEEDED" => "SUCCESS",
        "FAILED" | "CANCELLED" | "STALE" => "FAILURE",
        "RUNNING" => "PROGRESS",
        _ => "PENDING",
    };
    let result: Option<Value> = row.get("result");
    Ok(Json(
        json!({"task_id":id,"state":public,"processing_state":status,"execution_mode":"durable_queue","progress":row.get::<i32,_>("progress"),"step":row.get::<String,_>("step"),"error":row.get::<Option<String>,_>("error_code"),"result":result}),
    ))
}
pub async fn resume(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(id): Path<Uuid>,
) -> Result<Response> {
    user.pii()?;
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row=sqlx::query("SELECT d.object_key FROM ats_v2.documents d JOIN ats_v2.candidates c ON c.id=d.candidate_id AND c.tenant_id=d.tenant_id WHERE d.candidate_id=$1 AND d.tenant_id=$2 AND c.deleted_at IS NULL ORDER BY d.version DESC LIMIT 1").bind(id).bind(user.tenant_id).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    let bytes = read_object(&state, &row.get::<String, _>("object_key")).await?;
    audit(&mut tx, &user, "DOWNLOAD_RESUME", "candidate", id).await?;
    tx.commit().await?;
    Ok((
        [
            (header::CONTENT_TYPE, "application/pdf"),
            (header::CACHE_CONTROL, "private, no-store"),
            (header::CONTENT_DISPOSITION, "inline; filename=resume.pdf"),
            (
                header::HeaderName::from_static("x-content-type-options"),
                "nosniff",
            ),
        ],
        bytes,
    )
        .into_response())
}
async fn read_object(state: &AppState, key: &str) -> Result<bytes::Bytes> {
    state
        .objects
        .get(&ObjectPath::from(key))
        .await
        .map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE, "Document is unavailable."))?
        .bytes()
        .await
        .map_err(|_| ApiError(StatusCode::SERVICE_UNAVAILABLE, "Document is unavailable."))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Attempt {
    pub attempt_id: Uuid,
}
pub async fn lease(State(state): State<AppState>, Path(id): Path<Uuid>) -> Result<Json<Value>> {
    let mut tx = state.db.begin().await?;
    let row = sqlx::query("SELECT * FROM ats_v2.processing_jobs WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let tenant: Uuid = row.get("tenant_id");
    sqlx::query("SELECT set_config('ats.tenant_id',$1,true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await?;
    let status: String = row.get("state");
    let until: Option<chrono::DateTime<chrono::Utc>> = row.get("lease_until");
    if ["SUCCEEDED", "FAILED", "STALE", "CANCELLED"].contains(&status.as_str())
        || (status == "RUNNING" && until.is_some_and(|v| v > chrono::Utc::now()))
    {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Job is terminal or already leased.",
        ));
    }
    if row.get::<i32, _>("attempts") >= state.config.max_attempts {
        return Err(ApiError(StatusCode::CONFLICT, "Retry limit reached."));
    }
    let attempt = Uuid::new_v4();
    sqlx::query("UPDATE ats_v2.processing_jobs SET state='RUNNING',attempt_id=$2,attempts=attempts+1,lease_until=now()+make_interval(secs=>$3),updated_at=now(),progress=10,step='Parsing' WHERE id=$1").bind(id).bind(attempt).bind(state.config.lease_seconds as f64).execute(&mut *tx).await?;
    let document = sqlx::query("SELECT * FROM ats_v2.documents WHERE id=$1 AND tenant_id=$2")
        .bind(row.get::<Uuid, _>("document_id"))
        .bind(tenant)
        .fetch_one(&mut *tx)
        .await?;
    let candidate=sqlx::query("SELECT profile,sanitized_text FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL").bind(row.get::<Uuid,_>("candidate_id")).bind(tenant).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    let application: Option<Uuid> = row.get("application_id");
    let job = if let Some(app) = application {
        sqlx::query("SELECT j.* FROM ats_v2.jobs j JOIN ats_v2.applications a ON a.job_id=j.id AND a.tenant_id=j.tenant_id WHERE a.id=$1 AND a.tenant_id=$2").bind(app).bind(tenant).fetch_optional(&mut *tx).await?.map(|r|domain::job_json(&r))
    } else {
        None
    };
    let taxonomy:Vec<Value>=sqlx::query_scalar("SELECT jsonb_build_object('id',id,'canonical_name',canonical_name,'category',category,'aliases',aliases,'is_ambiguous',is_ambiguous,'status',status) FROM ats_v2.taxonomy WHERE tenant_id=$1 AND status='approved' ORDER BY canonical_name").bind(tenant).fetch_all(&mut *tx).await?;
    let taxonomy_version = hash(json!(taxonomy).to_string().as_bytes());
    let payload = json!({"contract_version":1,"job_id":id,"attempt_id":attempt,"tenant_id":tenant,"candidate_id":row.get::<Uuid,_>("candidate_id"),"document_id":row.get::<Uuid,_>("document_id"),"document_version":row.get::<i32,_>("document_version"),"input_revision":row.get::<i32,_>("input_revision"),"job_revision":row.get::<Option<i32>,_>("job_revision"),"operation":row.get::<String,_>("operation"),"filename":document.get::<String,_>("filename"),"source_hash":document.get::<String,_>("source_hash"),"job":job,"profile":candidate.get::<Value,_>("profile"),"sanitized_text":candidate.get::<String,_>("sanitized_text"),"taxonomy":taxonomy,"taxonomy_version":taxonomy_version,"trace_id":id});
    tx.commit().await?;
    Ok(Json(payload))
}
pub async fn worker_document(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    axum::extract::Query(input): axum::extract::Query<Attempt>,
) -> Result<Response> {
    let row=sqlx::query("SELECT tenant_id,document_id FROM ats_v2.processing_jobs WHERE id=$1 AND attempt_id=$2 AND state='RUNNING' AND lease_until>now()").bind(id).bind(input.attempt_id).fetch_optional(&state.db).await?.ok_or_else(missing)?;
    let mut tx = tenant_tx(&state.db, row.get("tenant_id")).await?;
    let key: String =
        sqlx::query_scalar("SELECT object_key FROM ats_v2.documents WHERE id=$1 AND tenant_id=$2")
            .bind(row.get::<Uuid, _>("document_id"))
            .bind(row.get::<Uuid, _>("tenant_id"))
            .fetch_one(&mut *tx)
            .await?;
    Ok((
        [
            (header::CONTENT_TYPE, "application/pdf"),
            (header::CACHE_CONTROL, "no-store"),
        ],
        read_object(&state, &key).await?,
    )
        .into_response())
}
pub async fn heartbeat(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<Attempt>,
) -> Result<Json<Value>> {
    let count=sqlx::query("UPDATE ats_v2.processing_jobs SET lease_until=now()+make_interval(secs=>$3),updated_at=now() WHERE id=$1 AND attempt_id=$2 AND state='RUNNING' AND lease_until>now()").bind(id).bind(input.attempt_id).bind(state.config.lease_seconds as f64).execute(&state.db).await?;
    if count.rows_affected() != 1 {
        return Err(ApiError(StatusCode::CONFLICT, "Lease expired."));
    }
    Ok(Json(json!({"status":"renewed"})))
}

#[derive(Deserialize, utoipa::ToSchema)]
#[serde(deny_unknown_fields)]
pub struct AIResult {
    pub contract_version: i32,
    pub attempt_id: Uuid,
    pub document_id: Uuid,
    pub document_version: i32,
    pub input_revision: i32,
    pub job_revision: Option<i32>,
    pub extraction_status: String,
    pub evaluation_status: String,
    #[serde(default)]
    pub profile: Value,
    #[serde(default)]
    pub contact: Value,
    #[serde(default)]
    pub sanitized_text: String,
    #[serde(default)]
    pub scorecard: Option<Value>,
    #[serde(default)]
    pub embedding: Option<Vec<f64>>,
    #[serde(default)]
    pub embedding_model: Option<String>,
    #[serde(default)]
    pub preprocessing_version: Option<String>,
    #[serde(default)]
    pub warnings: Vec<String>,
    pub error_code: Option<String>,
}
impl AIResult {
    pub fn validate(&self) -> Result<()> {
        if self.contract_version != 1
            || self.sanitized_text.len() > 500000
            || self.profile.to_string().len() > 500000
            || self.contact.to_string().len() > 10000
            || self.warnings.len() > 100
        {
            return Err(bad("Invalid AI result contract."));
        }
        if !["COMPLETED", "FAILED", "SKIPPED"].contains(&self.extraction_status.as_str())
            || !["COMPLETED", "FAILED", "SKIPPED", "PENDING"]
                .contains(&self.evaluation_status.as_str())
        {
            return Err(bad("Invalid processing status."));
        }
        if let Some(code) = &self.error_code
            && (code.len() > 100
                || !code
                    .chars()
                    .all(|c| c.is_ascii_uppercase() || c == '_' || c.is_ascii_digit()))
        {
            return Err(bad("Use a safe error code."));
        }
        if let Some(v) = &self.embedding
            && (v.len() != 768
                || v.iter().any(|v| !v.is_finite())
                || v.iter().all(|v| *v == 0.0)
                || self.embedding_model.as_deref() != Some("google/embeddinggemma-2")
                || self.preprocessing_version.as_deref() != Some("candidate-summary-v1"))
        {
            return Err(bad("Incompatible embedding contract."));
        }
        if self.evaluation_status == "COMPLETED" {
            let s = self
                .scorecard
                .as_ref()
                .ok_or_else(|| bad("Completed evaluations require a scorecard."))?;
            if !s
                .get("overall_match_score")
                .and_then(Value::as_f64)
                .is_some_and(|v| v.is_finite() && (0.0..=100.0).contains(&v))
                || !s
                    .get("categories")
                    .and_then(Value::as_array)
                    .is_some_and(|v| !v.is_empty())
                || crate::text(s, "model_version").is_empty()
            {
                return Err(bad("Invalid scorecard."));
            }
            for category in s["categories"].as_array().unwrap() {
                if crate::text(category, "name").trim().is_empty()
                    || !category
                        .get("score")
                        .and_then(Value::as_f64)
                        .is_some_and(|v| v.is_finite() && (1.0..=5.0).contains(&v))
                    || category.get("max_score").and_then(Value::as_f64) != Some(5.0)
                    || crate::text(category, "assessment").trim().is_empty()
                {
                    return Err(bad("Evaluation rubric requires scored assessments."));
                }
            }
        }
        Ok(())
    }
}
pub async fn result(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(raw): Json<Value>,
) -> Result<Json<Value>> {
    let fingerprint = hash(raw.to_string().as_bytes());
    let input: AIResult =
        serde_json::from_value(raw).map_err(|_| bad("Invalid AI result contract."))?;
    input.validate()?;
    let mut tx = state.db.begin().await?;
    let row = sqlx::query("SELECT * FROM ats_v2.processing_jobs WHERE id=$1 FOR UPDATE")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or_else(missing)?;
    let terminal: String = row.get("state");
    if terminal == "SUCCEEDED" || terminal == "FAILED" {
        if row.get::<Option<String>, _>("result_hash").as_deref() == Some(&fingerprint) {
            return Ok(Json(json!({"status":"acknowledged","duplicate":true})));
        }
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Conflicting result for a terminal job.",
        ));
    }
    if terminal != "RUNNING"
        || row.get::<Option<Uuid>, _>("attempt_id") != Some(input.attempt_id)
        || !row
            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("lease_until")
            .is_some_and(|v| v > chrono::Utc::now())
    {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "Result has no active lease.",
        ));
    }
    if input.document_id != row.get::<Uuid, _>("document_id")
        || input.document_version != row.get::<i32, _>("document_version")
        || input.input_revision != row.get::<i32, _>("input_revision")
        || input.job_revision != row.get::<Option<i32>, _>("job_revision")
    {
        return Err(bad("Result input versions do not match the job."));
    }
    let tenant: Uuid = row.get("tenant_id");
    let candidate: Uuid = row.get("candidate_id");
    let application: Option<Uuid> = row.get("application_id");
    let operation: String = row.get("operation");
    sqlx::query("SELECT set_config('ats.tenant_id',$1,true)")
        .bind(tenant.to_string())
        .execute(&mut *tx)
        .await?;
    let current = sqlx::query(
        "SELECT revision,deleted_at FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 FOR UPDATE",
    )
    .bind(candidate)
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await?;
    let latest: i32 = sqlx::query_scalar(
        "SELECT max(version) FROM ats_v2.documents WHERE candidate_id=$1 AND tenant_id=$2",
    )
    .bind(candidate)
    .bind(tenant)
    .fetch_one(&mut *tx)
    .await?;
    let mut stale = current.get::<i32, _>("revision") != input.input_revision
        || current
            .get::<Option<chrono::DateTime<chrono::Utc>>, _>("deleted_at")
            .is_some()
        || latest != input.document_version;
    if let Some(app) = application {
        let job=sqlx::query("SELECT j.revision,a.stage FROM ats_v2.jobs j JOIN ats_v2.applications a ON a.job_id=j.id AND a.tenant_id=j.tenant_id WHERE a.id=$1 AND a.tenant_id=$2 FOR UPDATE OF j,a").bind(app).bind(tenant).fetch_one(&mut *tx).await?;
        stale |= Some(job.get::<i32, _>("revision")) != input.job_revision
            || ["Withdrawn", "Rejected"].contains(&job.get::<String, _>("stage").as_str());
    }
    if stale {
        sqlx::query("UPDATE ats_v2.processing_jobs SET state='STALE',error_code='STALE_INPUT',updated_at=now(),lease_until=NULL WHERE id=$1").bind(id).execute(&mut *tx).await?;
        tx.commit().await?;
        return Ok(Json(json!({"status":"stale"})));
    }
    let failed = input.extraction_status == "FAILED"
        || (operation == "evaluate" && input.evaluation_status != "COMPLETED");
    if operation == "ingest" && !failed {
        let mut profile = json!({});
        for k in [
            "target_headline",
            "role",
            "highest_education",
            "years_of_experience",
            "core_skills",
            "experience",
            "enriched_skills",
            "skill_anchors",
            "taxonomy_version",
        ] {
            if let Some(v) = input.profile.get(k) {
                profile[k] = v.clone();
            }
        }
        let mut contact = json!({});
        for k in ["name", "email", "phone", "linkedin", "location"] {
            if let Some(v) = input.contact.get(k) {
                contact[k] = v.clone();
            }
        }
        sqlx::query("UPDATE ats_v2.candidates SET profile=$3,contact=$4,sanitized_text=$5,processing_status='COMPLETED',updated_at=now() WHERE id=$1 AND tenant_id=$2").bind(candidate).bind(tenant).bind(profile).bind(contact).bind(&input.sanitized_text).execute(&mut *tx).await?;
        if let Some(app) = application {
            sqlx::query("UPDATE ats_v2.applications SET stage='Recruiter Review' WHERE id=$1 AND tenant_id=$2 AND stage='Screening'").bind(app).bind(tenant).execute(&mut *tx).await?;
        }
    } else if failed && operation == "ingest" {
        sqlx::query(
            "UPDATE ats_v2.candidates SET processing_status='FAILED' WHERE id=$1 AND tenant_id=$2",
        )
        .bind(candidate)
        .bind(tenant)
        .execute(&mut *tx)
        .await?;
    }
    if let Some(v) = input.embedding {
        let encoded = format!(
            "[{}]",
            v.iter()
                .map(|v| v.to_string())
                .collect::<Vec<_>>()
                .join(",")
        );
        sqlx::query("INSERT INTO ats_v2.embeddings(tenant_id,document_id,model,preprocessing_version,embedding) VALUES($1,$2,$3,$4,$5::vector) ON CONFLICT DO NOTHING").bind(tenant).bind(input.document_id).bind(input.embedding_model).bind(input.preprocessing_version).bind(encoded).execute(&mut *tx).await?;
    }
    let mut score = None;
    if let (Some(app), Some(card)) = (application, input.scorecard.as_ref())
        && input.evaluation_status == "COMPLETED"
    {
        score = card.get("overall_match_score").and_then(Value::as_f64);
        sqlx::query("INSERT INTO ats_v2.evaluations(id,tenant_id,application_id,processing_job_id,document_id,job_revision,rubric_version,model_version,scorecard) VALUES($1,$2,$3,$4,$5,$6,'technical-v1',$7,$8)").bind(Uuid::new_v4()).bind(tenant).bind(app).bind(id).bind(input.document_id).bind(input.job_revision.unwrap_or(1)).bind(crate::text(card,"model_version")).bind(card).execute(&mut *tx).await?;
        sqlx::query("UPDATE ats_v2.applications SET current_score=$3 WHERE id=$1 AND tenant_id=$2")
            .bind(app)
            .bind(tenant)
            .bind(score)
            .execute(&mut *tx)
            .await?;
    }
    let summary = json!({"status":if failed{"FAILED"}else{"COMPLETED"},"candidate_id":candidate,"evaluation_status":input.evaluation_status,"match_score":score,"warnings":input.warnings});
    sqlx::query("UPDATE ats_v2.processing_jobs SET state=$2,result_hash=$3,result=$4,error_code=$5,progress=100,step='Completed',lease_until=NULL,updated_at=now() WHERE id=$1").bind(id).bind(if failed{"FAILED"}else{"SUCCEEDED"}).bind(fingerprint).bind(summary).bind(input.error_code).execute(&mut *tx).await?;
    sqlx::query("INSERT INTO ats_v2.audit_events(id,tenant_id,actor_role,action,resource_type,resource_id) VALUES($1,$2,'service','APPLY_AI_RESULT','processing_job',$3)").bind(Uuid::new_v4()).bind(tenant).bind(id.to_string()).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"status":"acknowledged","duplicate":false})))
}

pub async fn artifact(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(raw): Json<Value>,
) -> Result<Json<Value>> {
    let input: AIResult =
        serde_json::from_value(raw.clone()).map_err(|_| bad("Invalid AI result contract."))?;
    input.validate()?;
    let row=sqlx::query("SELECT tenant_id FROM ats_v2.processing_jobs WHERE id=$1 AND attempt_id=$2 AND state='RUNNING' AND lease_until>now() AND document_id=$3 AND input_revision=$4 AND document_version=$5")
        .bind(id).bind(input.attempt_id).bind(input.document_id).bind(input.input_revision).bind(input.document_version).fetch_optional(&state.db).await?.ok_or_else(missing)?;
    let key = format!(
        "{}/results/{id}/{}.json",
        row.get::<Uuid, _>("tenant_id"),
        input.attempt_id
    );
    state
        .objects
        .put(
            &ObjectPath::from(key),
            bytes::Bytes::from(raw.to_string()).into(),
        )
        .await
        .map_err(|_| {
            ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Result storage is unavailable.",
            )
        })?;
    Ok(Json(json!({"status":"stored"})))
}

#[derive(Deserialize)]
pub struct CitationInput {
    pub search_phrase: String,
}
pub async fn citation(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Path(candidate): Path<Uuid>,
    Json(input): Json<CitationInput>,
) -> Result<Json<Value>> {
    user.pii()?;
    if input.search_phrase.trim().is_empty() || input.search_phrase.len() > 2000 {
        return Err(bad("Invalid citation phrase."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let row=sqlx::query("SELECT d.id FROM ats_v2.documents d JOIN ats_v2.candidates c ON c.id=d.candidate_id AND c.tenant_id=d.tenant_id WHERE d.candidate_id=$1 AND d.tenant_id=$2 AND c.deleted_at IS NULL ORDER BY version DESC LIMIT 1").bind(candidate).bind(user.tenant_id).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    // Service receives a scoped document identity; it cannot request arbitrary URLs/files.
    let response = state
        .http
        .post(format!("{}/internal/locate-citation", state.config.ai_url))
        .header("x-service-key", &state.config.service_key)
        .json(&json!({"document_id":row.get::<Uuid,_>("id"),"search_phrase":input.search_phrase}))
        .send()
        .await
        .map_err(|_| {
            ApiError(
                StatusCode::SERVICE_UNAVAILABLE,
                "Citation service is unavailable.",
            )
        })?;
    if !response.status().is_success() {
        return Err(ApiError(
            StatusCode::SERVICE_UNAVAILABLE,
            "Citation service is unavailable.",
        ));
    }
    let value: Value = response
        .json()
        .await
        .map_err(|_| bad("Invalid citation response."))?;
    audit(&mut tx, &user, "LOCATE_CITATION", "candidate", candidate).await?;
    tx.commit().await?;
    Ok(Json(value))
}
pub async fn internal_document(
    State(state): State<AppState>,
    Path(document): Path<Uuid>,
) -> Result<Response> {
    // Control-plane job establishes document ownership before the tenant-scoped read.
    let tenant:Uuid=sqlx::query_scalar("SELECT tenant_id FROM ats_v2.processing_jobs WHERE document_id=$1 ORDER BY created_at DESC LIMIT 1").bind(document).fetch_optional(&state.db).await?.ok_or_else(missing)?;
    let mut tx = tenant_tx(&state.db, tenant).await?;
    let key:String=sqlx::query_scalar("SELECT d.object_key FROM ats_v2.documents d JOIN ats_v2.candidates c ON c.id=d.candidate_id AND c.tenant_id=d.tenant_id WHERE d.id=$1 AND d.tenant_id=$2 AND c.deleted_at IS NULL").bind(document).bind(tenant).fetch_optional(&mut *tx).await?.ok_or_else(missing)?;
    Ok((
        [(header::CONTENT_TYPE, "application/pdf")],
        read_object(&state, &key).await?,
    )
        .into_response())
}

pub async fn dispatch_loop(state: AppState, mut stop: tokio::sync::watch::Receiver<bool>) {
    let mut tick = tokio::time::interval(std::time::Duration::from_secs(2));
    loop {
        tokio::select! {_=stop.changed()=>break,_=tick.tick()=>{if let Err(e)=dispatch_once(&state).await{tracing::warn!(status=%e.0,"job dispatcher will retry");}}}
    }
}
pub async fn dispatch_once(state: &AppState) -> Result<()> {
    recover_artifacts(state).await?;
    // Recover broker loss, dispatch acknowledgement loss and expired worker leases from the DB.
    sqlx::query("UPDATE ats_v2.processing_jobs SET state='FAILED',error_code='RETRY_LIMIT',lease_until=NULL,updated_at=now() WHERE state IN('RUNNING','QUEUED') AND attempts >= $1 AND (lease_until IS NULL OR lease_until<now())").bind(state.config.max_attempts).execute(&state.db).await?;
    sqlx::query("UPDATE ats_v2.processing_jobs SET state='QUEUED',lease_until=NULL,updated_at=now() WHERE state='RUNNING' AND lease_until<now() AND attempts<$1").bind(state.config.max_attempts).execute(&state.db).await?;
    sqlx::query("UPDATE ats_v2.outbox o SET delivered_at=NULL,available_at=now() WHERE delivered_at<now()-interval '60 seconds' AND EXISTS(SELECT 1 FROM ats_v2.processing_jobs p WHERE p.id=o.job_id AND p.state='QUEUED')").execute(&state.db).await?;
    let rows=sqlx::query("WITH due AS(SELECT o.job_id FROM ats_v2.outbox o JOIN ats_v2.processing_jobs p ON p.id=o.job_id WHERE o.delivered_at IS NULL AND o.available_at<=now() AND (o.locked_until IS NULL OR o.locked_until<now()) AND p.state='QUEUED' ORDER BY o.available_at LIMIT 10 FOR UPDATE OF o SKIP LOCKED) UPDATE ats_v2.outbox o SET locked_until=now()+interval '35 seconds',attempts=attempts+1 FROM due WHERE o.job_id=due.job_id RETURNING o.job_id,o.attempts").fetch_all(&state.db).await?;
    for row in rows {
        let id: Uuid = row.get("job_id");
        let response = state
            .http
            .post(format!("{}/internal/dispatch", state.config.ai_url))
            .header("x-service-key", &state.config.service_key)
            .json(&json!({"contract_version":1,"job_id":id}))
            .send()
            .await;
        if response.is_ok_and(|r| r.status().is_success()) {
            sqlx::query(
                "UPDATE ats_v2.outbox SET delivered_at=now(),locked_until=NULL WHERE job_id=$1",
            )
            .bind(id)
            .execute(&state.db)
            .await?;
        } else {
            let delay = 2_i32.pow(row.get::<i32, _>("attempts").clamp(0, 8) as u32);
            sqlx::query("UPDATE ats_v2.outbox SET locked_until=NULL,available_at=now()+make_interval(secs=>$2) WHERE job_id=$1").bind(id).bind(delay as f64).execute(&state.db).await?;
        }
    }
    Ok(())
}

/// Recover a completed model result after its callback was lost. The attempt CAS
/// prevents recovery from overwriting a lease already granted to another worker.
async fn recover_artifacts(state: &AppState) -> Result<()> {
    let rows=sqlx::query("SELECT id,tenant_id,attempt_id FROM ats_v2.processing_jobs WHERE state='RUNNING' AND lease_until<now() AND attempt_id IS NOT NULL ORDER BY lease_until LIMIT 10").fetch_all(&state.db).await?;
    for row in rows {
        let id: Uuid = row.get("id");
        let attempt: Uuid = row.get("attempt_id");
        let key = format!(
            "{}/results/{id}/{attempt}.json",
            row.get::<Uuid, _>("tenant_id")
        );
        let Ok(object) = state.objects.get(&ObjectPath::from(key)).await else {
            continue;
        };
        let Ok(bytes) = object.bytes().await else {
            continue;
        };
        let Ok(raw) = serde_json::from_slice::<Value>(&bytes) else {
            continue;
        };
        let Ok(input) = serde_json::from_value::<AIResult>(raw.clone()) else {
            continue;
        };
        if input.attempt_id != attempt || input.validate().is_err() {
            continue;
        }
        let updated=sqlx::query("UPDATE ats_v2.processing_jobs SET lease_until=now()+interval '30 seconds' WHERE id=$1 AND attempt_id=$2 AND state='RUNNING' AND lease_until<now()").bind(id).bind(attempt).execute(&state.db).await?;
        if updated.rows_affected() == 1
            && let Err(error) = result(State(state.clone()), Path(id), Json(raw)).await
        {
            tracing::warn!(job_id=%id,status=%error.0,"saved result recovery will retry");
        }
    }
    Ok(())
}

#[derive(Deserialize, utoipa::ToSchema)]
pub struct MatchInput {
    pub job_id: Uuid,
    #[serde(default = "limit")]
    pub stage2_rerank_limit: i64,
    #[serde(default = "retrieve_limit")]
    pub stage1_retrieve_limit: i64,
}
fn limit() -> i64 {
    20
}
fn retrieve_limit() -> i64 {
    100
}
pub async fn evaluate_job(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(input): Json<MatchInput>,
) -> Result<(StatusCode, Json<Value>)> {
    user.write()?;
    if !(1..=50).contains(&input.stage2_rerank_limit)
        || !(1..=100).contains(&input.stage1_retrieve_limit)
        || input.stage2_rerank_limit > input.stage1_retrieve_limit
    {
        return Err(bad("Invalid retrieval/evaluation limits."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let job =
        sqlx::query("SELECT * FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2 AND status='OPEN'")
            .bind(input.job_id)
            .bind(user.tenant_id)
            .fetch_optional(&mut *tx)
            .await?
            .ok_or_else(missing)?;
    let query = format!(
        "{} {}",
        job.get::<String, _>("title"),
        job.get::<String, _>("job_description")
    );
    // SQL lexical shortlist is always scoped before documents are sent to Python.
    let rows=sqlx::query("SELECT c.id,c.revision,c.sanitized_text,d.id document_id,d.version FROM ats_v2.candidates c JOIN LATERAL(SELECT id,version FROM ats_v2.documents WHERE candidate_id=c.id AND tenant_id=c.tenant_id ORDER BY version DESC LIMIT 1)d ON true WHERE c.tenant_id=$1 AND c.deleted_at IS NULL AND c.processing_status='COMPLETED' ORDER BY ts_rank_cd(to_tsvector('english',c.sanitized_text),plainto_tsquery('english',$2)) DESC,c.created_at DESC LIMIT $3").bind(user.tenant_id).bind(&query).bind(input.stage1_retrieve_limit).fetch_all(&mut *tx).await?;
    tx.commit().await?;
    let mut rankings = std::collections::HashMap::<Uuid, f64>::new();
    for (i, r) in rows.iter().enumerate() {
        rankings.insert(r.get("id"), 1.0 / (60.0 + i as f64 + 1.0));
    }
    let mut semantic_fallback = true;
    if let Ok(response) = state
        .http
        .post(format!("{}/internal/embed", state.config.ai_url))
        .header("x-service-key", &state.config.service_key)
        .json(&json!({"text":query}))
        .send()
        .await
        && response.status().is_success()
        && let Ok(value) = response.json::<Value>().await
        && value["model"] == "google/embeddinggemma-2"
        && let Some(vector) = value["embedding"].as_array().filter(|v| {
            v.len() == 768
                && v.iter().all(|n| n.as_f64().is_some_and(f64::is_finite))
                && v.iter().any(|n| n.as_f64().is_some_and(|x| x != 0.0))
        })
    {
        let encoded = format!(
            "[{}]",
            vector
                .iter()
                .map(Value::to_string)
                .collect::<Vec<_>>()
                .join(",")
        );
        let mut dense_tx = tenant_tx(&state.db, user.tenant_id).await?;
        let dense=sqlx::query("SELECT c.id,c.revision,c.sanitized_text,d.id document_id,d.version FROM ats_v2.embeddings e JOIN ats_v2.documents d ON d.id=e.document_id AND d.tenant_id=e.tenant_id JOIN ats_v2.candidates c ON c.id=d.candidate_id AND c.tenant_id=d.tenant_id WHERE e.tenant_id=$1 AND c.deleted_at IS NULL AND c.processing_status='COMPLETED' AND e.model='google/embeddinggemma-2' AND e.preprocessing_version='candidate-summary-v1' AND d.version=(SELECT max(version) FROM ats_v2.documents WHERE tenant_id=$1 AND candidate_id=c.id) ORDER BY e.embedding <=> $2::vector LIMIT $3").bind(user.tenant_id).bind(encoded).bind(input.stage1_retrieve_limit).fetch_all(&mut *dense_tx).await?;
        dense_tx.commit().await?;
        semantic_fallback = false;
        for (i, r) in dense.iter().enumerate() {
            *rankings.entry(r.get("id")).or_default() += 1.0 / (60.0 + i as f64 + 1.0);
        }
        // Include dense-only candidates while keeping one row per identity.
        let mut merged = rows;
        let mut seen = merged
            .iter()
            .map(|r| r.get::<Uuid, _>("id"))
            .collect::<std::collections::HashSet<_>>();
        for r in dense {
            if seen.insert(r.get("id")) {
                merged.push(r);
            }
        }
        return enqueue_ranked(
            &state,
            &user,
            &input,
            &job,
            merged,
            rankings,
            semantic_fallback,
            &query,
        )
        .await;
    }
    enqueue_ranked(
        &state,
        &user,
        &input,
        &job,
        rows,
        rankings,
        semantic_fallback,
        &query,
    )
    .await
}
#[allow(clippy::too_many_arguments)]
async fn enqueue_ranked(
    state: &AppState,
    user: &Identity,
    input: &MatchInput,
    job: &sqlx::postgres::PgRow,
    mut rows: Vec<sqlx::postgres::PgRow>,
    rankings: std::collections::HashMap<Uuid, f64>,
    semantic_fallback: bool,
    query: &str,
) -> Result<(StatusCode, Json<Value>)> {
    rows.sort_by(|a, b| {
        rankings[&b.get::<Uuid, _>("id")].total_cmp(&rankings[&a.get::<Uuid, _>("id")])
    });
    rows.truncate(input.stage1_retrieve_limit as usize);
    let retrieved = rows.len();
    let mut reranker_fallback = true;
    if !rows.is_empty() {
        let permitted=rows.iter().map(|r|json!({"candidate_id":r.get::<Uuid,_>("id"),"text":r.get::<String,_>("sanitized_text")})).collect::<Vec<_>>();
        if let Ok(response) = state
            .http
            .post(format!("{}/internal/rerank", state.config.ai_url))
            .header("x-service-key", &state.config.service_key)
            .json(&json!({"query":query,"candidates":permitted,"top_k":input.stage2_rerank_limit}))
            .send()
            .await
            && response.status().is_success()
            && let Ok(value) = response.json::<Value>().await
            && let Some(items) = value["candidates"].as_array()
        {
            let ids = items
                .iter()
                .filter_map(|v| {
                    v["candidate_id"]
                        .as_str()
                        .and_then(|s| Uuid::parse_str(s).ok())
                })
                .collect::<Vec<_>>();
            let authorized = rows
                .iter()
                .map(|r| r.get::<Uuid, _>("id"))
                .collect::<std::collections::HashSet<_>>();
            if !ids.is_empty()
                && ids.len() <= input.stage2_rerank_limit as usize
                && ids.iter().all(|id| authorized.contains(id))
                && ids.iter().collect::<std::collections::HashSet<_>>().len() == ids.len()
            {
                rows.retain(|r| ids.contains(&r.get::<Uuid, _>("id")));
                rows.sort_by_key(|r| {
                    ids.iter()
                        .position(|id| *id == r.get::<Uuid, _>("id"))
                        .unwrap()
                });
                reranker_fallback = false;
            }
        }
    }
    rows.truncate(input.stage2_rerank_limit as usize);
    // Inference never holds a database connection or business lock. Revalidate
    // inputs and serialize scheduling only after the remote ranking completes.
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    let revision:Option<i32>=sqlx::query_scalar("SELECT revision FROM ats_v2.jobs WHERE id=$1 AND tenant_id=$2 AND status='OPEN' FOR UPDATE").bind(input.job_id).bind(user.tenant_id).fetch_optional(&mut *tx).await?;
    if revision != Some(job.get::<i32, _>("revision")) {
        return Err(ApiError(
            StatusCode::CONFLICT,
            "The job changed while matching. Run matching again.",
        ));
    }
    let mut ids = vec![];
    for r in rows {
        let candidate: Uuid = r.get("id");
        let current:Option<i32>=sqlx::query_scalar("SELECT revision FROM ats_v2.candidates WHERE id=$1 AND tenant_id=$2 AND deleted_at IS NULL AND processing_status='COMPLETED'").bind(candidate).bind(user.tenant_id).fetch_optional(&mut *tx).await?;
        if current != Some(r.get::<i32, _>("revision")) {
            continue;
        }
        let app:Uuid=sqlx::query_scalar("INSERT INTO ats_v2.applications(id,tenant_id,candidate_id,job_id) VALUES($1,$2,$3,$4) ON CONFLICT(tenant_id,candidate_id,job_id) DO UPDATE SET candidate_id=EXCLUDED.candidate_id RETURNING id").bind(Uuid::new_v4()).bind(user.tenant_id).bind(candidate).bind(input.job_id).fetch_one(&mut *tx).await?;
        let stage: String = sqlx::query_scalar(
            "SELECT stage FROM ats_v2.applications WHERE id=$1 AND tenant_id=$2",
        )
        .bind(app)
        .bind(user.tenant_id)
        .fetch_one(&mut *tx)
        .await?;
        if ["Withdrawn", "Rejected"].contains(&stage.as_str()) {
            continue;
        }
        let active:Option<Uuid>=sqlx::query_scalar("SELECT id FROM ats_v2.processing_jobs WHERE tenant_id=$1 AND application_id=$2 AND operation='evaluate' AND state IN('QUEUED','RUNNING') AND input_revision=$3 AND job_revision=$4").bind(user.tenant_id).bind(app).bind(r.get::<i32,_>("revision")).bind(job.get::<i32,_>("revision")).fetch_optional(&mut *tx).await?;
        if let Some(id) = active {
            ids.push(id);
            continue;
        }
        let id = Uuid::new_v4();
        sqlx::query("INSERT INTO ats_v2.processing_jobs(id,tenant_id,candidate_id,document_id,application_id,operation,input_revision,job_revision,document_version) VALUES($1,$2,$3,$4,$5,'evaluate',$6,$7,$8)").bind(id).bind(user.tenant_id).bind(candidate).bind(r.get::<Uuid,_>("document_id")).bind(app).bind(r.get::<i32,_>("revision")).bind(job.get::<i32,_>("revision")).bind(r.get::<i32,_>("version")).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO ats_v2.outbox(job_id) VALUES($1)")
            .bind(id)
            .execute(&mut *tx)
            .await?;
        ids.push(id);
    }
    audit(&mut tx, user, "QUEUE_JOB_MATCH", "job", input.job_id).await?;
    tx.commit().await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(
            json!({"status":"QUEUED","job_id":input.job_id,"job_title":job.get::<String,_>("title"),"task_ids":ids,"stage1_candidates_retrieved":retrieved,"stage2_candidates_reranked":ids.len(),"stage3_final_ranked":0,"latency_ms":0,"candidates":[],"semantic_fallback":semantic_fallback,"reranker_fallback":reranker_fallback}),
        ),
    ))
}
