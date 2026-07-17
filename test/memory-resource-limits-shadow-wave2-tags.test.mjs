import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const runnerPath = join(repoRoot, "scripts", "run-memory-tag-limit-shadow-fixture.js");
const comparatorPath = join(repoRoot, "scripts", "compare-memory-resource-limits-shadow.js");
const generatorPath = join(repoRoot, "scripts", "generate-memory-resource-limit-artifacts.js");
const bundleRoot = join(repoRoot, "contracts", "policies");
const memoryRoot = process.env.DEX_MEMORIA_HOME || join(homedir(), ".agents", "memories");
const validatorPath = join(memoryRoot, ".agents", "tools", "validate-memory-tags.ps1");
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const require = createRequire(import.meta.url);

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: options.env || process.env,
    input: options.input || "",
    encoding: "utf8"
  });
}

function runNode(script, args, options = {}) {
  return run(process.execPath, [script, ...args], options);
}

function runValidator(fixtureRoot) {
  return run(powershell, [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", validatorPath,
    "-ThemePath", join(fixtureRoot, "theme"),
    "-AsJson"
  ]);
}

const powershellProbe = run(powershell, ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.Major"]);
const integrationAvailable = existsSync(validatorPath) && powershellProbe.status === 0;

async function createTagFixture(t, fileCount) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memory-tag-limit-shadow-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const themeRoot = join(fixtureRoot, "theme");
  await mkdir(themeRoot);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "validate-tags",
    disposable: true,
    targets: ["theme"]
  }, null, 2)}\n`);
  await writeFile(join(fixtureRoot, "manifest.json"), `${JSON.stringify({
    contract: "dex.memory.fixture.tag-validation.v1",
    operation: "validate-tags",
    disposable_runs_only: true,
    theme: "theme"
  }, null, 2)}\n`);
  for (let index = 1; index <= fileCount; index += 1) {
    await writeFile(join(themeRoot, `note-${String(index).padStart(3, "0")}.md`), `# Note ${index}\n`);
  }
  return fixtureRoot;
}

async function copyBundle(t) {
  const candidateRoot = await mkdtemp(join(tmpdir(), "dex-memory-tag-limit-bundle-"));
  t.after(() => rm(candidateRoot, { recursive: true, force: true }));
  await cp(bundleRoot, candidateRoot, { recursive: true });
  return candidateRoot;
}

async function snapshot(root, relative = "") {
  const rows = [];
  for (const name of (await readdir(join(root, relative))).sort()) {
    const childRelative = relative ? `${relative}/${name}` : name;
    const childPath = join(root, childRelative);
    const entry = await import("node:fs/promises").then(({ lstat }) => lstat(childPath));
    if (entry.isDirectory()) {
      rows.push(`d:${childRelative}`);
      rows.push(...await snapshot(root, childRelative));
    } else {
      const bytes = await readFile(childPath);
      rows.push(`f:${childRelative}:${createHash("sha256").update(bytes).digest("hex")}`);
    }
  }
  return rows;
}

test("the SHADOW contract owns the tag file-count candidate without activating it", async () => {
  const policy = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"), "utf8"));
  const limit = policy.limits.find(({ limit_id }) => limit_id === "v2.tags.max_files");
  assert.deepEqual(limit, {
    limit_id: "v2.tags.max_files",
    value: 100,
    unit: "files",
    kind: "operational_default",
    scope: "governed-theme-v2 tag validation files per theme",
    profile: "governed-theme-v2",
    owner: "consciencia-memorias",
    source_evidence: {
      source_id: "installed-tag-validator",
      locator: "MaxFiles",
      path: "$DEX_MEMORY_HOME/.agents/tools/validate-memory-tags.ps1",
      line: 10
    }
  });
  assert.equal(policy.authority_state, "SHADOW");
  assert.equal(policy.effective, false);
});

test("help exposes DEFAULT, explicit validator, opt-in and recovery", { skip: !integrationAvailable }, () => {
  const result = runNode(runnerPath, ["--help"]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /DEFAULT.*off/i);
  assert.match(result.stdout, /--validator <validate-memory-tags\.ps1>/);
  assert.match(result.stdout, /--bundle <contracts\/policies>/);
  assert.match(result.stdout, /--receipt <fixture\/receipts\/name\.json>/);
  assert.match(result.stdout, /remove --bundle and --receipt/i);
});

