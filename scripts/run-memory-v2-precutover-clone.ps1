[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('prepare', 'verify', 'restore-cleanup')]
    [string]$Command,

    [string]$SourceZip,
    [Parameter(Mandatory = $true)]
    [string]$LaboratoryRoot,
    [string]$ExpectedSourceSha256,
    [Parameter(Mandatory = $true)]
    [string]$LiveVaultPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$contract = 'dex.memory.precutover.clone.v0'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\', '/')
$labPath = [IO.Path]::GetFullPath($LaboratoryRoot).TrimEnd('\', '/')
$liveVaultRoot = [IO.Path]::GetFullPath($LiveVaultPath).TrimEnd('\', '/')

function Stop-Harness {
    param(
        [int]$ExitCode,
        [string]$Code,
        [string]$Message
    )
    $failure = [Exception]::new($Message)
    $failure.Data['ExitCode'] = $ExitCode
    $failure.Data['Code'] = $Code
    throw $failure
}

function Test-PathsOverlap {
    param([string]$FirstPath, [string]$SecondPath)
    $first = [IO.Path]::GetFullPath($FirstPath).TrimEnd('\', '/')
    $second = [IO.Path]::GetFullPath($SecondPath).TrimEnd('\', '/')
    if ([string]::Equals($first, $second, [StringComparison]::OrdinalIgnoreCase)) {
        return $true
    }
    $firstPrefix = $first + [IO.Path]::DirectorySeparatorChar
    $secondPrefix = $second + [IO.Path]::DirectorySeparatorChar
    return $first.StartsWith($secondPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        $second.StartsWith($firstPrefix, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-OutsideProtectedRoots {
    param([string]$CandidatePath, [string]$Label)
    if (Test-PathsOverlap $CandidatePath $liveVaultRoot) {
        Stop-Harness 3 'LIVE_VAULT_BLOCKED' "$Label overlaps the declared live vault"
    }
    if ($Label -eq 'laboratory root' -and (Test-PathsOverlap $CandidatePath $repoRoot)) {
        Stop-Harness 3 'REPOSITORY_PATH_BLOCKED' 'laboratory root must remain outside the repository'
    }
}

function Assert-PlainDirectory {
    param([string]$DirectoryPath, [string]$Label)
    if (-not (Test-Path -LiteralPath $DirectoryPath -PathType Container)) {
        Stop-Harness 3 'LABORATORY_INVALID' "$Label is missing"
    }
    $directoryItem = Get-Item -LiteralPath $DirectoryPath -Force
    if (($directoryItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        Stop-Harness 3 'REPARSE_POINT_BLOCKED' "$Label is a reparse point"
    }
    $resolved = [IO.Path]::GetFullPath($directoryItem.FullName).TrimEnd('\', '/')
    if (-not [string]::Equals($resolved, [IO.Path]::GetFullPath($DirectoryPath).TrimEnd('\', '/'), [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Harness 3 'PATH_RESOLUTION_BLOCKED' "$Label did not resolve literally"
    }
}

function Assert-TreeContainsPlainEntries {
    param([string]$RootPath)
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($RootPath)
    while ($pending.Count -gt 0) {
        $currentPath = $pending.Pop()
        foreach ($childItem in Get-ChildItem -LiteralPath $currentPath -Force) {
            if (($childItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                Stop-Harness 3 'REPARSE_POINT_BLOCKED' 'clone tree contains a reparse point'
            }
            if ($childItem.PSIsContainer) {
                $pending.Push($childItem.FullName)
            } elseif (-not ($childItem -is [IO.FileInfo])) {
                Stop-Harness 3 'NON_FILE_ENTRY_BLOCKED' 'clone tree contains an unsupported entry'
            }
        }
    }
}

function Get-TreeManifest {
    param([string]$RootPath)
    Assert-PlainDirectory $RootPath 'manifest root'
    Assert-TreeContainsPlainEntries $RootPath
    $rootPrefix = [IO.Path]::GetFullPath($RootPath).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    $files = @()
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($RootPath)
    while ($pending.Count -gt 0) {
        $currentPath = $pending.Pop()
        foreach ($childItem in Get-ChildItem -LiteralPath $currentPath -Force | Sort-Object -Property Name) {
            if ($childItem.PSIsContainer) {
                $pending.Push($childItem.FullName)
                continue
            }
            $relativePath = $childItem.FullName.Substring($rootPrefix.Length).Replace('\', '/')
            $files += [pscustomobject][ordered]@{
                relative_path = $relativePath
                length = [int64]$childItem.Length
                sha256 = Get-Sha256 -FilePath $childItem.FullName
            }
        }
    }
    $orderedFiles = @($files)
    $ordinalPathComparer = [Collections.Generic.Comparer[object]]::Create(
        [Comparison[object]]{
            param($leftEntry, $rightEntry)
            return [StringComparer]::Ordinal.Compare(
                [string]$leftEntry.relative_path,
                [string]$rightEntry.relative_path
            )
        }
    )
    [Array]::Sort($orderedFiles, $ordinalPathComparer)
    [int64]$totalBytes = 0
    foreach ($fileEntry in $orderedFiles) {
        $totalBytes += [int64]$fileEntry.length
    }
    $manifestBody = [ordered]@{
        schema = 'dex.memory.private-tree-manifest.v1'
        files = $orderedFiles
    }
    $manifestJson = $manifestBody | ConvertTo-Json -Depth 6 -Compress
    $manifestBytes = [Text.Encoding]::UTF8.GetBytes($manifestJson)
    $shaProvider = [Security.Cryptography.SHA256]::Create()
    try {
        $manifestSha256 = ([BitConverter]::ToString($shaProvider.ComputeHash($manifestBytes))).Replace('-', '')
    } finally {
        $shaProvider.Dispose()
    }
    return [ordered]@{
        body = $manifestBody
        json = $manifestJson
        sha256 = $manifestSha256
        file_count = $orderedFiles.Count
        total_bytes = $totalBytes
    }
}

function Get-Sha256 {
    param([string]$FilePath)

    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    $fileStream = [System.IO.File]::OpenRead($FilePath)
    try {
        $hashBytes = $sha256.ComputeHash($fileStream)
        return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '')
    }
    finally {
        $fileStream.Dispose()
        $sha256.Dispose()
    }
}

function Write-PrivateManifest {
    param([string]$ManifestPath, [System.Collections.IDictionary]$Manifest)
    [IO.File]::WriteAllText($ManifestPath, $Manifest.json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Read-PrivateManifest {
    param([string]$ManifestPath)
    if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
        Stop-Harness 3 'PRIVATE_MANIFEST_MISSING' 'private baseline manifest is missing'
    }
    $rawManifest = [IO.File]::ReadAllText($ManifestPath)
    $manifestJson = $rawManifest.TrimEnd([char[]]@([char]13, [char]10))
    $manifestBytes = [Text.Encoding]::UTF8.GetBytes($manifestJson)
    $shaProvider = [Security.Cryptography.SHA256]::Create()
    try {
        $manifestSha256 = ([BitConverter]::ToString($shaProvider.ComputeHash($manifestBytes))).Replace('-', '')
    } finally {
        $shaProvider.Dispose()
    }
    return [ordered]@{
        body = $manifestJson | ConvertFrom-Json
        sha256 = $manifestSha256
    }
}

function Test-ExactManifestFiles {
    param([object[]]$ExpectedFiles, [object[]]$ActualFiles)
    if ($ExpectedFiles.Count -ne $ActualFiles.Count) {
        return $false
    }
    $actualByPath = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    foreach ($actualFile in $ActualFiles) {
        $relativePath = [string]$actualFile.relative_path
        if ($actualByPath.ContainsKey($relativePath)) {
            return $false
        }
        $actualByPath[$relativePath] = $actualFile
    }
    foreach ($expectedFile in $ExpectedFiles) {
        $relativePath = [string]$expectedFile.relative_path
        if (-not $actualByPath.ContainsKey($relativePath)) {
            return $false
        }
        $actualFile = $actualByPath[$relativePath]
        if ([int64]$actualFile.length -ne [int64]$expectedFile.length -or
            -not [string]::Equals([string]$actualFile.sha256, [string]$expectedFile.sha256, [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
        $actualByPath.Remove($relativePath)
    }
    return $actualByPath.Count -eq 0
}

function Compare-NoShrink {
    param([object]$BaselineManifest, [System.Collections.IDictionary]$WorkingManifest)
    $workingByPath = [Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    foreach ($workingFile in $WorkingManifest.body.files) {
        $workingByPath[[string]$workingFile.relative_path] = $workingFile
    }
    foreach ($baselineFile in $BaselineManifest.files) {
        $relativePath = [string]$baselineFile.relative_path
        if (-not $workingByPath.ContainsKey($relativePath)) {
            return $false
        }
        $workingFile = $workingByPath[$relativePath]
        if ([int64]$workingFile.length -ne [int64]$baselineFile.length -or
            -not [string]::Equals([string]$workingFile.sha256, [string]$baselineFile.sha256, [StringComparison]::OrdinalIgnoreCase)) {
            return $false
        }
    }
    return $true
}

function Copy-DirectoryContents {
    param([string]$SourceRoot, [string]$DestinationRoot)
    foreach ($childItem in Get-ChildItem -LiteralPath $SourceRoot -Force) {
        Copy-Item -LiteralPath $childItem.FullName -Destination $DestinationRoot -Recurse -Force
    }
}

function Expand-SealedArchive {
    param([string]$ArchivePath, [string]$DestinationRoot)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead($ArchivePath)
    try {
        foreach ($entry in $archive.Entries) {
            $entryPath = $entry.FullName.Replace('\', '/')
            if ([string]::IsNullOrWhiteSpace($entryPath)) {
                continue
            }
            $segments = @($entryPath.Split('/') | Where-Object { $_ -ne '' })
            if ([IO.Path]::IsPathRooted($entryPath) -or $entryPath.Contains(':') -or $segments -contains '..') {
                Stop-Harness 3 'ZIP_ENTRY_BLOCKED' 'archive contains an escaping entry'
            }
            $unixMode = ($entry.ExternalAttributes -shr 16) -band 0xF000
            if ($unixMode -eq 0xA000) {
                Stop-Harness 3 'ZIP_ENTRY_BLOCKED' 'archive contains a symbolic link entry'
            }
            $destinationPath = [IO.Path]::GetFullPath((Join-Path $DestinationRoot ($segments -join [IO.Path]::DirectorySeparatorChar)))
            $destinationPrefix = [IO.Path]::GetFullPath($DestinationRoot).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
            if (-not $destinationPath.StartsWith($destinationPrefix, [StringComparison]::OrdinalIgnoreCase)) {
                Stop-Harness 3 'ZIP_ENTRY_BLOCKED' 'archive entry escapes the baseline root'
            }
            if ([string]::IsNullOrEmpty($entry.Name)) {
                [IO.Directory]::CreateDirectory($destinationPath) | Out-Null
                continue
            }
            $parentPath = [IO.Path]::GetDirectoryName($destinationPath)
            [IO.Directory]::CreateDirectory($parentPath) | Out-Null
            if (Test-Path -LiteralPath $destinationPath) {
                Stop-Harness 3 'ZIP_ENTRY_BLOCKED' 'archive contains a duplicate destination'
            }
            $entryStream = $entry.Open()
            $destinationStream = [IO.File]::Create($destinationPath)
            try {
                $entryStream.CopyTo($destinationStream)
            } finally {
                $destinationStream.Dispose()
                $entryStream.Dispose()
            }
        }
    } finally {
        $archive.Dispose()
    }
    Assert-TreeContainsPlainEntries $DestinationRoot
}

function Get-LabPaths {
    return [ordered]@{
        marker = Join-Path $labPath 'lab-marker.json'
        private = Join-Path $labPath 'private'
        baseline_manifest = Join-Path $labPath 'private\baseline-manifest.json'
        input = Join-Path $labPath 'input'
        sealed_zip = Join-Path $labPath 'input\input-sealed.zip'
        baseline = Join-Path $labPath 'baseline'
        working = Join-Path $labPath 'working'
    }
}

function Read-LabMarker {
    param([System.Collections.IDictionary]$Paths)
    Assert-PlainDirectory $labPath 'laboratory root'
    if (-not (Test-Path -LiteralPath $Paths.marker -PathType Leaf)) {
        Stop-Harness 3 'LABORATORY_MARKER_MISSING' 'laboratory marker is missing'
    }
    $marker = Get-Content -Raw -LiteralPath $Paths.marker | ConvertFrom-Json
    if ($marker.contract -ne $contract -or $marker.disposable -ne $true -or $marker.live_vault_touched -ne $false) {
        Stop-Harness 3 'LABORATORY_MARKER_INVALID' 'laboratory marker is invalid'
    }
    return $marker
}

function New-SanitizedReceipt {
    param(
        [string]$ReceiptCommand,
        [string]$Status,
        [System.Collections.IDictionary]$BaselineManifest,
        [System.Collections.IDictionary]$WorkingManifest,
        [string]$SourceSha256,
        [string]$SealedSha256,
        [int64]$ArchiveBytes,
        [bool]$NoShrink
    )
    return [ordered]@{
        contract = $contract
        command = $ReceiptCommand
        status = $Status
        authority = 'fixture_only_experimental'
        laboratory_root = $labPath
        source_archive_sha256 = $SourceSha256
        sealed_archive_sha256 = $SealedSha256
        archive_bytes = $ArchiveBytes
        baseline_manifest_sha256 = $BaselineManifest.sha256
        working_manifest_sha256 = $WorkingManifest.sha256
        baseline_file_count = $BaselineManifest.file_count
        working_file_count = $WorkingManifest.file_count
        baseline_total_bytes = $BaselineManifest.total_bytes
        working_total_bytes = $WorkingManifest.total_bytes
        no_shrink = $NoShrink
        private_manifest_promoted = $false
        cleanup_not_candidate_recovery = $true
        live_vault_touched = $false
        active_write_profile = 'legacy-v1'
        v2_status = 'approved_not_active'
    }
}

function Write-Receipt {
    param([object]$Receipt)
    [Console]::Out.WriteLine(($Receipt | ConvertTo-Json -Depth 6 -Compress))
}

try {
    Assert-OutsideProtectedRoots $labPath 'laboratory root'
    $paths = Get-LabPaths

    if ($Command -eq 'prepare') {
        if ([string]::IsNullOrWhiteSpace($SourceZip) -or [string]::IsNullOrWhiteSpace($ExpectedSourceSha256)) {
            Stop-Harness 2 'INVALID_USAGE' 'prepare requires SourceZip and ExpectedSourceSha256'
        }
        $sourceArchivePath = [IO.Path]::GetFullPath($SourceZip)
        Assert-OutsideProtectedRoots $sourceArchivePath 'source archive'
        if (-not (Test-Path -LiteralPath $sourceArchivePath -PathType Leaf)) {
            Stop-Harness 2 'SOURCE_ARCHIVE_MISSING' 'source archive is missing'
        }
        $sourceItem = Get-Item -LiteralPath $sourceArchivePath -Force
        if (($sourceItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $sourceItem.Extension -ne '.zip') {
            Stop-Harness 3 'SOURCE_ARCHIVE_BLOCKED' 'source archive must be a plain ZIP file'
        }
        if (Test-Path -LiteralPath $labPath) {
            Stop-Harness 3 'LABORATORY_ALREADY_EXISTS' 'laboratory root must be new'
        }
        $expectedHash = $ExpectedSourceSha256.Trim().ToUpperInvariant()
        if ($expectedHash -notmatch '^[A-F0-9]{64}$') {
            Stop-Harness 2 'INVALID_USAGE' 'ExpectedSourceSha256 must contain 64 hexadecimal characters'
        }
        $sourceHashBefore = Get-Sha256 -FilePath $sourceArchivePath
        if ($sourceHashBefore -ne $expectedHash) {
            Stop-Harness 4 'SOURCE_HASH_MISMATCH' 'source archive hash differs from the expected receipt'
        }

        [IO.Directory]::CreateDirectory($paths.private) | Out-Null
        [IO.Directory]::CreateDirectory($paths.input) | Out-Null
        [IO.Directory]::CreateDirectory($paths.baseline) | Out-Null
        [IO.Directory]::CreateDirectory($paths.working) | Out-Null
        Copy-Item -LiteralPath $sourceArchivePath -Destination $paths.sealed_zip
        $sealedHash = Get-Sha256 -FilePath $paths.sealed_zip
        $sourceHashAfter = Get-Sha256 -FilePath $sourceArchivePath
        if ($sealedHash -ne $expectedHash -or $sourceHashAfter -ne $sourceHashBefore) {
            Stop-Harness 4 'SOURCE_IMMUTABILITY_FAILED' 'source or sealed archive hash diverged'
        }

        Expand-SealedArchive $paths.sealed_zip $paths.baseline
        $baselineManifest = Get-TreeManifest $paths.baseline
        Write-PrivateManifest $paths.baseline_manifest $baselineManifest
        Copy-DirectoryContents $paths.baseline $paths.working
        $workingManifest = Get-TreeManifest $paths.working
        if ($workingManifest.sha256 -ne $baselineManifest.sha256) {
            Stop-Harness 4 'CLONE_BASELINE_MISMATCH' 'working clone does not match the extracted baseline'
        }
        $marker = [ordered]@{
            contract = $contract
            disposable = $true
            live_vault_touched = $false
            source_archive_sha256 = $sourceHashBefore
            sealed_archive_sha256 = $sealedHash
            archive_bytes = [int64]$sourceItem.Length
            baseline_manifest_sha256 = $baselineManifest.sha256
        }
        [IO.File]::WriteAllText($paths.marker, (($marker | ConvertTo-Json -Depth 4 -Compress) + [Environment]::NewLine), [Text.UTF8Encoding]::new($false))
        Write-Receipt (New-SanitizedReceipt 'prepare' 'PREPARED' $baselineManifest $workingManifest $sourceHashBefore $sealedHash ([int64]$sourceItem.Length) $true)
        exit 0
    }

    $labMarker = Read-LabMarker $paths
    Assert-PlainDirectory $paths.baseline 'baseline root'
    Assert-PlainDirectory $paths.working 'working root'
    $storedBaseline = Read-PrivateManifest $paths.baseline_manifest
    $baselineManifest = Get-TreeManifest $paths.baseline
    if ($storedBaseline.sha256 -ne [string]$labMarker.baseline_manifest_sha256) {
        Stop-Harness 4 'BASELINE_MANIFEST_SEAL_FAILED' 'private baseline manifest no longer matches the laboratory marker'
    }
    if (-not (Test-ExactManifestFiles $storedBaseline.body.files $baselineManifest.body.files)) {
        Stop-Harness 4 'BASELINE_IMMUTABILITY_FAILED' 'baseline no longer matches its sealed manifest'
    }

    if ($Command -eq 'restore-cleanup') {
        $resolvedWorking = [IO.Path]::GetFullPath($paths.working).TrimEnd('\', '/')
        $labPrefix = $labPath + [IO.Path]::DirectorySeparatorChar
        if (-not $resolvedWorking.StartsWith($labPrefix, [StringComparison]::OrdinalIgnoreCase) -or
            -not [string]::Equals([IO.Path]::GetFileName($resolvedWorking), 'working', [StringComparison]::OrdinalIgnoreCase)) {
            Stop-Harness 3 'RESTORE_PATH_BLOCKED' 'working cleanup target is outside the laboratory allowlist'
        }
        Remove-Item -LiteralPath $resolvedWorking -Recurse -Force
        [IO.Directory]::CreateDirectory($resolvedWorking) | Out-Null
        Copy-DirectoryContents $paths.baseline $resolvedWorking
    }

    $workingManifest = Get-TreeManifest $paths.working
    $noShrink = Compare-NoShrink $storedBaseline.body $workingManifest
    if (-not $noShrink) {
        Stop-Harness 4 'NO_SHRINK_FAILED' 'working clone removed or changed a baseline file'
    }
    $status = if ($Command -eq 'restore-cleanup') { 'RESTORED_TO_BASELINE' } else { 'VERIFIED' }
    if ($Command -eq 'restore-cleanup' -and $workingManifest.sha256 -ne $baselineManifest.sha256) {
        Stop-Harness 4 'RESTORE_HASH_MISMATCH' 'cleanup restore did not return the clone to baseline'
    }
    Write-Receipt (New-SanitizedReceipt $Command $status $baselineManifest $workingManifest ([string]$labMarker.source_archive_sha256) ([string]$labMarker.sealed_archive_sha256) ([int64]$labMarker.archive_bytes) $true)
    exit 0
} catch {
    $exitCode = 6
    $errorCode = 'HARNESS_FAILED'
    if ($_.Exception.Data.Contains('ExitCode')) {
        $exitCode = [int]$_.Exception.Data['ExitCode']
    }
    if ($_.Exception.Data.Contains('Code')) {
        $errorCode = [string]$_.Exception.Data['Code']
    }
    $safeMessage = $errorCode
    if ($errorCode -eq 'HARNESS_FAILED') {
        $safeMessage = 'pre-cutover clone harness failed; inspect private laboratory diagnostics'
    }
    $errorReceipt = [ordered]@{
        contract = $contract
        command = $Command
        status = 'ERROR'
        code = $errorCode
        message = $safeMessage
        live_vault_touched = $false
    }
    [Console]::Error.WriteLine(($errorReceipt | ConvertTo-Json -Depth 4 -Compress))
    exit $exitCode
}
