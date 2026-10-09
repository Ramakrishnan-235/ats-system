fn main() -> anyhow::Result<()> {
    let directory = std::env::args().nth(1).unwrap_or("../contracts".into());
    std::fs::create_dir_all(&directory)?;
    std::fs::write(
        std::path::Path::new(&directory).join("openapi-core.json"),
        serde_json::to_string_pretty(&ats_backend::openapi::document())?,
    )?;
    Ok(())
}