for (const [fileCount, expectedStatus, expectedOk, expectedIssueCount] of [
  [100, 0, true, 0],
  [101, 1, false, 1]
]) {
  test(`DEFAULT preserves the installed validator oracle for ${fileCount} files`, { skip: !integrationAvailable }, async (t) => {
    const fixtureRoot = await createTagFixture(t, fileCount);
    const direct = runValidator(fixtureRoot);
    const before = await snapshot(fixtureRoot);
    const env = { ...process.env, DEX_MEMORY_RESOURCE_LIMITS_SHADOW_BUNDLE: join(fixtureRoot, "must-not-be-read") };
    const probed = runNode(runnerPath, ["--fixture", fixtureRoot, "--validator", validatorPath], { env });

    assert.equal(probed.status, direct.status);
    assert.equal(probed.stdout, direct.stdout);
    assert.equal(probed.stderr, direct.stderr);
    assert.deepEqual(await snapshot(fixtureRoot), before);

    const output = JSON.parse(probed.stdout);
    assert.equal(output.ok, expectedOk);
    assert.equal(output.counts.files, 100);
    const limitIssues = output.issues.filter(({ code }) => code === "too-many-files");
    assert.equal(limitIssues.length, expectedIssueCount);
    if (expectedIssueCount) assert.match(limitIssues[0].message, /MaxFiles=100/);
    assert.equal(probed.status, expectedStatus);
  });
}

test("DEFAULT starts one operation child and zero comparison children", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 100);
  const { runTagLimitProbe } = require(runnerPath);
  let operationCount = 0;
  let comparisonCount = 0;
  const result = runTagLimitProbe(["--fixture", fixtureRoot, "--validator", validatorPath], {
    spawnOperation: (...args) => {
      operationCount += 1;
      return spawnSync(...args);
    },
    spawnComparison: () => {
      comparisonCount += 1;
      throw new Error("comparison child must not start");
    }
  });
  assert.equal(result.operation.status, 0);
  assert.equal(operationCount, 1);
  assert.equal(comparisonCount, 0);
});

test("SHADOW match is separate and leaves the 100-file operation unchanged", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 100);
  const direct = runValidator(fixtureRoot);
  const receiptPath = join(fixtureRoot, "receipts", "tags-match.json");
  const probed = runNode(runnerPath, [
    "--fixture", fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "match");
  assert.equal(receipt.consumer_id, "validate-memory-tags");
  assert.equal(receipt.precedence, "current");
  assert.deepEqual(receipt.comparisons, [{
    limit_id: "v2.tags.max_files",
    unit: "files",
    current_source_id: "installed-tag-validator",
    current_locator: "MaxFiles",
    current_value: 100,
    candidate_value: 100,
    result: "match"
  }]);
});

test("SHADOW mismatch reports 101 while current 100 still rejects the 101st file", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 101);
  const candidateRoot = await copyBundle(t);
  const policyPath = join(candidateRoot, "dex.memory.resource-limits.v1.json");
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  policy.limits.find(({ limit_id }) => limit_id === "v2.tags.max_files").value = 101;
  await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  assert.equal(runNode(generatorPath, ["--bundle", candidateRoot]).status, 0);

  const direct = runValidator(fixtureRoot);
  const receiptPath = join(fixtureRoot, "receipts", "tags-mismatch.json");
  const probed = runNode(runnerPath, [
    "--fixture", fixtureRoot,
    "--validator", validatorPath,
    "--bundle", candidateRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  assert.equal(probed.status, 1);
  const operation = JSON.parse(probed.stdout);
  assert.equal(operation.counts.files, 100);
  assert.equal(operation.issues.filter(({ code }) => code === "too-many-files").length, 1);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "mismatch");
  assert.equal(receipt.comparisons[0].current_value, 100);
  assert.equal(receipt.comparisons[0].candidate_value, 101);
});

test("candidate_invalid is diagnostic and cannot mask the current operation", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 100);
  const direct = runValidator(fixtureRoot);
  const receiptPath = join(fixtureRoot, "receipts", "candidate-invalid.json");
  const probed = runNode(runnerPath, [
    "--fixture", fixtureRoot,
    "--validator", validatorPath,
    "--bundle", join(fixtureRoot, "missing-bundle"),
    "--receipt", receiptPath
  ]);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "candidate_invalid");
  assert.equal(receipt.error_code, "CANDIDATE_INVALID");
});

