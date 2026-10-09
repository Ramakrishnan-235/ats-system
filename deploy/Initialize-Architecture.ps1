$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $projectRoot '.env.architecture'
if (Test-Path -LiteralPath $configPath) {
    Write-Host 'Architecture configuration already exists; preserved without changes.'
    exit 0
}
function New-Secret {
    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}
$lines = @(
    "ATS_DATABASE_PASSWORD=$(New-Secret)",
    "ATS_RUNTIME_DATABASE_PASSWORD=$(New-Secret)",
    "ATS_SERVICE_KEY=$(New-Secret)",
    "ATS_STORAGE_ACCESS_KEY=ats$(New-Secret)",
    "ATS_STORAGE_SECRET_KEY=$(New-Secret)",
    'ATS_SECURE_COOKIE=false',
    'ATS_ALLOW_SIGNUP=true',
    'ATS_CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000',
    'ATS_AI_ENABLE_LLM=true',
    'ATS_AI_ENABLE_EMBEDDINGS=true',
    'OLLAMA_BASE_URL=http://host.docker.internal:11434/v1',
    'OLLAMA_MODEL=gemma4:e2b'
)
[System.IO.File]::WriteAllLines($configPath, $lines, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Created private local architecture configuration. Secrets were not printed.'
