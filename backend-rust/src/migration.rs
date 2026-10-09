//! Explicit tenant-owned legacy import. Old scores/vectors and raw documents
//! cannot be promoted into verified AI evidence by a migration payload.
use crate::{ApiError, AppState, Result, audit, auth::Identity, bad, hash, tenant_tx};
use axum::{Extension, Json, extract::State, http::StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};
use sqlx::{Postgres, Row, Transaction};
use uuid::Uuid;

#[derive(Deserialize, utoipa::ToSchema)]
pub struct LegacyJob {
    pub source_id: String,
    pub job: crate::domain::JobInput,
    #[serde(default = "open")]
    pub status: String,
}
fn open() -> String {
    "OPEN".into()
}
#[derive(Deserialize, utoipa::ToSchema)]
pub struct LegacyCandidate {
    pub source_id: String,
    pub profile: Value,
    pub contact: Value,
}
#[derive(Deserialize, utoipa::ToSchema)]
pub struct LegacyImport {
    pub source: String,
    #[serde(default = "dry_run")]
    pub dry_run: bool,
    #[serde(default)]
    pub jobs: Vec<LegacyJob>,
    #[serde(default)]
    pub candidates: Vec<LegacyCandidate>,
}
fn dry_run() -> bool {
    true
}

pub async fn import(
    State(state): State<AppState>,
    Extension(user): Extension<Identity>,
    Json(input): Json<LegacyImport>,
) -> Result<Json<Value>> {
    user.admin()?;
    if input.source.is_empty()
        || input.source.len() > 200
        || input.jobs.len() + input.candidates.len() > 500
    {
        return Err(bad("Invalid import size or source identifier."));
    }
    let mut tx = tenant_tx(&state.db, user.tenant_id).await?;
    // Serialize an import source, including retries and multiple application instances.
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("{}:{}", user.tenant_id, input.source))
        .execute(&mut *tx)
        .await?;
    let mut mappings = vec![];
    for item in input.jobs {
        item.job.validate()?;
        if !["OPEN", "PAUSED", "CLOSED"].contains(&item.status.as_str()) {
            return Err(bad("Invalid legacy job status."));
        }
        let fingerprint = hash(
            json!({"job":item.job,"status":item.status})
                .to_string()
                .as_bytes(),
        );
        let (id, exists) = resolve(
            &mut tx,
            &user,
            &input.source,
            "job",
            &item.source_id,
            &fingerprint,
            input.dry_run,
        )
        .await?;
        if !input.dry_run && !exists {
            let job = item.job;
            sqlx::query("INSERT INTO ats_v2.jobs(id,tenant_id,title,department,location,job_description,required_skills,min_years_experience,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)").bind(id).bind(user.tenant_id).bind(job.title).bind(job.department).bind(job.location).bind(job.job_description).bind(json!(job.required_skills)).bind(job.min_years_experience).bind(item.status).execute(&mut *tx).await?;
        }
        mappings.push(json!({"kind":"job","source_id":item.source_id,"id":if input.dry_run && !exists {Value::Null}else{json!(id)},"existing":exists}));
    }
    for item in input.candidates {
        if !item.profile.is_object()
            || !item.contact.is_object()
            || item.profile.to_string().len() > 500000
            || item.contact.to_string().len() > 10000
        {
            return Err(bad("Invalid legacy candidate."));
        }
        let fingerprint = hash(
            json!({"profile":item.profile,"contact":item.contact})
                .to_string()
                .as_bytes(),
        );
        let (id, exists) = resolve(
            &mut tx,
            &user,
            &input.source,
            "candidate",
            &item.source_id,
            &fingerprint,
            input.dry_run,
        )
        .await?;
        if !input.dry_run && !exists {
            let mut profile = json!({});
            let mut contact = json!({});
            for k in [
                "target_headline",
                "role",
                "core_skills",
                "experience",
                "highest_education",
                "years_of_experience",
            ] {
                if let Some(v) = item.profile.get(k) {
                    profile[k] = v.clone();
                }
            }
            for k in ["name", "email", "phone", "linkedin", "location"] {
                if let Some(v) = item.contact.get(k).filter(|v| v.is_string()) {
                    contact[k] = v.clone();
                }
            }
            crate::domain::redact_profile(&mut profile, &contact);
            sqlx::query("INSERT INTO ats_v2.candidates(id,tenant_id,profile,contact,processing_status) VALUES($1,$2,$3,$4,'LEGACY_REVIEW')").bind(id).bind(user.tenant_id).bind(profile).bind(contact).execute(&mut *tx).await?;
        }
        mappings.push(json!({"kind":"candidate","source_id":item.source_id,"id":if input.dry_run && !exists {Value::Null}else{json!(id)},"existing":exists}));
    }
    if !input.dry_run {
        audit(&mut tx, &user, "IMPORT_LEGACY", "migration", &input.source).await?;
        tx.commit().await?;
    }
    Ok(Json(
        json!({"dry_run":input.dry_run,"mappings":mappings,"requires_original_resume_processing":true}),
    ))
}
async fn resolve(
    tx: &mut Transaction<'_, Postgres>,
    user: &Identity,
    source: &str,
    kind: &str,
    source_id: &str,
    fingerprint: &str,
    dry: bool,
) -> Result<(Uuid, bool)> {
    if source_id.is_empty() || source_id.len() > 200 {
        return Err(bad("Invalid legacy source ID."));
    }
    let old=sqlx::query("SELECT destination_id,fingerprint FROM ats_v2.legacy_imports WHERE tenant_id=$1 AND source=$2 AND kind=$3 AND source_id=$4").bind(user.tenant_id).bind(source).bind(kind).bind(source_id).fetch_optional(&mut **tx).await?;
    if let Some(row) = old {
        if row.get::<String, _>("fingerprint") != fingerprint {
            return Err(ApiError(
                StatusCode::CONFLICT,
                "Legacy source changed since import. Review the saved mapping before proceeding.",
            ));
        }
        return Ok((row.get("destination_id"), true));
    }
    let id = Uuid::new_v4();
    if !dry {
        sqlx::query("INSERT INTO ats_v2.legacy_imports(tenant_id,source,kind,source_id,destination_id,fingerprint) VALUES($1,$2,$3,$4,$5,$6)").bind(user.tenant_id).bind(source).bind(kind).bind(source_id).bind(id).bind(fingerprint).execute(&mut **tx).await?;
    }
    Ok((id, false))
}
