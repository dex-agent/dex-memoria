[CmdletBinding()]
param(
  [string]$OutputRoot,
  [string]$RepoRoot,
  [string]$LinkValidator,
  [string]$Finder,
  [string]$BaselineFinder
)

$ErrorActionPreference = 'Stop'

if (
  [string]::IsNullOrWhiteSpace($LinkValidator) -or
  [string]::IsNullOrWhiteSpace($Finder) -or
  [string]::IsNullOrWhiteSpace($BaselineFinder)
) {
  throw 'LinkValidator, Finder and BaselineFinder must be supplied explicitly.'
}

$userProfilePath = [Environment]::GetFolderPath(
  [Environment+SpecialFolder]::UserProfile
)
if ([string]::IsNullOrWhiteSpace($userProfilePath)) {
  throw 'Unable to resolve the current user profile.'
}

function Write-Utf8Json {
  param(
    [Parameter(Mandatory)]
    [string]$Path,
    [Parameter(Mandatory)]
    [object]$Value
  )

  $json = $Value | ConvertTo-Json -Depth 30
  [System.IO.File]::WriteAllText(
    $Path,
    "$json`n",
    [System.Text.UTF8Encoding]::new($false)
  )
}

function Assert-PlainFile {
  param([string]$Path, [string]$Label)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "$Label not found: $Path"
  }
  if ((Get-Item -LiteralPath $Path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "$Label must not be a reparse point: $Path"
  }
}

function Assert-ContainsText {
  param([string]$Path, [string]$ExpectedText, [string]$Label)
  $content = Get-Content -LiteralPath $Path -Raw
  if (-not $content.Contains($ExpectedText)) {
    throw "$Label did not preserve the expected text: $Path"
  }
}

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
  $RepoRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot '..\..\..')
  )
}

$repoItem = Get-Item -LiteralPath $RepoRoot -Force
$RepoRoot = $repoItem.FullName
$runnerPath = Join-Path $RepoRoot 'scripts\run-memory-v2-create-recall-fixture.js'
$l2FixtureSource = Join-Path $RepoRoot 'test\fixtures\governed-theme-v2-plan-l2'
$l3FixtureSource = Join-Path $RepoRoot 'test\fixtures\governed-theme-v2-plan-l3'

Assert-PlainFile -Path $runnerPath -Label 'integrated runner'
Assert-PlainFile -Path $LinkValidator -Label 'link validator'
Assert-PlainFile -Path $Finder -Label 'Finder'
Assert-PlainFile -Path $BaselineFinder -Label 'baseline Finder'

$laboratoryRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $userProfilePath '.agents\laboratorio-memories')
)
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $runId = Get-Date -Format 'yyyyMMdd-HHmmss'
  $OutputRoot = Join-Path $laboratoryRoot "dex-memoria-v2-pilot-$runId"
}

$OutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$liveVault = [System.IO.Path]::GetFullPath(
  (Join-Path $userProfilePath '.agents\memories')
)
$laboratoryPrefix = "$laboratoryRoot$([IO.Path]::DirectorySeparatorChar)"
$repoPrefix = "$RepoRoot$([IO.Path]::DirectorySeparatorChar)"
$vaultPrefix = "$liveVault$([IO.Path]::DirectorySeparatorChar)"
if (
  -not $OutputRoot.StartsWith($laboratoryPrefix, [StringComparison]::OrdinalIgnoreCase) -or
  $OutputRoot -eq $RepoRoot -or
  $OutputRoot.StartsWith($repoPrefix, [StringComparison]::OrdinalIgnoreCase) -or
  $OutputRoot -eq $liveVault -or
  $OutputRoot.StartsWith($vaultPrefix, [StringComparison]::OrdinalIgnoreCase)
) {
  throw 'OutputRoot must be a new child of the governed laboratory.'
}
if (Test-Path -LiteralPath $OutputRoot) {
  throw "OutputRoot already exists: $OutputRoot"
}

[IO.Directory]::CreateDirectory($OutputRoot) | Out-Null
$fixtureNames = @('l2-commit', 'l2-recovery', 'l3-commit', 'l3-recovery')
foreach ($fixtureName in $fixtureNames) {
  [IO.Directory]::CreateDirectory((Join-Path $OutputRoot $fixtureName)) | Out-Null
}

Copy-Item -LiteralPath (Join-Path $l2FixtureSource 'baseline') -Destination (Join-Path $OutputRoot 'l2-commit\work') -Recurse
Copy-Item -LiteralPath (Join-Path $l2FixtureSource 'baseline') -Destination (Join-Path $OutputRoot 'l2-recovery\work') -Recurse
Copy-Item -LiteralPath (Join-Path $l3FixtureSource 'baseline') -Destination (Join-Path $OutputRoot 'l3-commit\work') -Recurse
Copy-Item -LiteralPath (Join-Path $l3FixtureSource 'baseline') -Destination (Join-Path $OutputRoot 'l3-recovery\work') -Recurse

