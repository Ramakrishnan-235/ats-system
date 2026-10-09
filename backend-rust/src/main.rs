use ats_backend::{AppState, api, config, jobs};
use sqlx::postgres::PgPoolOptions;
use std::sync::Arc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();
    let cfg = config::Config::load()?;
    anyhow::ensure!(
        cfg.max_upload > 0 && cfg.max_attempts > 0 && cfg.lease_seconds >= 30,
        "Invalid resource limits"
    );
    let migrations = PgPoolOptions::new()
        .max_connections(1)
        .connect(&cfg.migration_url)
        .await?;
    sqlx::migrate!().run(&migrations).await?;
    migrations.close().await;
    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&cfg.database_url)
        .await?;
    let listener = tokio::net::TcpListener::bind(&cfg.bind).await?;
    if cfg.development_mode {
        ats_backend::auth::initialize_development(&db)
            .await
            .map_err(|error| anyhow::anyhow!(error.1))?;
        tracing::warn!("Local development mode enabled: sign-in is bypassed for test workspaces");
    }
    let state = AppState {
        db,
        objects: config::object_store()?,
        http: config::http_client()?,
        config: Arc::new(cfg),
    };
    let (stop_tx, stop_rx) = tokio::sync::watch::channel(false);
    let dispatcher = tokio::spawn(jobs::dispatch_loop(state.clone(), stop_rx));
    tracing::info!(address=%state.config.bind,"ATS Rust core ready");
    axum::serve(listener, api::router(state.clone()))
        .with_graceful_shutdown(async {
            shutdown_signal().await;
        })
        .await?;
    let _ = stop_tx.send(true);
    let _ = dispatcher.await;
    state.db.close().await;
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("install termination handler");
        tokio::select! { _ = tokio::signal::ctrl_c() => {}, _ = terminate.recv() => {} }
    }
    #[cfg(not(unix))]
    let _ = tokio::signal::ctrl_c().await;
}
