import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const harnessPath = join(repoRoot, "scripts", "run-memory-resource-limits-shadow-fixture.js");
const comparatorPath = join(repoRoot, "scripts", "compare-memory-resource-limits-shadow.js");
const bundleRoot = join(repoRoot, "contracts", "policies");
const generatorPath = join(repoRoot, "scripts", "generate-memory-resource-limit-artifacts.js");
const fixtureSource = join(testRoot, "fixtures", "governed-theme-v2-plan-l2");
const require = createRequire(import.meta.url);

const request = {
  contract: "dex.memory.create.theme-v2.request.v0",
  profile: "governed-theme-v2",
  operation: "create",
  idempotency_key: "fixture:shadow-wave1:l2:001",
  identity: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  target_layer: "L2",
  route_decision: "explicit-l2-memory",
  slug: "limites-shadow",
  trigger: "Quando comparar limites em SHADOW?",
  title: "Limites SHADOW",
  body: "Memoria operacional curta.",
  created_at: "2026-07-15T12:00:00.000Z"
};

function runNode(script, args, input = "", env = process.env) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    env,
    input,
    encoding: "utf8"
  });
}

async function createFixture(t) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memory-shadow-wave1-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await cp(join(fixtureSource, "baseline"), join(fixtureRoot, "work"), { recursive: true });
  await cp(join(fixtureSource, "manifest.json"), join(fixtureRoot, "manifest.json"));
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/tema-exemplo"]
  }, null, 2)}\n`);
  return fixtureRoot;
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

async function copyBundle(t) {
  const candidateRoot = await mkdtemp(join(tmpdir(), "dex-memory-shadow-bundle-"));
  t.after(() => rm(candidateRoot, { recursive: true, force: true }));
  await cp(bundleRoot, candidateRoot, { recursive: true });
  return candidateRoot;
}

test("Wave 1 help makes DEFAULT, explicit opt-in and recovery discoverable", () => {
  const result = runNode(harnessPath, ["--help"]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /DEFAULT.*off/i);
  assert.match(result.stdout, /--bundle <contracts\/policies>/);
  assert.match(result.stdout, /--receipt <fixture\/receipts\/name\.json>/);
  assert.match(result.stdout, /remove --bundle and --receipt/i);
  assert.match(result.stdout, /dex-memoria\.cli/);
  assert.match(result.stdout, /dex-memoria\.route-inspector/);
});

test("DEFAULT is byte-identical and never starts or reads the candidate", async (t) => {
  const fixtureRoot = await createFixture(t);
  const input = `${JSON.stringify(request)}\n`;
  const direct = runNode(cliPath, ["create", "plan", "--fixture", fixtureRoot], input);
  const before = await snapshot(fixtureRoot);
  const sentinel = join(fixtureRoot, "candidate-must-not-be-read");
  const env = { ...process.env, DEX_MEMORY_RESOURCE_LIMITS_SHADOW_BUNDLE: sentinel };
  const probed = runNode(harnessPath, ["--consumer", "dex-memoria.cli", "--fixture", fixtureRoot], input, env);

  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  assert.deepEqual(await snapshot(fixtureRoot), before);

  const { runFixtureProbe } = require(harnessPath);
  let operationCount = 0;
  let comparisonCount = 0;
  runFixtureProbe(
    ["--consumer", "dex-memoria.cli", "--fixture", fixtureRoot],
    Buffer.from(input),
    {
      spawnOperation: (...args) => {
        operationCount += 1;
        return spawnSync(...args);
      },
      spawnComparison: () => {
        comparisonCount += 1;
        throw new Error("comparison child must not start");
      }
    }
  );
  assert.equal(operationCount, 1);
  assert.equal(comparisonCount, 0);
});

test("SHADOW runs operation first and writes a separate match receipt for CLI", async (t) => {
  const fixtureRoot = await createFixture(t);
  const input = `${JSON.stringify(request)}\n`;
  const direct = runNode(cliPath, ["create", "plan", "--fixture", fixtureRoot], input);
  const receiptPath = join(fixtureRoot, "receipts", "cli-match.json");
  const probed = runNode(harnessPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ], input);

  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "match");
  assert.equal(receipt.consumer_id, "dex-memoria.cli");
  assert.equal(receipt.precedence, "current");
  assert.equal(receipt.candidate_fallback, "none");
  assert.deepEqual(receipt.comparisons.map(({ limit_id }) => limit_id), ["cli.stdin.max_bytes"]);
  assert.ok(receipt.comparisons.every(({ result }) => result === "match"));
});

test("SHADOW compares both route inspector limits without changing its output", async (t) => {
  const fixtureRoot = await createFixture(t);
  const direct = runNode(cliPath, ["routes", "inspect", "--fixture", fixtureRoot]);
  const receiptPath = join(fixtureRoot, "receipts", "routes-match.json");
  const probed = runNode(harnessPath, [
    "--consumer", "dex-memoria.route-inspector",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ]);

  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "match");
  assert.deepEqual(receipt.comparisons.map(({ limit_id }) => limit_id), [
    "v2.routes.document.max_bytes",
    "v2.routes.max_entries"
  ]);
});

test("a valid candidate mismatch is diagnostic and current still wins", async (t) => {
  const fixtureRoot = await createFixture(t);
  const candidateRoot = await copyBundle(t);
  const policyPath = join(candidateRoot, "dex.memory.resource-limits.v1.json");
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  policy.limits.find(({ limit_id }) => limit_id === "cli.stdin.max_bytes").value -= 1;
  await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  assert.equal(runNode(generatorPath, ["--bundle", candidateRoot]).status, 0);

  const input = `${JSON.stringify(request)}\n`;
  const direct = runNode(cliPath, ["create", "plan", "--fixture", fixtureRoot], input);
  const receiptPath = join(fixtureRoot, "receipts", "cli-mismatch.json");
  const probed = runNode(harnessPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", candidateRoot,
    "--receipt", receiptPath
  ], input);

  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "mismatch");
  assert.equal(receipt.comparisons[0].result, "mismatch");
});

test("candidate_invalid never masks an operation error", async (t) => {
  const fixtureRoot = await createFixture(t);
  const invalidInput = "{\n";
  const direct = runNode(cliPath, ["create", "plan", "--fixture", fixtureRoot], invalidInput);
  const receiptPath = join(fixtureRoot, "receipts", "candidate-invalid.json");
  const probed = runNode(harnessPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", join(fixtureRoot, "missing-bundle"),
    "--receipt", receiptPath
  ], invalidInput);

  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "candidate_invalid");
  assert.equal(receipt.stage, "candidate_validation");
  assert.equal(receipt.error_code, "CANDIDATE_INVALID");
  assert.equal(JSON.stringify(receipt).includes(fixtureRoot), false);
  assert.equal(JSON.stringify(receipt).includes("stack"), false);
});

test("a valid bundle missing the required consumer ID is candidate_invalid", async (t) => {
  const fixtureRoot = await createFixture(t);
  const candidateRoot = await copyBundle(t);
  const policyPath = join(candidateRoot, "dex.memory.resource-limits.v1.json");
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  policy.limits = policy.limits.filter(({ limit_id }) => limit_id !== "cli.stdin.max_bytes");
  await writeFile(policyPath, `${JSON.stringify(policy, null, 2)}\n`);
  assert.equal(runNode(generatorPath, ["--bundle", candidateRoot]).status, 0);
  const receiptPath = join(fixtureRoot, "receipts", "missing-id.json");
  const result = runNode(comparatorPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", candidateRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(await readFile(receiptPath, "utf8")).status, "candidate_invalid");
});

test("receipt destination is confined to the disposable fixture", async (t) => {
  const fixtureRoot = await createFixture(t);
  const outsideRoot = await mkdtemp(join(tmpdir(), "dex-memory-shadow-outside-"));
  t.after(() => rm(outsideRoot, { recursive: true, force: true }));
  const outsideReceipt = join(outsideRoot, "receipt.json");
  const input = `${JSON.stringify(request)}\n`;
  const direct = runNode(cliPath, ["create", "plan", "--fixture", fixtureRoot], input);
  const probed = runNode(harnessPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", outsideReceipt
  ], input);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  await assert.rejects(readFile(outsideReceipt), { code: "ENOENT" });
});

test("a redirected receipts directory is blocked before external write", async (t) => {
  const fixtureRoot = await createFixture(t);
  const outsideRoot = await mkdtemp(join(tmpdir(), "dex-memory-shadow-redirect-"));
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
  const result = runNode(comparatorPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", join(fixtureRoot, "receipts", "redirected.json")
  ]);
  assert.equal(result.status, 2);
  await assert.rejects(readFile(join(outsideRoot, "redirected.json")), { code: "ENOENT" });
});

test("comparison_not_run is explicit when the second child cannot start", async (t) => {
  const fixtureRoot = await createFixture(t);
  const receiptPath = join(fixtureRoot, "receipts", "not-run.json");
  const input = Buffer.from(`${JSON.stringify(request)}\n`);
  const { runFixtureProbe } = require(harnessPath);
  const events = [];
  const result = runFixtureProbe([
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ], input, {
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

test("unknown consumers and half-configured opt-in fail before operation", async (t) => {
  const fixtureRoot = await createFixture(t);
  for (const args of [
    ["--consumer", "arbitrary.command", "--fixture", fixtureRoot],
    ["--consumer", "dex-memoria.cli", "--fixture", fixtureRoot, "--bundle", bundleRoot]
  ]) {
    const result = runNode(harnessPath, args, `${JSON.stringify(request)}\n`);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /SHADOW_FIXTURE_USAGE/);
  }
});

test("the comparison child is a separate explicit CLI", async (t) => {
  const fixtureRoot = await createFixture(t);
  await mkdir(join(fixtureRoot, "receipts"));
  const receiptPath = join(fixtureRoot, "receipts", "direct-comparator.json");
  const result = runNode(comparatorPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(await readFile(receiptPath, "utf8")).status, "match");

  const firstBytes = await readFile(receiptPath);
  const repeated = runNode(comparatorPath, [
    "--consumer", "dex-memoria.cli",
    "--fixture", fixtureRoot,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(repeated.status, 0);
  assert.deepEqual(await readFile(receiptPath), firstBytes);
});