$runToken = Get-Date -Format 'yyyyMMddHHmmssfff'
$requests = @{
  l2 = [ordered]@{
    contract = 'dex.memory.create.theme-v2.request.v0'
    profile = 'governed-theme-v2'
    operation = 'create'
    idempotency_key = "pilot:v2:l2:$runToken"
    identity = '11111111-1111-4111-8111-111111111111'
    target_layer = 'L2'
    route_decision = 'explicit-l2-memory'
    slug = 'mapa-visual-v2'
    trigger = 'Quando o mapa visual V2 falhar?'
    title = 'Mapa visual V2'
    body = 'Memoria operacional ficticia criada pelo piloto V2.'
    created_at = '2026-07-16T12:00:00.000Z'
  }
  l3 = [ordered]@{
    contract = 'dex.memory.create.theme-v2.request.v0'
    profile = 'governed-theme-v2'
    operation = 'create'
    idempotency_key = "pilot:v2:l3:$runToken"
    identity = '22222222-2222-4222-8222-222222222222'
    target_layer = 'L3'
    route_decision = 'explicit-l3-knowledge'
    slug = 'journal-recuperavel'
    trigger = 'E SE o journal falhar?'
    title = 'Journal recuperavel'
    body = 'Conhecimento ficticio com recuperacao e pesquisa verificaveis.'
    owner_skill = 'dex-memoria'
    created_at = '2026-07-16T12:00:00.000Z'
  }
}

foreach ($fixtureName in $fixtureNames) {
  $isL2 = $fixtureName.StartsWith('l2')
  $sourceRoot = if ($isL2) { $l2FixtureSource } else { $l3FixtureSource }
  $manifest = Get-Content -LiteralPath (Join-Path $sourceRoot 'manifest.json') -Raw | ConvertFrom-Json
  $manifest.contract = 'dex.memory.fixture.governed-theme-v2-transaction.v0'
  Write-Utf8Json -Path (Join-Path $OutputRoot "$fixtureName\manifest.json") -Value $manifest
  Write-Utf8Json -Path (Join-Path $OutputRoot "$fixtureName\.dex-memory-fixture.json") -Value ([ordered]@{
    contract = 'dex.memory.disposable-run.v1'
    operation = 'create'
    disposable = $true
    targets = @('work/tema-exemplo')
  })
}

$l2RequestPath = Join-Path $OutputRoot 'l2-request.json'
$l3RequestPath = Join-Path $OutputRoot 'l3-request.json'
Write-Utf8Json -Path $l2RequestPath -Value $requests.l2
Write-Utf8Json -Path $l3RequestPath -Value $requests.l3

$nodeCommand = (Get-Command node -ErrorAction Stop).Source
$runnerArguments = @(
  $runnerPath,
  '--commit-fixture-l2', (Join-Path $OutputRoot 'l2-commit'),
  '--recovery-fixture-l2', (Join-Path $OutputRoot 'l2-recovery'),
  '--request-l2', $l2RequestPath,
  '--commit-fixture-l3', (Join-Path $OutputRoot 'l3-commit'),
  '--recovery-fixture-l3', (Join-Path $OutputRoot 'l3-recovery'),
  '--request-l3', $l3RequestPath,
  '--link-validator', $LinkValidator,
  '--finder', $Finder,
  '--baseline-finder', $BaselineFinder
)

$runnerOutput = & $nodeCommand @runnerArguments 2>&1
if ($LASTEXITCODE -ne 0) {
  [IO.File]::WriteAllLines(
    (Join-Path $OutputRoot 'runner-error.txt'),
    @($runnerOutput),
    [Text.UTF8Encoding]::new($false)
  )
  throw "V2 pilot failed. Evidence preserved at $OutputRoot"
}

$receipt = ($runnerOutput -join "`n") | ConvertFrom-Json
$l2Destination = Join-Path $OutputRoot 'l2-commit\work\tema-exemplo\memorias\mapa-visual-v2.md'
$l3Destination = Join-Path $OutputRoot 'l3-commit\work\tema-exemplo\conhecimento\journal-recuperavel\README.md'
Assert-ContainsText -Path $l2Destination -ExpectedText $requests.l2.body -Label 'L2 destination'
Assert-ContainsText -Path $l3Destination -ExpectedText $requests.l3.body -Label 'L3 destination'
Write-Utf8Json -Path (Join-Path $OutputRoot 'receipt.json') -Value $receipt
Write-Utf8Json -Path (Join-Path $OutputRoot 'PILOT-MANIFEST.json') -Value ([ordered]@{
  contract = 'dex.memory.v2.pilot-manifest.v0'
  status = 'PASS'
  authority = 'fixture_only_experimental'
  active_write_profile = 'legacy-v1'
  output_root = $OutputRoot
  repo_root = $RepoRoot
  receipt = 'receipt.json'
  inspect = @(
    'l2-commit/work/tema-exemplo/lembranca.md',
    'l2-commit/work/tema-exemplo/memorias/mapa-visual-v2.md',
    'l3-commit/work/tema-exemplo/lembranca.md',
    'l3-commit/work/tema-exemplo/conhecimento/journal-recuperavel/README.md'
  )
  live_vault_touched = $false
  cleanup = 'manual_after_review'
})

[pscustomobject]@{
  status = 'PASS'
  output_root = $OutputRoot
  receipt = (Join-Path $OutputRoot 'receipt.json')
  manifest = (Join-Path $OutputRoot 'PILOT-MANIFEST.json')
} | ConvertTo-Json -Depth 3
