[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$BundlePath
)

$ErrorActionPreference = 'Stop'

function Get-Sha256Hex {
  param([byte[]]$Bytes)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha256.ComputeHash($Bytes))).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $sha256.Dispose()
  }
}

function Assert-ExactPropertyNames {
  param($Value, [string[]]$Expected, [string]$Label)
  $actual = @($Value.PSObject.Properties.Name)
  if (($actual -join '|') -cne ($Expected -join '|')) { throw "$Label keys mismatch" }
}

function ConvertTo-CanonicalJsonValue {
  param($Value, [int]$Depth = 0)
  if ($null -eq $Value) { return 'null' }
  if ($Value -is [string]) { return ($Value | ConvertTo-Json -Compress) }
  if ($Value -is [bool]) { if ($Value) { return 'true' } else { return 'false' } }
  if ($Value -is [byte] -or $Value -is [sbyte] -or $Value -is [int16] -or $Value -is [uint16] -or $Value -is [int32] -or $Value -is [uint32] -or $Value -is [int64] -or $Value -is [uint64] -or $Value -is [single] -or $Value -is [double] -or $Value -is [decimal]) {
    return [System.Convert]::ToString($Value, [System.Globalization.CultureInfo]::InvariantCulture)
  }

  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [System.Collections.IDictionary]) -and -not ($Value -is [pscustomobject])) {
    $items = @($Value)
    if ($items.Count -eq 0) { return '[]' }
    $rows = @('[')
    for ($itemIndex = 0; $itemIndex -lt $items.Count; $itemIndex++) {
      $serializedItem = ConvertTo-CanonicalJsonValue $items[$itemIndex] ($Depth + 1)
      $itemLines = @($serializedItem -split "`n")
      $suffix = if ($itemIndex -lt $items.Count - 1) { ',' } else { '' }
      $rows += (' ' * (($Depth + 1) * 2)) + $itemLines[0]
      if ($itemLines.Count -gt 1) {
        for ($lineIndex = 1; $lineIndex -lt $itemLines.Count; $lineIndex++) { $rows += $itemLines[$lineIndex] }
      }
      $rows[$rows.Count - 1] += $suffix
    }
    $rows += (' ' * ($Depth * 2)) + ']'
    return ($rows -join "`n")
  }

  $properties = @($Value.PSObject.Properties)
  if ($properties.Count -eq 0) { return '{}' }
  $objectRows = @('{')
  for ($propertyIndex = 0; $propertyIndex -lt $properties.Count; $propertyIndex++) {
    $property = $properties[$propertyIndex]
    $serializedName = [string]($property.Name | ConvertTo-Json -Compress)
    $serializedValue = ConvertTo-CanonicalJsonValue $property.Value ($Depth + 1)
    $valueLines = @($serializedValue -split "`n")
    $suffix = if ($propertyIndex -lt $properties.Count - 1) { ',' } else { '' }
    $objectRows += (' ' * (($Depth + 1) * 2)) + $serializedName + ': ' + $valueLines[0]
    if ($valueLines.Count -gt 1) {
      for ($lineIndex = 1; $lineIndex -lt $valueLines.Count; $lineIndex++) { $objectRows += $valueLines[$lineIndex] }
    }
    $objectRows[$objectRows.Count - 1] += $suffix
  }
  $objectRows += (' ' * ($Depth * 2)) + '}'
  return ($objectRows -join "`n")
}

function Read-CanonicalJsonFile {
  param([string]$FilePath, [string]$Label)
  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xef -and $bytes[1] -eq 0xbb -and $bytes[2] -eq 0xbf) {
    throw "$Label contains BOM"
  }
  $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
  $text = $strictUtf8.GetString($bytes)
  if ($text.Contains("`r")) { throw "$Label contains CRLF" }
  if (-not $text.EndsWith("`n")) { throw "$Label has no terminal LF" }
  $value = $text | ConvertFrom-Json
  $canonicalText = (ConvertTo-CanonicalJsonValue $value) + "`n"
  if ($text -cne $canonicalText) { throw "$Label is not canonical" }
  return [pscustomobject]@{ Bytes = $bytes; Value = $value }
}

function Assert-FileMetadata {
  param([string]$RootPath, $Metadata, [string]$Label)
  $relativeParts = ([string]$Metadata.path).Split('/')
  $filePath = $RootPath
  foreach ($part in $relativeParts) { $filePath = Join-Path $filePath $part }
  $bytes = [System.IO.File]::ReadAllBytes($filePath)
  if ($bytes.Length -ne [int64]$Metadata.bytes -or (Get-Sha256Hex $bytes) -ne [string]$Metadata.sha256) {
    throw "$Label integrity mismatch"
  }
  return $bytes
}