test("comparison_not_run is explicit after the operation completes", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 100);
  const receiptPath = join(fixtureRoot, "receipts", "not-run.json");
  const { runTagLimitProbe } = require(runnerPath);
  const events = [];
  const result = runTagLimitProbe([
    "--fixture", fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ], {
    spawnOperation: (...args) => {
      events.push("operation-start");
      const childResult = spawnSync(...args);
      events.push("operation-complete");
      return childResult;
    },
    spawnComparison: () => {
      events.push("comparison-start");
      return { error: new Error("synthetic spawn failure"), status: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
  });
  assert.deepEqual(events, ["operation-start", "operation-complete", "comparison-start"]);
  assert.equal(result.operation.status, 0);
  assert.equal(result.comparison.status, "comparison_not_run");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "comparison_not_run");
  assert.equal(receipt.error_code, "COMPARISON_NOT_RUN");
});

test("the comparator requires an explicit current source for the tag consumer", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 100);
  await mkdir(join(fixtureRoot, "receipts"));
  const receiptPath = join(fixtureRoot, "receipts", "missing-source.json");
  const result = runNode(comparatorPath, [
    "--consumer", "validate-memory-tags",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /CURRENT_SOURCE_REQUIRED/);
});

test("an invalid marker blocks the validator before operation spawn", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 1);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["theme"]
  }, null, 2)}\n`);
  const { runTagLimitProbe } = require(runnerPath);
  let operationCount = 0;
  assert.throws(() => runTagLimitProbe(["--fixture", fixtureRoot, "--validator", validatorPath], {
    spawnOperation: () => {
      operationCount += 1;
      return { status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
  }), /fixture manifest is invalid/);
  assert.equal(operationCount, 0);
});

test("receipt destination outside the disposable fixture is ignored by the operation", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 100);
  const outsideRoot = await mkdtemp(join(tmpdir(), "dex-memory-tag-limit-outside-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outsideReceipt = join(outsideRoot, "receipt.json");
  const direct = runValidator(fixtureRoot);
  const probed = runNode(runnerPath, [
    "--fixture", fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot,
    "--receipt", outsideReceipt
  ]);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  await assert.rejects(readFile(outsideReceipt), { code: "ENOENT" });
});

test("a redirected receipts directory cannot write outside the fixture", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 1);
  const outsideRoot = await mkdtemp(join(tmpdir(), "dex-memory-tag-limit-redirect-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  try {
    await symlink(outsideRoot, join(fixtureRoot, "receipts"), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("junction creation is unavailable");
      return;
    }
    throw error;
  }
  const outsideReceipt = join(outsideRoot, "redirected.json");
  const result = runNode(comparatorPath, [
    "--consumer", "validate-memory-tags",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", join(fixtureRoot, "receipts", "redirected.json"),
    "--current-source", validatorPath
  ]);
  assert.equal(result.status, 2);
  await assert.rejects(readFile(outsideReceipt), { code: "ENOENT" });
});

test("half-configured SHADOW arguments fail before running the validator", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 1);
  const result = runNode(runnerPath, [
    "--fixture", fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot
  ]);
  assert.equal(result.status, 2);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /TAG_LIMIT_FIXTURE_USAGE/);
});

test("a redirected theme directory is blocked before the validator can read outside", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 1);
  const outsideRoot = await mkdtemp(join(tmpdir(), "dex-memory-tag-limit-theme-outside-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  await rm(join(fixtureRoot, "theme"), { recursive: true, force: true });
  try {
    await symlink(outsideRoot, join(fixtureRoot, "theme"), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("junction creation is unavailable");
      return;
    }
    throw error;
  }
  const { runTagLimitProbe } = require(runnerPath);
  let operationCount = 0;
  assert.throws(() => runTagLimitProbe(["--fixture", fixtureRoot, "--validator", validatorPath], {
    spawnOperation: () => {
      operationCount += 1;
      return { status: 0, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
    }
  }), /required directory is invalid|fixture theme boundary is invalid/);
  assert.equal(operationCount, 0);
});

test("the tag comparator rejects a missing receipt argument before filesystem work", { skip: !integrationAvailable }, async (t) => {
  const fixtureRoot = await createTagFixture(t, 1);
  const result = runNode(comparatorPath, [
    "--consumer", "validate-memory-tags",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--current-source", validatorPath
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /INVALID_USAGE/);
});
