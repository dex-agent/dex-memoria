import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const runnerPath = join(repoRoot, "scripts", "run-memory-v2-create-recall-fixture.js");
const fixturesRoot = join(testRoot, "fixtures");
const integrationEnabled = process.env.DEX_MEMORY_V2_INTEGRATION === "1";
const syntheticTheme = "dex-precutover-synthetic";

function normalizedPath(value) {
  const normalized = resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function pathsOverlap(first, second) {
  const firstPath = normalizedPath(first);
  const secondPath = normalizedPath(second);
  return firstPath === secondPath || firstPath.startsWith(`${secondPath}${sep}`) || secondPath.startsWith(`${firstPath}${sep}`);
}

async function assertPlainDirectory(directoryPath, label) {
  const stat = await lstat(directoryPath);
  assert.equal(stat.isDirectory(), true, `${label} must be a directory`);
  assert.equal(stat.isSymbolicLink(), false, `${label} must not be a symbolic link`);
  assert.equal(normalizedPath(await realpath(directoryPath)), normalizedPath(directoryPath), `${label} must not cross a reparse point`);
}

async function validateIntegrationBoundary(laboratoryRoot, cloneBaselineRoot, liveVaultPath, privateReceiptPath) {
  assert.equal(resolve(cloneBaselineRoot), join(resolve(laboratoryRoot), "baseline"), "clone baseline must be the governed laboratory baseline");
  await Promise.all([
    assertPlainDirectory(laboratoryRoot, "laboratory root"),
    assertPlainDirectory(cloneBaselineRoot, "clone baseline root"),
    assertPlainDirectory(liveVaultPath, "live vault deny path"),
    assertPlainDirectory(join(laboratoryRoot, "private"), "laboratory private root")
  ]);
  const marker = JSON.parse(await readFile(join(laboratoryRoot, "lab-marker.json"), "utf8"));
  assert.equal(marker.contract, "dex.memory.precutover.clone.v0");
  assert.equal(marker.disposable, true);
  assert.equal(marker.live_vault_touched, false);
  const prohibitedRoots = [
    repoRoot,
    liveVaultPath,
    join(homedir(), ".agents", "memories"),
    join(homedir(), ".dex-agent"),
    process.env.DEX_MEMORIA_HOME
  ].filter(Boolean);
  assert.equal(prohibitedRoots.some((root) => pathsOverlap(laboratoryRoot, root)), false, "laboratory overlaps a prohibited root");
  if (privateReceiptPath) {
    assert.equal(dirname(resolve(privateReceiptPath)), resolve(laboratoryRoot, "private"), "raw receipt must stay directly under the laboratory private root");
    await assert.rejects(access(privateReceiptPath), { code: "ENOENT" });
  }
}

const requests = {
  L2: {
    contract: "dex.memory.create.theme-v2.request.v0",
    profile: "governed-theme-v2",
    operation: "create",
    idempotency_key: "fixture:integrated-create-recall:l2:001",
    identity: "11111111-1111-4111-8111-111111111111",
    target_layer: "L2",
    route_decision: "explicit-l2-memory",
    slug: "mapa-visual-v2",
    trigger: "Quando o mapa visual V2 falhar?",
    title: "Mapa visual V2",
    body: "Memória operacional curta.",
    created_at: "2026-07-16T12:00:00.000Z"
  },
  L3: {
    contract: "dex.memory.create.theme-v2.request.v0",
    profile: "governed-theme-v2",
    operation: "create",
    idempotency_key: "fixture:integrated-create-recall:l3:001",
    identity: "22222222-2222-4222-8222-222222222222",
    target_layer: "L3",
    route_decision: "explicit-l3-knowledge",
    slug: "journal-recuperavel",
    trigger: "E SE o journal falhar?",
    title: "Journal recuperável",
    body: "Conhecimento profundo com referências e artefatos sob demanda.",
    owner_skill: "dex-memoria",
    created_at: "2026-07-16T12:00:00.000Z"
  }
};

function runRunner(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [runnerPath, ...args], {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode, signal) => resolveRun({
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      exitCode,
      signal
    }));
  });
}

