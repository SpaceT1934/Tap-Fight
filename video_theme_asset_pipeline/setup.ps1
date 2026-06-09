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

Write-Host "Installing Node dependencies..."
Push-Location $Pipeline
npm install
Pop-Location

Write-Host "Installing Python dependencies..."
Push-Location $Pipeline
python -m pip install -r requirements.txt
Pop-Location

Write-Host "Setup complete."
