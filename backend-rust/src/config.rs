use object_store::{aws::AmazonS3Builder, local::LocalFileSystem};
use std::{env, sync::Arc, time::Duration};

#[derive(Clone)]
pub struct Config {
    pub bind: String,
    pub database_url: String,
    pub migration_url: String,
    pub service_key: String,
    pub ai_url: String,
    pub origins: Vec<String>,
    pub secure_cookie: bool,
    pub allow_signup: bool,
    pub development_mode: bool,
    pub max_upload: usize,
    pub lease_seconds: i64,
    pub max_attempts: i32,
}
impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let database_url = env::var("DATABASE_URL")?;
        let service_key = env::var("ATS_SERVICE_KEY")?;
        anyhow::ensure!(
            service_key.len() >= 32,
            "ATS_SERVICE_KEY must contain at least 32 characters"
        );
        Ok(Self {
            bind: env::var("ATS_BIND").unwrap_or("127.0.0.1:8080".into()),
            migration_url: env::var("ATS_MIGRATION_DATABASE_URL")
                .unwrap_or_else(|_| database_url.clone()),
            database_url,
            service_key,
            ai_url: env::var("ATS_AI_URL").unwrap_or("http://127.0.0.1:8100".into()),
            origins: env::var("ATS_CORS_ORIGINS")
                .unwrap_or("http://localhost:3000,http://127.0.0.1:3000".into())
                .split(',')
                .map(|v| v.trim().to_owned())
                .collect(),
            secure_cookie: env::var("ATS_SECURE_COOKIE").unwrap_or("true".into()) == "true",
            allow_signup: env::var("ATS_ALLOW_SIGNUP").unwrap_or("false".into()) == "true",
            development_mode: env::var("ATS_DEVELOPMENT_MODE").unwrap_or("false".into()) == "true",
            max_upload: env::var("ATS_MAX_UPLOAD_BYTES")
                .unwrap_or("10485760".into())
                .parse()?,
            lease_seconds: env::var("ATS_JOB_LEASE_SECONDS")
                .unwrap_or("300".into())
                .parse()?,
            max_attempts: env::var("ATS_JOB_MAX_ATTEMPTS")
                .unwrap_or("5".into())
                .parse()?,
        })
    }

    pub fn is_production(&self) -> bool {
        let env_mode = env::var("ATS_ENV")
            .or_else(|_| env::var("ENVIRONMENT"))
            .or_else(|_| env::var("APP_ENV"))
            .or_else(|_| env::var("NODE_ENV"))
            .unwrap_or_default()
            .to_lowercase();
        if matches!(env_mode.as_str(), "production" | "prod") {
            return true;
        }
        !self.development_mode
            && !matches!(env_mode.as_str(), "development" | "dev" | "test" | "local")
    }

    pub fn validate_production_settings(&self) -> anyhow::Result<()> {
        self.validate_security_in_mode(self.is_production())
    }

    pub fn validate_security_in_mode(&self, is_prod: bool) -> anyhow::Result<()> {
        if is_prod {
            if self.development_mode {
                anyhow::bail!(
                    "Production startup check failed: development login bypass (ATS_DEVELOPMENT_MODE=true) \
                     is strictly prohibited in production mode."
                );
            }
            if !self.secure_cookie {
                anyhow::bail!(
                    "Production startup check failed: ATS_SECURE_COOKIE must be enabled (true) in production mode \
                     to ensure session tokens are only transmitted over TLS."
                );
            }
            let key_lower = self.service_key.to_lowercase();
            let distinct_chars = key_lower
                .chars()
                .collect::<std::collections::HashSet<_>>()
                .len();
            if key_lower.contains("test")
                || key_lower.contains("example")
                || key_lower.contains("change-me")
                || key_lower.contains("placeholder")
                || distinct_chars < 8
            {
                anyhow::bail!(
                    "Production startup check failed: ATS_SERVICE_KEY uses a known test or weak placeholder value. \
                     A high-entropy secret of at least 32 characters is required in production."
                );
            }
            if self.origins.iter().any(|o| o == "*") {
                anyhow::bail!(
                    "Production startup check failed: Wildcard CORS origin ('*') is prohibited in production mode."
                );
            }
            if self
                .origins
                .iter()
                .any(|o| o.starts_with("http://localhost") || o.starts_with("http://127.0.0.1"))
            {
                anyhow::bail!(
                    "Production startup check failed: Localhost CORS origins are prohibited in production mode."
                );
            }
            if env::var("ATS_S3_ALLOW_HTTP").unwrap_or_default() == "true" {
                anyhow::bail!(
                    "Production startup check failed: Plaintext HTTP for S3 storage (ATS_S3_ALLOW_HTTP=true) \
                     is prohibited in production mode. Object storage must use HTTPS."
                );
            }
        }
        Ok(())
    }
}

pub async fn validate_database_role(db: &sqlx::PgPool, is_production: bool) -> anyhow::Result<()> {
    let row = sqlx::query(
        "SELECT current_user as role_name, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
    )
    .fetch_optional(db)
    .await?;

    if let Some(r) = row {
        let role_name: String = sqlx::Row::get(&r, "role_name");
        let rolsuper: bool = sqlx::Row::get(&r, "rolsuper");
        let rolbypassrls: bool = sqlx::Row::get(&r, "rolbypassrls");

        check_database_role_safety(&role_name, rolsuper, rolbypassrls, is_production)?;
    }
    Ok(())
}

pub fn check_database_role_safety(
    role_name: &str,
    rolsuper: bool,
    rolbypassrls: bool,
    is_production: bool,
) -> anyhow::Result<()> {
    if rolsuper || rolbypassrls {
        let mut reasons = Vec::new();
        if rolsuper {
            reasons.push("SUPERUSER");
        }
        if rolbypassrls {
            reasons.push("BYPASSRLS");
        }
        let msg = format!(
            "Unsuitable database security configuration: application role '{}' has {} privilege. \
             PostgreSQL superusers and roles with BYPASSRLS bypass row-level security (RLS), defeating tenant isolation \
             (see https://www.postgresql.org/docs/current/ddl-rowsecurity.html). \
             The application connection MUST use a restricted runtime role (such as ats_runtime) without SUPERUSER or BYPASSRLS.",
            role_name,
            reasons.join(" and ")
        );
        if is_production {
            anyhow::bail!("Production startup check failed: {}", msg);
        } else {
            tracing::warn!("{}", msg);
        }
    }
    Ok(())
}
pub fn object_store() -> anyhow::Result<Arc<dyn object_store::ObjectStore>> {
    if env::var("ATS_STORAGE_BACKEND").unwrap_or("s3".into()) == "local" {
        let root = env::var("ATS_DOCUMENT_DIR").unwrap_or("./.local-runtime/documents".into());
        std::fs::create_dir_all(&root)?;
        return Ok(Arc::new(LocalFileSystem::new_with_prefix(root)?));
    }
    Ok(Arc::new(
        AmazonS3Builder::from_env()
            .with_bucket_name(env::var("AWS_BUCKET")?)
            .with_allow_http(env::var("ATS_S3_ALLOW_HTTP").unwrap_or("false".into()) == "true")
            .build()?,
    ))
}
pub fn http_client() -> anyhow::Result<reqwest::Client> {
    Ok(reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::none())
        .build()?)
}
