//! Lease-scoped operation telemetry. Timestamps are assigned by the core.
use crate::{ApiError, AppState, Result};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sqlx::Row;
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Stage {
    DocumentVerification,
    PdfParsing,
    PiiRedaction,
    ProfileExtraction,
    SkillNormalization,
    ProfileSanitization,
    DocumentEmbedding,
    LlmEvaluation,
    SavingResults,
}
impl Stage {
    fn label(&self) -> &'static str {
        match self {
            Self::DocumentVerification => "Reading and verifying stored PDF",
            Self::PdfParsing => "Reading PDF layout and text",
            Self::PiiRedaction => "Protecting personal information before AI extraction",
            Self::ProfileExtraction => "Extracting resume profile",
            Self::SkillNormalization => "Normalizing skills with EmbeddingGemma 2",
            Self::ProfileSanitization => "Validating and anonymizing candidate profile",
            Self::DocumentEmbedding => "Creating resume search embedding",
            Self::LlmEvaluation => "LLM evaluating job fit and verifying citations",
            Self::SavingResults => "Saving profile and evaluation results",
        }
    }
}

#[derive(Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum StageStatus {
    Running,
    Completed,
    Failed,
    Skipped,
    Fallback,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Detail {
    LocalExtraction,
    LlmDisabled,
    NoJob,
    EmbeddingsDisabled,
    ModelUnavailable,
    NoSkills,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Update {
    pub attempt_id: Uuid,
    pub stage: Stage,
    pub status: StageStatus,
    pub detail: Option<Detail>,
}

pub fn apply(stages: &mut Value, input: &Update, now: DateTime<Utc>) {
    let key = serde_json::to_value(&input.stage)
        .unwrap()
        .as_str()
        .unwrap()
        .to_owned();
    let previous = &stages[&key];
    // Duplicate notifications must not restart timers or regress a settled stage.
    if input.status == StageStatus::Running && previous["finished_at"].is_string() {
        return;
    }
    let started = previous.get("started_at").cloned().unwrap_or_else(|| {
        if input.status == StageStatus::Running {
            json!(now)
        } else {
            Value::Null
        }
    });
    let finished = if input.status == StageStatus::Running {
        Value::Null
    } else {
        previous
            .get("finished_at")
            .filter(|v| !v.is_null())
            .cloned()
            .unwrap_or(json!(now))
    };
    stages[&key] = json!({"status":input.status,"started_at":started,"finished_at":finished,"detail":input.detail});
}

pub fn finish(stages: &mut Value, now: DateTime<Utc>) {
    if let Some(items) = stages.as_object_mut() {
        for (key, value) in items {
            if value["status"] == "RUNNING" {
                // Applying the artifact completes persistence. Unfinished inference
                // is never silently promoted to successful processing.
                value["status"] = json!(if key == "saving_results" {
                    "COMPLETED"
                } else {
                    "FAILED"
                });
                value["finished_at"] = json!(now);
            }
        }
    }
}

pub async fn report(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(input): Json<Update>,
) -> Result<Json<Value>> {
    let mut tx = state.db.begin().await?;
    let row = sqlx::query("SELECT progress_stages FROM ats_v2.processing_jobs WHERE id=$1 AND attempt_id=$2 AND state='RUNNING' AND lease_until>now() FOR UPDATE")
        .bind(id).bind(input.attempt_id).fetch_optional(&mut *tx).await?
        .ok_or(ApiError(StatusCode::CONFLICT, "Processing attempt is no longer active."))?;
    let mut stages: Value = row.get("progress_stages");
    apply(&mut stages, &input, Utc::now());
    let settled = stages
        .as_object()
        .unwrap()
        .values()
        .filter(|v| v["status"] != "RUNNING")
        .count();
    sqlx::query("UPDATE ats_v2.processing_jobs SET progress_stages=$3,step=$4,progress=$5,updated_at=now() WHERE id=$1 AND attempt_id=$2")
        .bind(id).bind(input.attempt_id).bind(stages).bind(input.stage.label())
        .bind((settled * 100 / 9).min(99) as i32).execute(&mut *tx).await?;
    tx.commit().await?;
    Ok(Json(json!({"status":"recorded"})))
}
