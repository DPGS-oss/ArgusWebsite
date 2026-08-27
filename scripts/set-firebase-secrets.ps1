# Store API keys in Firebase Secret Manager (never commit keys to git).
# Run from ArgusWebsite/:  .\scripts\set-firebase-secrets.ps1
param(
  [string]$Project = "argus-invocing"
)

$ErrorActionPreference = "Stop"

function Set-FirebaseSecret([string]$Name) {
  Write-Host ""
  Write-Host "Paste $Name (input hidden), then Enter:"
  $secure = Read-Host -AsSecureString
  $plain = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  )
  if (-not $plain.Trim()) {
    Write-Host "Skipped $Name (empty)."
    return
  }
  $plain.Trim() | npx firebase functions:secrets:set $Name --data-file - --project $Project --force
  Write-Host "Set $Name on project $Project."
}

Write-Host "Firebase secrets setup for Argus ($Project)"
Write-Host "Keys are stored in Google Secret Manager — not in this repo."

Set-FirebaseSecret "OPENROUTER_API_KEY"
Set-FirebaseSecret "RESEND_API_KEY"

Write-Host ""
Write-Host "Deploy functions after secrets are set:"
Write-Host "  npx firebase deploy --only functions:apiAsk,functions:apiAdmin,functions:rotateAdminAccessKey --project $Project"
