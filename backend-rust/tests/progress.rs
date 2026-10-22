use ats_backend::progress::{self, Update};
use chrono::{Duration, Utc};
use serde_json::{Value, json};
use uuid::Uuid;

fn event(stage: &str, status: &str) -> Update {
    serde_json::from_value(json!({"attempt_id":Uuid::new_v4(),"stage":stage,"status":status}))
        .unwrap()
}

#[test]
fn reported_boundaries_keep_measured_times_and_duplicate_events_do_not_restart() {
    let now = Utc::now();
    let mut stages = json!({});
    progress::apply(&mut stages, &event("llm_evaluation", "RUNNING"), now);
    progress::apply(
        &mut stages,
        &event("llm_evaluation", "RUNNING"),
        now + Duration::seconds(8),
    );
    assert_eq!(stages["llm_evaluation"]["started_at"], json!(now));
    progress::apply(
        &mut stages,
        &event("llm_evaluation", "COMPLETED"),
        now + Duration::seconds(23),
    );
    assert_eq!(
        stages["llm_evaluation"]["finished_at"],
        json!(now + Duration::seconds(23))
    );
    let saved = stages.clone();
    progress::apply(
        &mut stages,
        &event("llm_evaluation", "RUNNING"),
        now + Duration::seconds(25),
    );
    assert_eq!(stages, saved);
}

#[test]
fn skipped_and_missing_start_notifications_never_invent_durations() {
    let mut stages = json!({});
    progress::apply(
        &mut stages,
        &event("skill_normalization", "SKIPPED"),
        Utc::now(),
    );
    progress::apply(&mut stages, &event("pdf_parsing", "COMPLETED"), Utc::now());
    assert_eq!(stages["skill_normalization"]["started_at"], Value::Null);
    assert_eq!(stages["pdf_parsing"]["started_at"], Value::Null);
}

#[test]
fn saving_result_does_not_promote_unfinished_or_failed_model_operations() {
    let mut stages = json!({});
    let now = Utc::now();
    progress::apply(&mut stages, &event("profile_extraction", "FALLBACK"), now);
    progress::apply(&mut stages, &event("llm_evaluation", "RUNNING"), now);
    progress::apply(&mut stages, &event("saving_results", "RUNNING"), now);
    progress::finish(&mut stages, now + Duration::seconds(10));
    assert_eq!(stages["profile_extraction"]["status"], "FALLBACK");
    assert_eq!(stages["llm_evaluation"]["status"], "FAILED");
    assert_eq!(stages["saving_results"]["status"], "COMPLETED");
}

#[test]
fn progress_contract_rejects_arbitrary_text_and_client_supplied_times() {
    let mut input = json!({"attempt_id":Uuid::new_v4(),"stage":"pdf_parsing","status":"RUNNING"});
    assert!(serde_json::from_value::<Update>(input.clone()).is_ok());
    input["started_at"] = json!("2000-01-01T00:00:00Z");
    assert!(serde_json::from_value::<Update>(input.clone()).is_err());
    input.as_object_mut().unwrap().remove("started_at");
    input["detail"] = json!("candidate@example.test");
    assert!(serde_json::from_value::<Update>(input).is_err());
}
