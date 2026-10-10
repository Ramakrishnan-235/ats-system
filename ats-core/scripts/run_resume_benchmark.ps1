param(
    [ValidateSet('rules', 'configured')][string]$Mode = 'rules',
    [ValidateSet('dev', 'test', 'all')][string]$Split = 'dev',
    [ValidateRange(1, 3600)][int]$CaseTimeout = 90,
    [string]$AsOf = '2026-10-10',
    [string]$Container = 'ats-architecture-ai-1',
    [switch]$AllowModelNetwork
)

$ErrorActionPreference = 'Stop'
if ($Mode -eq 'configured' -and -not $AllowModelNetwork) {
    throw 'Configured mode requires -AllowModelNetwork.'
}
$coreRoot = Split-Path -Parent $PSScriptRoot
$fixtureRoot = Join-Path $coreRoot 'benchmarks/resume-extraction'
$runId = $Mode + '-' + $Split + '-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ')
$temporaryRoot = '/tmp/ats-resume-benchmark-' + $runId
$runtimeRoot = $temporaryRoot + '/ats-core'
$runtimeDataset = $runtimeRoot + '/benchmarks/resume-extraction'
$destination = Join-Path (Join-Path $fixtureRoot 'runs') $runId

function Invoke-DockerChecked {
    param([string[]]$DockerArguments)
    & docker @DockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker operation failed. Verify the existing AI container is running.'
    }
}

Invoke-DockerChecked -DockerArguments @('inspect', '--format', '{{.State.Running}}', $Container)
Invoke-DockerChecked -DockerArguments @('exec', $Container, 'mkdir', '-p', ($runtimeRoot + '/scripts'), $runtimeDataset)
try {
    # Only source code and synthetic corpus inputs are copied; previous/private runs stay local.
    Invoke-DockerChecked -DockerArguments @('cp', (Join-Path $coreRoot 'src'), ($Container + ':' + $runtimeRoot + '/src'))
    Invoke-DockerChecked -DockerArguments @('cp', (Join-Path $PSScriptRoot 'benchmark_resume_extraction.py'), ($Container + ':' + $runtimeRoot + '/scripts/benchmark_resume_extraction.py'))
    foreach ($inputName in @('documents', 'labels', 'sources', 'manifest.jsonl', 'taxonomy.json')) {
        Invoke-DockerChecked -DockerArguments @('cp', (Join-Path $fixtureRoot $inputName), ($Container + ':' + $runtimeDataset + '/' + $inputName))
    }
    $benchmarkArguments = @('exec', $Container, 'python', ($runtimeRoot + '/scripts/benchmark_resume_extraction.py'),
        '--mode', $Mode, '--split', $Split, '--case-timeout', "$CaseTimeout", '--as-of', $AsOf,
        '--output', ($runtimeDataset + '/runs/' + $runId))
    if ($AllowModelNetwork) { $benchmarkArguments += '--allow-model-network' }
    & docker @benchmarkArguments
    $benchmarkExitCode = $LASTEXITCODE
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Invoke-DockerChecked -DockerArguments @('cp', ($Container + ':' + $runtimeDataset + '/runs/' + $runId), $destination)
    Write-Output ('Local report: ' + (Join-Path $destination 'report.md'))
}
finally {
    # Resolve and verify the dedicated Linux temporary target before recursive cleanup.
    $cleanup = 'import pathlib,shutil,sys; p=pathlib.Path(sys.argv[1]).resolve(); assert p.parent == pathlib.Path("/tmp") and p.name.startswith("ats-resume-benchmark-"); shutil.rmtree(p)'
    & docker exec --user 0 $Container python -c $cleanup $temporaryRoot
    if ($LASTEXITCODE -ne 0) { Write-Warning 'Temporary benchmark files could not be cleaned up.' }
}
exit $benchmarkExitCode
