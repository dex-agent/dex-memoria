import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const harnessPath = join(repoRoot, "scripts", "run-memory-v2-precutover-clone.ps1");
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";

test("pre-cutover harness seals a synthetic ZIP and prepares equal baseline/working manifests", async (t) => {
  const fixture = await createSyntheticArchive(t);
  const laboratoryRoot = join(fixture.root, "laboratory");

  const result = await runHarness([
    "-Command", "prepare",
    "-SourceZip", fixture.archivePath,
    "-LaboratoryRoot", laboratoryRoot,
    "-ExpectedSourceSha256", fixture.archiveSha256,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  const receipt = parseSingleJsonLine(result.stdout);
  assert.equal(receipt.contract, "dex.memory.precutover.clone.v0");
  assert.equal(receipt.command, "prepare");
  assert.equal(receipt.status, "PREPARED");
  assert.equal(receipt.source_archive_sha256, fixture.archiveSha256);
  assert.equal(receipt.sealed_archive_sha256, fixture.archiveSha256);
  assert.equal(receipt.baseline_manifest_sha256, receipt.working_manifest_sha256);
  assert.equal(receipt.baseline_file_count, 2);
  assert.equal(receipt.working_file_count, 2);
  assert.equal(receipt.private_manifest_promoted, false);
  assert.equal(receipt.cleanup_not_candidate_recovery, true);
  assert.equal("files" in receipt, false);

  const privateManifest = JSON.parse(await readFile(join(laboratoryRoot, "private", "baseline-manifest.json"), "utf8"));
  assert.equal(privateManifest.files.length, 2);
  assert.deepEqual(privateManifest.files.map((entry) => entry.relative_path).sort(), [
    "global/lembranca.md",
    "temas/tema-sintetico/memoria.md"
  ]);
});

test("pre-cutover harness detects shrink and cleanup restore returns the clone to baseline", async (t) => {
  const fixture = await createSyntheticArchive(t);
  const laboratoryRoot = join(fixture.root, "laboratory");
  const prepare = await runHarness([
    "-Command", "prepare",
    "-SourceZip", fixture.archivePath,
    "-LaboratoryRoot", laboratoryRoot,
    "-ExpectedSourceSha256", fixture.archiveSha256,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(prepare.exitCode, 0, prepare.stderr);

  await writeFile(join(laboratoryRoot, "working", "global", "lembranca.md"), "shrunk\n", "utf8");
  const failedVerify = await runHarness([
    "-Command", "verify",
    "-LaboratoryRoot", laboratoryRoot,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(failedVerify.exitCode, 4);
  assert.equal(parseSingleJsonLine(failedVerify.stderr).code, "NO_SHRINK_FAILED");

  const restore = await runHarness([
    "-Command", "restore-cleanup",
    "-LaboratoryRoot", laboratoryRoot,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(restore.exitCode, 0, restore.stderr);
  const restoreReceipt = parseSingleJsonLine(restore.stdout);
  assert.equal(restoreReceipt.status, "RESTORED_TO_BASELINE");
  assert.equal(restoreReceipt.cleanup_not_candidate_recovery, true);
  assert.equal(restoreReceipt.baseline_manifest_sha256, restoreReceipt.working_manifest_sha256);

  const verified = await runHarness([
    "-Command", "verify",
    "-LaboratoryRoot", laboratoryRoot,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(verified.exitCode, 0, verified.stderr);
  assert.equal(parseSingleJsonLine(verified.stdout).no_shrink, true);
});

test("pre-cutover verify treats manifest entry order as non-semantic", async (t) => {
  const fixture = await createSyntheticArchive(t);
  const laboratoryRoot = join(fixture.root, "laboratory");
  const prepare = await runHarness([
    "-Command", "prepare",
    "-SourceZip", fixture.archivePath,
    "-LaboratoryRoot", laboratoryRoot,
    "-ExpectedSourceSha256", fixture.archiveSha256,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(prepare.exitCode, 0, prepare.stderr);

  const manifestPath = join(laboratoryRoot, "private", "baseline-manifest.json");
  const markerPath = join(laboratoryRoot, "lab-marker.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files.reverse();
  const reorderedManifest = JSON.stringify(manifest);
  await writeFile(manifestPath, `${reorderedManifest}\n`, "utf8");

  const marker = JSON.parse(await readFile(markerPath, "utf8"));
  marker.baseline_manifest_sha256 = sha256(Buffer.from(reorderedManifest, "utf8"));
  await writeFile(markerPath, `${JSON.stringify(marker)}\n`, "utf8");

  const verified = await runHarness([
    "-Command", "verify",
    "-LaboratoryRoot", laboratoryRoot,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(verified.exitCode, 0, verified.stderr);
  assert.equal(parseSingleJsonLine(verified.stdout).no_shrink, true);
});

test("pre-cutover verify treats path casing as semantic", async (t) => {
  const fixture = await createSyntheticArchive(t);
  const laboratoryRoot = join(fixture.root, "laboratory");
  const prepare = await runHarness([
    "-Command", "prepare",
    "-SourceZip", fixture.archivePath,
    "-LaboratoryRoot", laboratoryRoot,
    "-ExpectedSourceSha256", fixture.archiveSha256,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(prepare.exitCode, 0, prepare.stderr);

  const manifestPath = join(laboratoryRoot, "private", "baseline-manifest.json");
  const markerPath = join(laboratoryRoot, "lab-marker.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files[0].relative_path = manifest.files[0].relative_path.toUpperCase();
  const recasedManifest = JSON.stringify(manifest);
  await writeFile(manifestPath, `${recasedManifest}\n`, "utf8");

  const marker = JSON.parse(await readFile(markerPath, "utf8"));
  marker.baseline_manifest_sha256 = sha256(Buffer.from(recasedManifest, "utf8"));
  await writeFile(markerPath, `${JSON.stringify(marker)}\n`, "utf8");

  const verified = await runHarness([
    "-Command", "verify",
    "-LaboratoryRoot", laboratoryRoot,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);
  assert.equal(verified.exitCode, 4, verified.stderr);
  assert.equal(parseSingleJsonLine(verified.stderr).code, "BASELINE_IMMUTABILITY_FAILED");
});

test("pre-cutover harness refuses source or laboratory paths under the declared live vault", async (t) => {
  const fixture = await createSyntheticArchive(t, { archiveInsideLiveVault: true });
  const result = await runHarness([
    "-Command", "prepare",
    "-SourceZip", fixture.archivePath,
    "-LaboratoryRoot", join(fixture.root, "laboratory"),
    "-ExpectedSourceSha256", fixture.archiveSha256,
    "-LiveVaultPath", fixture.liveVaultRoot
  ]);

  assert.equal(result.exitCode, 3);
  assert.equal(parseSingleJsonLine(result.stderr).code, "LIVE_VAULT_BLOCKED");
});

async function createSyntheticArchive(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-precutover-red-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceRoot = join(root, "source");
  const liveVaultRoot = join(root, "declared-live-vault");
  await mkdir(join(sourceRoot, "global"), { recursive: true });
  await mkdir(join(sourceRoot, "temas", "tema-sintetico"), { recursive: true });
  await mkdir(liveVaultRoot, { recursive: true });
  await writeFile(join(sourceRoot, "global", "lembranca.md"), "# synthetic L1\n", "utf8");
  await writeFile(join(sourceRoot, "temas", "tema-sintetico", "memoria.md"), "# synthetic L2\n", "utf8");
  const archivePath = options.archiveInsideLiveVault
    ? join(liveVaultRoot, "synthetic-backup.zip")
    : join(root, "synthetic-backup.zip");
  const zip = await runProcess(powershell, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    "Compress-Archive -Path (Join-Path $env:DEX_TEST_ZIP_SOURCE '*') -DestinationPath $env:DEX_TEST_ZIP_DEST -CompressionLevel NoCompression"
  ], {
    ...process.env,
    DEX_TEST_ZIP_SOURCE: sourceRoot,
    DEX_TEST_ZIP_DEST: archivePath
  });
  assert.equal(zip.exitCode, 0, zip.stderr);
  const archiveSha256 = sha256(await readFile(archivePath));
  return { root, sourceRoot, liveVaultRoot, archivePath, archiveSha256 };
}

function runHarness(args) {
  return runProcess(powershell, [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath, ...args
  ], process.env);
}

function runProcess(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode, signal) => resolveRun({
      exitCode,
      signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}

function parseSingleJsonLine(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1, `expected one JSON line, received: ${text}`);
  return JSON.parse(lines[0]);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}
