param(
  [Parameter(Mandatory = $true)]
  [string]$Message
)

git add -A

git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  Write-Host "No changes to commit."
  exit 0
}

git commit -m $Message
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

git push origin main
exit $LASTEXITCODE