async function createFixture(t, layer, probe, laboratoryRoot, cloneBaselineRoot) {
  const fixtureRoot = await mkdtemp(join(laboratoryRoot, `dex-memory-v2-integrated-${layer.toLowerCase()}-${probe}-`));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));

  const sourceRoot = join(fixturesRoot, `governed-theme-v2-plan-${layer.toLowerCase()}`);
  await cp(cloneBaselineRoot, join(fixtureRoot, "work"), { recursive: true });
  await cp(join(sourceRoot, "baseline", "tema-exemplo"), join(fixtureRoot, "work", syntheticTheme), { recursive: true });
  const manifest = JSON.parse(await readFile(join(sourceRoot, "manifest.json"), "utf8"));
  await writeFile(join(fixtureRoot, "manifest.json"), `${JSON.stringify({
    ...manifest,
    contract: "dex.memory.fixture.governed-theme-v2-transaction.v0",
    theme: syntheticTheme
  }, null, 2)}\n`);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: [`work/${syntheticTheme}`]
  }, null, 2)}\n`);

  const requestPath = join(fixtureRoot, "create-request.json");
  await writeFile(requestPath, `${JSON.stringify(requests[layer], null, 2)}\n`);
  return { fixtureRoot, requestPath };
}

async function treeSha256(root) {
  const rows = [];
  async function visit(relative = "") {
    const directory = relative ? join(root, ...relative.split("/")) : root;
    for (const name of (await readdir(directory)).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      const childPath = join(root, ...childRelative.split("/"));
      const stat = await lstat(childPath);
      if (stat.isDirectory()) {
        rows.push(`d:${childRelative}`);
        await visit(childRelative);
      } else {
        rows.push(`f:${childRelative}:${sha256(await readFile(childPath))}`);
      }
    }
  }
  await visit();
  return sha256(Buffer.from(rows.join("\n")));
}

async function assertBaselineSubsetUnchanged(baselineRoot, candidateRoot) {
  async function visit(relative = "") {
    const baselineDirectory = relative ? join(baselineRoot, ...relative.split("/")) : baselineRoot;
    for (const name of (await readdir(baselineDirectory)).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      const baselinePath = join(baselineRoot, ...childRelative.split("/"));
      const candidatePath = join(candidateRoot, ...childRelative.split("/"));
      const baselineStat = await lstat(baselinePath);
      const candidateStat = await lstat(candidatePath);
      assert.equal(candidateStat.isDirectory(), baselineStat.isDirectory(), "baseline entry type changed; inspect private laboratory diagnostics");
      if (baselineStat.isDirectory()) {
        await visit(childRelative);
      } else {
        assert.equal(sha256(await readFile(candidatePath)), sha256(await readFile(baselinePath)), "baseline file changed; inspect private laboratory diagnostics");
      }
    }
  }
  await visit();
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function assertFixtureReceipt(receipt, expectedLayer, fixtures, recoveryBaselineSha256) {
  const expected = requests[expectedLayer];
  assert.equal(receipt.target_layer, expectedLayer);
  assert.equal(receipt.identity, expected.identity);
  assert.equal(receipt.slug, expected.slug);

  const commit = receipt.commit_probe;
  assert.equal(commit.plan_first_sha256, commit.plan_second_sha256);
  assert.equal(commit.before_tree_sha256, commit.after_plan_tree_sha256);
  assert.equal(commit.apply_receipt.contract, "dex.memory.create.theme-v2.receipt.v0");
  assert.equal(commit.apply_receipt.status, "COMMITTED");
  assert.equal(commit.retry_receipt.contract, "dex.memory.create.theme-v2.receipt.v0");
  assert.equal(commit.retry_receipt.status, "ALREADY_COMMITTED");
  assert.equal(commit.drift_error.contract, "dex.memory.error.v0");
  assert.equal(commit.drift_error.code, "PLAN_CONFLICT");
  assert.equal(commit.routes_receipt.contract, "dex.memory.routes.inspect.v0");
    assert.equal(commit.routes_receipt.profile, "governed-theme-v2");
  assert.equal(commit.routes_receipt.status, "VALID");
  assert.equal(commit.links_receipt.profile, "governed-theme-v2");
  assert.equal(commit.links_receipt.ok, true);
  assert.equal(commit.links_receipt.require_obsidian, false);
  assert.equal(commit.links_receipt.errors.length, 0);
  assert.equal(commit.links_receipt.safety_stop, false);
  assert.deepEqual(commit.recall_receipts.map((entry) => entry.form), [
    "trigger",
    "slug",
    "natural_phrase"
  ]);
  for (const recall of commit.recall_receipts) {
    assert.equal(recall.receipt.schema, "dex.memory.recall.v1");
    assert.equal(recall.receipt.status, "ok");
    assert.equal(recall.receipt.scope.theme, syntheticTheme);
    assert.equal(recall.receipt.scope.layer, expectedLayer);
    assert.equal(recall.receipt.errors.length, 0);
    assert.equal(recall.layer, expectedLayer);
    assert.equal(recall.relative_path, commit.destination_relative_path);
  }
  assert.equal(await treeSha256(join(fixtures.commit.fixtureRoot, "work")), commit.after_apply_tree_sha256);
  const destination = join(
    fixtures.commit.fixtureRoot,
    ...commit.destination_relative_path.split("/")
  );
  assert.equal(sha256(await readFile(destination)), commit.destination_sha256);

  const recovery = receipt.crash_recovery_probe;
  assert.equal(Number.isInteger(recovery.killed_pid), true);
  assert.equal(Number.isInteger(recovery.recovery_pid), true);
  assert.notEqual(recovery.killed_pid, recovery.recovery_pid);
  assert.equal(recovery.recovery_receipt.contract, "dex.memory.create.theme-v2.receipt.v0");
  assert.equal(recovery.recovery_receipt.status, "ROLLED_BACK");
  assert.equal(recovery.baseline_tree_sha256, recoveryBaselineSha256);
  assert.equal(recovery.restored_tree_sha256, recoveryBaselineSha256);
  assert.equal(await treeSha256(join(fixtures.recovery.fixtureRoot, "work")), recoveryBaselineSha256);

  if (expectedLayer === "L3") {
    assert.equal(receipt.owner_skill, "dex-memoria");
    await assert.rejects(
      access(join(fixtures.commit.fixtureRoot, "work", syntheticTheme, "memorias", `${expected.slug}.md`))
    );
  }
}

test("fixture-only runner emits one integrated receipt for L2 and direct L3 create plus recall", {
  skip: integrationEnabled ? false : "set DEX_MEMORY_V2_INTEGRATION=1 to run the local fixture integration"
}, async (t) => {
  const linkValidator = process.env.DEX_MEMORY_V2_LINK_VALIDATOR;
  const finder = process.env.DEX_MEMORY_V2_FINDER;
  const baselineFinder = process.env.DEX_MEMORY_V2_BASELINE_FINDER;
  assert.ok(linkValidator, "DEX_MEMORY_V2_LINK_VALIDATOR is required");
  assert.ok(finder, "DEX_MEMORY_V2_FINDER is required");
  assert.ok(baselineFinder, "DEX_MEMORY_V2_BASELINE_FINDER is required");
  const laboratoryRoot = process.env.DEX_MEMORY_V2_LAB_ROOT;
  const cloneBaselineRoot = process.env.DEX_MEMORY_V2_CLONE_BASELINE_ROOT;
  const liveVaultPath = process.env.DEX_MEMORY_V2_LIVE_VAULT_PATH;
  assert.ok(laboratoryRoot, "DEX_MEMORY_V2_LAB_ROOT is required");
  assert.ok(cloneBaselineRoot, "DEX_MEMORY_V2_CLONE_BASELINE_ROOT is required");
  assert.ok(liveVaultPath, "DEX_MEMORY_V2_LIVE_VAULT_PATH is required");
  await validateIntegrationBoundary(
    laboratoryRoot,
    cloneBaselineRoot,
    liveVaultPath,
    process.env.DEX_MEMORY_V2_PRIVATE_RECEIPT_PATH
  );
  await Promise.all([access(linkValidator), access(finder), access(baselineFinder)]);
  await assert.rejects(access(join(cloneBaselineRoot, syntheticTheme)), { code: "ENOENT" });
  const runsRoot = join(laboratoryRoot, "runs");
  await mkdir(runsRoot, { recursive: true });
  const legacyFixtureRoot = join(runsRoot, "legacy-v1-probe");

  const fixtures = {
    L2: {
      commit: await createFixture(t, "L2", "commit", runsRoot, cloneBaselineRoot),
      recovery: await createFixture(t, "L2", "recovery", runsRoot, cloneBaselineRoot)
    },
    L3: {
      commit: await createFixture(t, "L3", "commit", runsRoot, cloneBaselineRoot),
      recovery: await createFixture(t, "L3", "recovery", runsRoot, cloneBaselineRoot)
    }
  };
  const recoveryBaselines = {
    L2: await treeSha256(join(fixtures.L2.recovery.fixtureRoot, "work")),
    L3: await treeSha256(join(fixtures.L3.recovery.fixtureRoot, "work"))
  };
  const result = await runRunner([
    "--commit-fixture-l2", fixtures.L2.commit.fixtureRoot,
    "--recovery-fixture-l2", fixtures.L2.recovery.fixtureRoot,
    "--request-l2", fixtures.L2.commit.requestPath,
    "--commit-fixture-l3", fixtures.L3.commit.fixtureRoot,
    "--recovery-fixture-l3", fixtures.L3.recovery.fixtureRoot,
    "--request-l3", fixtures.L3.commit.requestPath,
    "--link-validator", linkValidator,
    "--finder", finder,
    "--baseline-finder", baselineFinder,
    "--legacy-fixture-root", legacyFixtureRoot,
    "--laboratory-root", laboratoryRoot,
    "--live-vault-path", liveVaultPath
  ]);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, 1, "runner must emit exactly one JSON receipt line");

  const receipt = JSON.parse(lines[0]);
  if (process.env.DEX_MEMORY_V2_PRIVATE_RECEIPT_PATH) {
    const privateRoot = resolve(laboratoryRoot, "private");
    const privateReceiptPath = resolve(process.env.DEX_MEMORY_V2_PRIVATE_RECEIPT_PATH);
    assert.equal(await realpath(privateRoot), privateRoot, "laboratory private root must not cross a reparse point");
    assert.equal(dirname(privateReceiptPath), privateRoot, "raw receipt must stay directly under the laboratory private root");
    await writeFile(privateReceiptPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  }
  assert.equal(receipt.contract, "dex.memory.create-recall.fixture-receipt.v0");
  assert.equal(receipt.profile, "governed-theme-v2");
  assert.equal(receipt.authority, "fixture_only_experimental");
  assert.equal(receipt.status, "PASS");
  assert.equal(receipt.active_write_profile, "legacy-v1");
  assert.equal(receipt.legacy_v1_probe.contract, "dex.memory.recall.v1");
  assert.equal(receipt.legacy_v1_probe.no_shrink, true);
  assert.equal(receipt.legacy_v1_probe.query_count, 3);
  assert.deepEqual(receipt.legacy_v1_probe.query_forms, ["localizer", "natural_phrase", "tag"]);
  assert.equal(receipt.legacy_v1_probe.replay_count, 3);
  assert.deepEqual(receipt.legacy_v1_probe.replay_phases, ["pre_write", "post_l2", "post_recovery"]);
  assert.equal(receipt.legacy_v1_probe.result_count >= 2, true);
  assert.deepEqual(receipt.legacy_v1_probe.result_layers, ["L1", "L2"]);
  assert.equal(receipt.legacy_v1_probe.result_paths.some((entry) => /lembranca\.md$/i.test(entry)), true);
  assert.equal(receipt.legacy_v1_probe.result_paths.some((entry) => /memoria\.md$/i.test(entry)), true);
  assert.equal(receipt.fixtures.length, 2);
  await assertFixtureReceipt(receipt.fixtures[0], "L2", fixtures.L2, recoveryBaselines.L2);
  await assertFixtureReceipt(receipt.fixtures[1], "L3", fixtures.L3, recoveryBaselines.L3);
  await assertBaselineSubsetUnchanged(cloneBaselineRoot, join(fixtures.L2.commit.fixtureRoot, "work"));
  await assertBaselineSubsetUnchanged(cloneBaselineRoot, join(fixtures.L3.commit.fixtureRoot, "work"));
});
