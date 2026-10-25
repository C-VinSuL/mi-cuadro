$ErrorActionPreference = 'Stop'

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) {
    Write-Host 'No git repository found.'
    exit 1
}

$stagedFiles = git -C $repoRoot diff --cached --name-only --diff-filter=ACMR
if (-not $stagedFiles) {
    exit 0
}

$patterns = @(
    @'
(?i)gh[pousr]_[A-Za-z0-9_]{20,}
'@,
    @'
(?i)github_pat_[A-Za-z0-9_]{20,}
'@,
    @'
(?i)AIza[0-9A-Za-z\-_]{20,}
'@,
    @'
(?i)sk_(live|test)_[A-Za-z0-9]{16,}
'@,
    @'
(?i)(aws_secret_access_key|aws_access_key_id|xox[baprs]-[A-Za-z0-9-]+|BEGIN [A-Z ]*PRIVATE KEY|SERVICE_ROLE|PRIVATE_KEY|SECRET_KEY)
'@,
    @'
(?i)(service_role|secret_key|private_key|api_key|access_token|refresh_token)\s*[:=]\s*["'][^"'\r\n]{16,}["']
'@
)

$flagged = @()
foreach ($file in $stagedFiles.Split([Environment]::NewLine, [StringSplitOptions]::RemoveEmptyEntries)) {
    if ($file -match '^(?:\.githooks(?:/.*)?|\.env|\.env\..+|.*\.pem|.*\.key)$') {
        continue
    }

    $fullPath = Join-Path $repoRoot $file
    if (-not (Test-Path $fullPath -PathType Leaf)) {
        continue
    }

    $content = Get-Content -LiteralPath $fullPath -Raw -ErrorAction SilentlyContinue
    if ($null -eq $content) {
        continue
    }

    $matched = $false
    foreach ($pattern in $patterns) {
        if ($content -match $pattern) {
            $matched = $true
            break
        }
    }

    if ($matched) {
        $flagged += $file
    }
}

if ($flagged.Count -gt 0) {
    Write-Host 'Secret scan failed. Remove or rotate secret-like values before committing:' -ForegroundColor Red
    foreach ($file in $flagged) {
        Write-Host "  - $file" -ForegroundColor Yellow
    }
    exit 1
}

Write-Host 'Secret scan passed.'
exit 0
