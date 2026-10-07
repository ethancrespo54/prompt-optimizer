# PowerShell version of the pre-commit hook

# Check whether a package-lock.json or yarn.lock file exists
if (Test-Path "package-lock.json") {
  Write-Host "Error: package-lock.json detected." -ForegroundColor Red
  Write-Host "This project enforces pnpm as the package manager. Please delete package-lock.json and install dependencies with pnpm install." -ForegroundColor Red
  exit 1
}

if (Test-Path "yarn.lock") {
  Write-Host "Error: yarn.lock detected." -ForegroundColor Red
  Write-Host "This project enforces pnpm as the package manager. Please delete yarn.lock and install dependencies with pnpm install." -ForegroundColor Red
  exit 1
}

# Make sure pnpm-lock.yaml exists
if (-not (Test-Path "pnpm-lock.yaml")) {
  Write-Host "Warning: pnpm-lock.yaml not detected." -ForegroundColor Yellow
  Write-Host "Please make sure to install dependencies with pnpm install." -ForegroundColor Yellow
} 

# Test gate (can be skipped with SKIP_TEST_GATE=1, for emergencies only)
if ($env:SKIP_TEST_GATE -eq "1") {
  Write-Host "Skipping the test gate: SKIP_TEST_GATE=1 detected" -ForegroundColor Yellow
  exit 0
}

Write-Host "Running the test gate (fast): pnpm test:gate" -ForegroundColor Cyan
pnpm test:gate
