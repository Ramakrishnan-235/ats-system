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
