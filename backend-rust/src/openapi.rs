//! Schemas are derived from the DTOs used by the server. Responses containing
//! dynamically extracted profiles are intentionally documented as open objects.
use serde_json::{Value, json};
use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(components(schemas(
    crate::auth::Credentials,
    crate::domain::JobInput,
    crate::domain::ProfileEdit,
    crate::jobs::AIResult,
    crate::jobs::MatchInput,
    crate::migration::LegacyImport,
    crate::migration::LegacyJob,
    crate::migration::LegacyCandidate
)))]
struct Schemas;

pub fn document() -> Value {
    let mut doc = serde_json::to_value(Schemas::openapi()).expect("schema serialization");
    doc["info"] = json!({"title":"ATS Rust core","version":"1.0.0","description":"Cookie sessions and server-verified workspace membership. Mutations using cookies require an allowed Origin. Private AI endpoints use X-Service-Key and are excluded from this public API."});
    doc["components"]["securitySchemes"] =
        json!({"session":{"type":"apiKey","in":"cookie","name":"ats_session"}});
    let routes = [
        ("/migration/import", "post", Some("LegacyImport"), 200),
        ("/auth/config", "get", None, 200),
        ("/auth/register", "post", Some("Credentials"), 200),
        ("/auth/login", "post", Some("Credentials"), 200),
        ("/auth/logout", "post", None, 200),
        ("/auth/me", "get", None, 200),
        ("/auth/workspace", "post", Some("workspace"), 200),
        ("/jobs", "get", None, 200),
        ("/jobs", "post", Some("JobInput"), 200),
        ("/jobs/{id}", "get", None, 200),
        ("/jobs/{id}", "patch", Some("JobInput"), 200),
        ("/jobs/{id}/candidates", "get", None, 200),
        ("/jobs/{id}/candidates", "post", Some("object"), 200),
        ("/jobs/{job}/candidates/{candidate}", "delete", None, 200),
        (
            "/jobs/{job}/candidates/{candidate}/stage",
            "patch",
            None,
            200,
        ),
        ("/candidates", "get", None, 200),
        ("/candidates/upload-async", "post", Some("upload"), 202),
        ("/candidates/tasks/{id}", "get", None, 200),
        ("/candidates/{id}", "get", None, 200),
        ("/candidates/{id}", "patch", Some("ProfileEdit"), 200),
        ("/candidates/{id}/scorecard", "get", None, 200),
        ("/candidates/{id}/notes", "post", Some("note"), 200),
        ("/candidates/{id}/stage", "patch", None, 200),
        ("/candidates/{id}/resume-pdf", "get", None, 200),
        (
            "/candidates/{id}/locate-citation",
            "post",
            Some("citation"),
            200,
        ),
        ("/match/evaluate-job", "post", Some("MatchInput"), 202),
        ("/dashboard/stats", "get", None, 200),
        ("/analytics", "get", None, 200),
        ("/audit/logs", "get", None, 200),
        ("/settings/members", "get", None, 200),
        ("/settings/members", "post", Some("member"), 200),
        ("/settings/workspace", "patch", Some("name"), 200),
        ("/taxonomy/version", "get", None, 200),
        ("/taxonomy/skills", "get", None, 200),
        ("/taxonomy/skills", "post", Some("object"), 200),
        (
            "/taxonomy/skills/{id}/approve",
            "patch",
            Some("object"),
            200,
        ),
        ("/taxonomy/skills/{id}/reject", "patch", None, 200),
        ("/taxonomy/skills/{id}/aliases", "post", Some("alias"), 200),
        ("/clients", "get", None, 200),
        ("/clients", "post", Some("name"), 200),
        ("/submissions", "get", None, 200),
        ("/submissions", "post", Some("submission"), 200),
    ];
    for (path, method, body, status) in routes {
        let mut operation = json!({"responses":{status.to_string():{"description":"Success","content":{"application/json":{"schema":{}}}},"400":{"description":"Invalid request"},"401":{"description":"Session required"},"403":{"description":"Permission denied"},"404":{"description":"Resource not found in this workspace"},"409":{"description":"Stale revision or conflicting request"}},"security":[{"session":[]}]});
        if ["/auth/config", "/auth/register", "/auth/login"].contains(&path) {
            operation["security"] = json!([]);
        }
        let mut params = vec![];
        for token in path.split('/') {
            if token.starts_with('{') {
                params.push(json!({"name":token.trim_matches(['{','}']),"in":"path","required":true,"schema":{"type":"string","format":"uuid"}}));
            }
        }
        if path.ends_with("/stage") {
            params.push(json!({"name":"new_stage","in":"query","required":true,"schema":{"type":"string","enum":crate::domain::STAGES}}));
        }
        if path == "/candidates" || path == "/candidates/{id}" {
            params.push(json!({"name":"include_pii","in":"query","schema":{"type":"boolean","default":false}}));
        }
        if path.ends_with("/scorecard") || path == "/candidates/{id}/stage" {
            params.push(
                json!({"name":"job_id","in":"query","schema":{"type":"string","format":"uuid"}}),
            );
        }
        if !params.is_empty() {
            operation["parameters"] = json!(params);
        }
        if let Some(body) = body {
            let (media, schema) = match body {
                "upload" => (
                    "multipart/form-data",
                    json!({"type":"object","required":["file"],"properties":{"file":{"type":"string","format":"binary"},"job_id":{"type":"string","format":"uuid"},"candidate_id":{"type":"string","format":"uuid"}}}),
                ),
                "name" => ("application/json", fields(&["name"])),
                "member" => ("application/json", fields(&["email", "role"])),
                "workspace" => ("application/json", fields(&["tenant_id"])),
                "note" => ("application/json", fields(&["content"])),
                "alias" => ("application/json", fields(&["alias"])),
                "citation" => ("application/json", fields(&["search_phrase"])),
                "submission" => ("application/json", fields(&["client_id", "application_id"])),
                "object" => ("application/json", json!({"type":"object"})),
                other => (
                    "application/json",
                    json!({"$ref":format!("#/components/schemas/{other}")}),
                ),
            };
            operation["requestBody"] = json!({"required":true,"content":{media:{"schema":schema}}});
        }
        if path.ends_with("/resume-pdf") {
            operation["responses"]["200"] = json!({"description":"Authorized private original","content":{"application/pdf":{"schema":{"type":"string","format":"binary"}}}});
        }
        doc["paths"][format!("/api/v1{path}")][method] = operation;
    }
    doc
}
fn fields(names: &[&str]) -> Value {
    let properties: serde_json::Map<String, Value> = names
        .iter()
        .map(|name| (name.to_string(), json!({"type":"string"})))
        .collect();
    json!({"type":"object","required":names,"properties":properties})
}