try {
  $bundleRoot = [System.IO.Path]::GetFullPath($BundlePath)
  $generatedRoot = Join-Path $bundleRoot 'generated'
  $provenancePath = Join-Path $generatedRoot 'dex.memory.resource-limits.provenance.v1.json'
  $provenanceResult = Read-CanonicalJsonFile $provenancePath 'provenance'
  $provenance = $provenanceResult.Value
  Assert-ExactPropertyNames $provenance @('contract','version','authority_state','effective','policy','schema','generated') 'provenance'
  Assert-ExactPropertyNames $provenance.generated @('node_bootstrap','powershell_bootstrap') 'provenance.generated'
  foreach ($metadataCheck in @(
    [pscustomobject]@{ Label = 'policy'; Metadata = $provenance.policy; ExpectedPath = 'dex.memory.resource-limits.v1.json' },
    [pscustomobject]@{ Label = 'schema'; Metadata = $provenance.schema; ExpectedPath = 'dex.memory.resource-limits.v1.schema.json' },
    [pscustomobject]@{ Label = 'Node bootstrap'; Metadata = $provenance.generated.node_bootstrap; ExpectedPath = 'generated/dex.memory.resource-limits.bootstrap.node.v1.cjs' },
    [pscustomobject]@{ Label = 'PowerShell bootstrap'; Metadata = $provenance.generated.powershell_bootstrap; ExpectedPath = 'generated/dex.memory.resource-limits.bootstrap.powershell.v1.ps1' }
  )) {
    Assert-ExactPropertyNames $metadataCheck.Metadata @('path','bytes','sha256') "$($metadataCheck.Label) metadata"
    if ([string]$metadataCheck.Metadata.path -cne $metadataCheck.ExpectedPath) { throw "$($metadataCheck.Label) path mismatch" }
  }
  if ($provenance.contract -ne 'dex.memory.resource-limits.provenance.v1' -or $provenance.version -ne 1 -or $provenance.authority_state -ne 'SHADOW' -or $provenance.effective -ne $false) { throw 'provenance identity mismatch' }
  $null = Assert-FileMetadata $bundleRoot $provenance.generated.powershell_bootstrap 'PowerShell bootstrap provenance'
  $bootstrapPath = Join-Path $generatedRoot 'dex.memory.resource-limits.bootstrap.powershell.v1.ps1'
  $bootstrap = & $bootstrapPath
  Assert-ExactPropertyNames $bootstrap @('contract','version','authority_state','effective','bootstrap_ceiling','policy_path','policy_bytes','policy_sha256','schema_path','schema_bytes','schema_sha256') 'bootstrap'
  if ($bootstrap.contract -ne 'dex.memory.resource-limits.bootstrap.v1' -or $bootstrap.version -ne 1 -or $bootstrap.authority_state -ne 'SHADOW' -or $bootstrap.effective -ne $false -or $null -ne $bootstrap.bootstrap_ceiling) {
    throw 'bootstrap identity mismatch'
  }
  if ($bootstrap.policy_path -cne $provenance.policy.path -or $bootstrap.schema_path -cne $provenance.schema.path) { throw 'bootstrap path mismatch' }
  if ($bootstrap.policy_bytes -ne $provenance.policy.bytes -or $bootstrap.policy_sha256 -cne $provenance.policy.sha256 -or $bootstrap.schema_bytes -ne $provenance.schema.bytes -or $bootstrap.schema_sha256 -cne $provenance.schema.sha256) { throw 'bootstrap metadata mismatch' }

  $policyPath = Join-Path $bundleRoot $bootstrap.policy_path
  $schemaPath = Join-Path $bundleRoot $bootstrap.schema_path
  $policyResult = Read-CanonicalJsonFile $policyPath 'policy'
  $schemaResult = Read-CanonicalJsonFile $schemaPath 'schema'
  if ($policyResult.Bytes.Length -ne [int64]$bootstrap.policy_bytes -or (Get-Sha256Hex $policyResult.Bytes) -ne $bootstrap.policy_sha256) { throw 'policy bootstrap integrity mismatch' }
  if ($schemaResult.Bytes.Length -ne [int64]$bootstrap.schema_bytes -or (Get-Sha256Hex $schemaResult.Bytes) -ne $bootstrap.schema_sha256) { throw 'schema bootstrap integrity mismatch' }

  $null = Assert-FileMetadata $bundleRoot $provenance.policy 'policy provenance'
  $null = Assert-FileMetadata $bundleRoot $provenance.schema 'schema provenance'
  $null = Assert-FileMetadata $bundleRoot $provenance.generated.node_bootstrap 'Node bootstrap provenance'

  $policy = $policyResult.Value
  if ($policy.contract -ne 'dex.memory.resource-limits.v1' -or $policy.version -ne 1 -or $policy.authority_state -ne 'SHADOW' -or $policy.effective -ne $false -or $null -eq $policy.limits) { throw 'policy identity mismatch' }
  $receipt = [ordered]@{
    contract = 'dex.memory.resource-limits.shadow-receipt.v1'
    status = 'SHADOW_VERIFIED'
    authority_state = 'SHADOW'
    effective = $false
    policy_contract = [string]$policy.contract
    policy_version = [int]$policy.version
    policy_sha256 = Get-Sha256Hex $policyResult.Bytes
    schema_sha256 = Get-Sha256Hex $schemaResult.Bytes
    limit_count = @($policy.limits).Count
  }
  $receipt | ConvertTo-Json -Compress
}
catch {
  [Console]::Error.WriteLine("RESOURCE_LIMIT_SHADOW_INVALID: $($_.Exception.Message)")
  exit 1
}
