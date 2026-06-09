param(
  [Parameter(Mandatory = $true)]
  [string]$Video,

  [string]$ThemeId = "",

  [switch]$SafeRemix,

  [switch]$StructureOnly,

  [switch]$ForceUnderstanding,

  [int]$Frames = -1,

  [int]$DrawRetries = -1,

  [int]$DrawConcurrency = -1,

  [int]$DrawRetryDelayMs = -1,

  [int]$DrawTimeoutMs = -1,

  [switch]$ExportTapFight,

  [switch]$GenerateStageAssets,

  [string]$TapFightDir = "",

  [string]$StageTemplate = "office_battle_001"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$Utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
$OutputEncoding = $Utf8NoBom
try {
  [Console]::InputEncoding = $Utf8NoBom
  [Console]::OutputEncoding = $Utf8NoBom
} catch {
  # Some redirected shells do not expose a writable console encoding.
}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Pipeline = Join-Path $Root "video-pipeline"
$VideoPath = Resolve-Path -LiteralPath $Video

$argsList = @("run", "package:video", "--", "--video", $VideoPath.Path)

if ($ThemeId) {
  $argsList += @("--theme-id", $ThemeId)
}

if ($SafeRemix) {
  $argsList += "--safe-remix"
}

if ($StructureOnly) {
  $argsList += @("--allow-fallback", "--no-llm", "--no-draw")
}

if ($ForceUnderstanding) {
  $argsList += "--force-understanding"
}

if ($Frames -ge 1) {
  $argsList += @("--frames", [string]$Frames)
}

if ($DrawRetries -ge 0) {
  $argsList += @("--draw-retries", [string]$DrawRetries)
}

if ($DrawConcurrency -ge 1) {
  $argsList += @("--draw-concurrency", [string]$DrawConcurrency)
}

if ($DrawRetryDelayMs -ge 0) {
  $argsList += @("--draw-retry-delay-ms", [string]$DrawRetryDelayMs)
}

if ($DrawTimeoutMs -ge 1) {
  $argsList += @("--draw-timeout-ms", [string]$DrawTimeoutMs)
}

if ($ExportTapFight) {
  $argsList += "--export-tap-fight"
}

if ($GenerateStageAssets) {
  $argsList += "--generate-stage-assets"
}

if ($TapFightDir) {
  $tapPath = Resolve-Path -LiteralPath $TapFightDir
  $argsList += @("--tap-fight-dir", $tapPath.Path)
}

if ($StageTemplate) {
  $argsList += @("--stage-template", $StageTemplate)
}

Push-Location $Pipeline
$NpmExitCode = 0
try {
  npm @argsList
  $NpmExitCode = $LASTEXITCODE
} finally {
  Pop-Location
}

if ($NpmExitCode -ne 0) {
  exit $NpmExitCode
}
