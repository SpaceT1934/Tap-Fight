param(
  [Parameter(Mandatory = $true)]
  [string]$Theme,

  [string]$TapFightDir = "",

  [string]$Video = "",

  [string]$StageTemplate = "office_battle_001",

  [switch]$NoRegistry,

  [switch]$AllowFallback
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

$argsList = @("run", "export:tap-fight", "--", "--theme", $Theme)

if ($TapFightDir) {
  $tapPath = Resolve-Path -LiteralPath $TapFightDir
  $argsList += @("--tap-fight-dir", $tapPath.Path)
}

if ($Video) {
  $videoPath = Resolve-Path -LiteralPath $Video
  $argsList += @("--video", $videoPath.Path)
}

if ($StageTemplate) {
  $argsList += @("--stage-template", $StageTemplate)
}

if ($NoRegistry) {
  $argsList += "--no-registry"
}

if ($AllowFallback) {
  $argsList += "--allow-fallback"
}

Push-Location $Pipeline
try {
  npm @argsList
} finally {
  Pop-Location
}
