import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const runnerPath = join(repoRoot, "scripts", "run-memory-link-line-limit-shadow-fixture.js");
const comparatorPath = join(repoRoot, "scripts", "compare-memory-resource-limits-shadow.js");
const bundleRoot = join(repoRoot, "contracts", "policies");
const generatorPath = join(repoRoot, "scripts", "generate-memory-resource-limit-artifacts.js");
const memoryRoot = process.env.DEX_MEMORIA_HOME || join(homedir(), ".agents", "memories");
const laboratoryRoot = join(dirname(memoryRoot), "laboratorio-memories");
const validatorPath = join(memoryRoot, ".agents", "tools", "validate-memory-links.ps1");
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

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function assertSafeFixtureRoot(fixtureRoot) {
  const laboratory = resolve(laboratoryRoot);
  const fixture = resolve(fixtureRoot);
  assert.equal(realpathSync(laboratory), laboratory);
  assert.equal(realpathSync(fixture), fixture);
  assert.equal(lstatSync(laboratory).isSymbolicLink(), false);
  assert.equal(lstatSync(fixture).isSymbolicLink(), false);
  const fromLaboratory = relative(laboratory, fixture);
  assert.ok(fromLaboratory && fromLaboratory !== ".." && !fromLaboratory.startsWith(`..${sep}`) && !resolve(fromLaboratory).startsWith(sep));
}

async function createLinkFixture(t, lineCount) {
  const fixtureRoot = await mkdtemp(join(laboratoryRoot, "dex-memory-link-line-limit-"));
  assertSafeFixtureRoot(fixtureRoot);
  t.after(async () => {
    assertSafeFixtureRoot(fixtureRoot);
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  const theme = `tema-linhas-${lineCount}`;
  const themeRoot = join(fixtureRoot, "work", theme);
  const memoriesRoot = join(themeRoot, "memorias");
  const knowledgeRoot = join(themeRoot, "conhecimento");
  const slug = "memoria-operacional";
  const identity = "51515151-5151-4515-8515-515151515151";
  const updatedAt = "2026-07-15T12:30:00.000Z";
  const trigger = "Quando validar a fronteira sintetica de linhas?";
  const destinationRelativePath = `work/${theme}/memorias/${slug}.md`;
  const indexRelativePath = `work/${theme}/memorias/INDEX.md`;
  const destinationPath = join(memoriesRoot, `${slug}.md`);
  const routesReceiptPath = join(fixtureRoot, "routes-inspect-receipt.json");
  await mkdir(memoriesRoot, { recursive: true });
  await mkdir(knowledgeRoot, { recursive: true });

  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), jsonText({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: [`work/${theme}`]
  }), "utf8");
  await writeFile(join(fixtureRoot, "manifest.json"), jsonText({
    contract: "dex.memory.fixture.governed-theme-v2-transaction.v0",
    disposable_runs_only: true,
    operation: "create",
    profile: "governed-theme-v2",
    target_layer: "L2",
    theme
  }), "utf8");
  await writeFile(join(themeRoot, "lembranca.md"), [
    "# Lembrancas",
    "",
    `- [${trigger}](memorias/${slug}.md) <!-- dex.memory.route.v1 {\"identity\":\"${identity}\",\"last_reused_at\":null,\"layer\":\"L2\",\"reuse_count\":0,\"slug\":\"${slug}\",\"updated_at\":\"${updatedAt}\"} -->`
  ].join("\n"), "utf8");
  await writeFile(join(memoriesRoot, "INDEX.md"), [
    "# Memorias",
    "",
    `- [Memoria operacional](${slug}.md) <!-- dex.memory.index-entry.v1 {\"identity\":\"${identity}\",\"layer\":\"L2\",\"slug\":\"${slug}\"} -->`
  ].join("\n"), "utf8");
  await writeFile(join(knowledgeRoot, "INDEX.md"), "# Conhecimento", "utf8");

  const destinationLines = [
    "---",
    "dex_memory: governed-theme-v2",
    "contract_version: 1",
    `identity: ${identity}`,
    "layer: L2",
    `slug: ${slug}`,
    `created_at: ${updatedAt}`,
    `updated_at: ${updatedAt}`,
    "last_reused_at: null",
    "reuse_count: 0",
    "---",
    "",
    "# Memoria operacional",
    "",
    "Conteudo sintetico descartavel para validar somente a fronteira de linhas.",
    ""
  ];
  while (destinationLines.length < lineCount - 1) {
    destinationLines.push(`Linha sintetica ${destinationLines.length + 1}.`);
  }
  destinationLines.push("L1 relacionada: [../lembranca.md](../lembranca.md)");
  assert.equal(destinationLines.length, lineCount);
  const destinationText = destinationLines.join("\n");
  assert.equal(destinationText.split(/\r\n|\n|\r/).length, lineCount);
  assert.equal(destinationText.endsWith("\n"), false);
  await writeFile(destinationPath, destinationText, "utf8");

  await writeFile(routesReceiptPath, jsonText({
    contract: "dex.memory.routes.inspect.v0",
    profile: "governed-theme-v2",
    status: "VALID",
    theme,
    routes: [{
      identity,
      layer: "L2",
      slug,
      title: "Memoria operacional",
      trigger,
      destination_relative_path: destinationRelativePath,
      index_relative_path: indexRelativePath,
      content_sha256: sha256(destinationText),
      updated_at: updatedAt,
      last_reused_at: null,
      reuse_count: 0
    }],
    counts: { routes: 1, l1_routes: 1, index_entries: 1, destinations: 1, l2: 1, l3: 0 }
  }), "utf8");

  return { fixtureRoot, themeRoot, routesReceiptPath, destinationPath };
}

function runValidator(fixture) {
  const validatorEnv = { ...process.env };
  if (process.platform === "win32") delete validatorEnv.PSModulePath;
  return run(powershell, [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", validatorPath,
    "-ThemePath", fixture.themeRoot,
    "-MemoryProfile", "governed-theme-v2",
    "-FixtureRoot", fixture.fixtureRoot,
    "-RoutesReceiptPath", fixture.routesReceiptPath,
    "-AsJson"
  ], { env: validatorEnv });
}

async function createCandidateBundle(fixtureRoot, maxLines) {
  const candidateRoot = join(fixtureRoot, `candidate-policies-${maxLines}`);
  await cp(bundleRoot, candidateRoot, { recursive: true });
  const policyPath = join(candidateRoot, "dex.memory.resource-limits.v1.json");
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  policy.limits.find(({ limit_id }) => limit_id === "v2.document.max_lines").value = maxLines;
  await writeFile(policyPath, jsonText(policy), "utf8");
  const generated = runNode(generatorPath, ["--bundle", candidateRoot]);
  assert.equal(generated.status, 0, generated.stderr);
  return candidateRoot;
}

async function snapshotTree(root, relativePath = "") {
  const rows = [];
  for (const name of (await readdir(join(root, relativePath))).sort()) {
    const childRelative = relativePath ? `${relativePath}/${name}` : name;
    const childPath = join(root, childRelative);
    const stat = lstatSync(childPath);
    if (stat.isDirectory()) {
      rows.push(`d:${childRelative}`);
      rows.push(...await snapshotTree(root, childRelative));
    } else {
      rows.push(`f:${childRelative}:${sha256(await readFile(childPath, "utf8"))}`);
    }
  }
  return rows;
}

const powershellProbe = run(powershell, ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion.Major"]);
const integrationAvailable = existsSync(validatorPath) && existsSync(laboratoryRoot) && powershellProbe.status === 0;

test("the SHADOW contract owns the link line-count candidate without activating it", async () => {
  const policy = JSON.parse(await readFile(join(bundleRoot, "dex.memory.resource-limits.v1.json"), "utf8"));
  const limit = policy.limits.find(({ limit_id }) => limit_id === "v2.document.max_lines");
  assert.equal(limit.value, 5000);
  assert.equal(limit.unit, "lines");
  assert.equal(limit.owner, "validate-memory-links");
  assert.equal(limit.source_evidence.locator, "MaxLines");
  assert.equal(policy.authority_state, "SHADOW");
  assert.equal(policy.effective, false);
});

test("help exposes DEFAULT, explicit validator, opt-in and recovery", { skip: !integrationAvailable }, () => {
  const result = runNode(runnerPath, ["--help"]);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /DEFAULT.*off/i);
  assert.match(result.stdout, /--validator <validate-memory-links\.ps1>/);
  assert.match(result.stdout, /--bundle <contracts\/policies>/);
  assert.match(result.stdout, /remove --bundle and --receipt/i);
});

test("DEFAULT preserves the installed validator boundary at exactly 5000/5001 lines", { skip: !integrationAvailable }, async (t) => {
  for (const [lineCount, expectedDirectStatus] of [[5000, 0], [5001, 3]]) {
    const fixture = await createLinkFixture(t, lineCount);
    assert.equal((await readFile(fixture.destinationPath, "utf8")).split(/\r\n|\n|\r/).length, lineCount);
    const direct = runValidator(fixture);
    assert.equal(direct.status, expectedDirectStatus, direct.stdout || direct.stderr);
    if (lineCount === 5001) assert.match(`${direct.stdout}\n${direct.stderr}`, /MaxLines=5000/);

    const env = { ...process.env, DEX_MEMORY_RESOURCE_LIMITS_SHADOW_BUNDLE: join(fixture.fixtureRoot, "must-not-be-read") };
    const probed = runNode(runnerPath, ["--fixture", fixture.fixtureRoot, "--validator", validatorPath], { env });
    assert.equal(probed.status, direct.status);
    assert.equal(probed.stdout, direct.stdout);
    assert.equal(probed.stderr, direct.stderr);
  }
});

test("SHADOW candidate 5000 matches after the current 5000-line operation", { skip: !integrationAvailable }, async (t) => {
  const fixture = await createLinkFixture(t, 5000);
  const direct = runValidator(fixture);
  const receiptPath = join(fixture.fixtureRoot, "receipts", "lines-match.json");
  const probed = runNode(runnerPath, [
    "--fixture", fixture.fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "match");
  assert.equal(receipt.consumer_id, "validate-memory-links");
  assert.equal(receipt.precedence, "current");
  assert.deepEqual(receipt.comparisons, [{
    limit_id: "v2.document.max_lines",
    unit: "lines",
    current_source_id: "installed-link-validator",
    current_locator: "MaxLines",
    current_value: 5000,
    candidate_value: 5000,
    result: "match"
  }]);
});

test("SHADOW candidate 5001 mismatches while the current 5001-line operation still fails unchanged", { skip: !integrationAvailable }, async (t) => {
  const fixture = await createLinkFixture(t, 5001);
  const candidateRoot = await createCandidateBundle(fixture.fixtureRoot, 5001);
  const direct = runValidator(fixture);
  const themeBefore = await snapshotTree(fixture.themeRoot);
  const receiptPath = join(fixture.fixtureRoot, "receipts", "lines-mismatch.json");
  const probed = runNode(runnerPath, [
    "--fixture", fixture.fixtureRoot,
    "--validator", validatorPath,
    "--bundle", candidateRoot,
    "--receipt", receiptPath
  ]);
  assert.equal(probed.status, direct.status);
  assert.equal(probed.stdout, direct.stdout);
  assert.equal(probed.stderr, direct.stderr);
  assert.equal(probed.status, 3);
  assert.match(`${probed.stdout}\n${probed.stderr}`, /MaxLines=5000/);
  assert.deepEqual(await snapshotTree(fixture.themeRoot), themeBefore);
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "mismatch");
  assert.equal(receipt.comparisons[0].current_value, 5000);
  assert.equal(receipt.comparisons[0].candidate_value, 5001);
  assert.equal(receipt.comparisons[0].result, "mismatch");
});

test("DEFAULT starts one operation child and zero comparison children", { skip: !integrationAvailable }, async (t) => {
  const fixture = await createLinkFixture(t, 5000);
  const { runLinkLineLimitProbe } = require(runnerPath);
  let operationCount = 0;
  let comparisonCount = 0;
  let operationArgumentsSeen = [];
  const result = runLinkLineLimitProbe(["--fixture", fixture.fixtureRoot, "--validator", validatorPath], {
    spawnOperation: (command, args, options) => {
      operationCount += 1;
      operationArgumentsSeen = args;
      return spawnSync(command, args, options);
    },
    spawnComparison: () => {
      comparisonCount += 1;
      throw new Error("comparison child must not start");
    }
  });
  assert.equal(result.operation.status, 0);
  assert.equal(operationCount, 1);
  assert.equal(comparisonCount, 0);
  assert.equal(operationArgumentsSeen.includes("-MaxLines"), false);
  assert.equal(operationArgumentsSeen.includes("--bundle"), false);
});

test("comparison starts only after operation completion", { skip: !integrationAvailable }, async (t) => {
  const fixture = await createLinkFixture(t, 5000);
  const receiptPath = join(fixture.fixtureRoot, "receipts", "ordered.json");
  const { runLinkLineLimitProbe } = require(runnerPath);
  const events = [];
  const result = runLinkLineLimitProbe([
    "--fixture", fixture.fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ], {
    spawnOperation: (...args) => {
      events.push("operation-start");
      const child = spawnSync(...args);
      events.push("operation-complete");
      return child;
    },
    spawnComparison: (...args) => {
      events.push("comparison-start");
      return spawnSync(...args);
    }
  });
  assert.deepEqual(events, ["operation-start", "operation-complete", "comparison-start"]);
  assert.equal(result.operation.status, 0);
  assert.equal(JSON.parse(await readFile(receiptPath, "utf8")).status, "match");
});

test("candidate_invalid is diagnostic and cannot mask the current operation", { skip: !integrationAvailable }, async (t) => {
  const fixture = await createLinkFixture(t, 5000);
  const direct = runValidator(fixture);
  const receiptPath = join(fixture.fixtureRoot, "receipts", "candidate-invalid.json");
  const probed = runNode(runnerPath, [
    "--fixture", fixture.fixtureRoot,
    "--validator", validatorPath,
    "--bundle", join(fixture.fixtureRoot, "missing-bundle"),
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
  const fixture = await createLinkFixture(t, 5000);
  const receiptPath = join(fixture.fixtureRoot, "receipts", "not-run.json");
  const { runLinkLineLimitProbe } = require(runnerPath);
  const result = runLinkLineLimitProbe([
    "--fixture", fixture.fixtureRoot,
    "--validator", validatorPath,
    "--bundle", bundleRoot,
    "--receipt", receiptPath
  ], {
    spawnComparison: () => ({ error: new Error("synthetic spawn failure"), status: null, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) })
  });
  assert.equal(result.operation.status, 0);
  assert.equal(result.comparison.status, "comparison_not_run");
  const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(receipt.status, "comparison_not_run");
  assert.equal(receipt.error_code, "COMPARISON_NOT_RUN");
});

test("the direct link comparator rejects a valid fixture outside the governed laboratory", { skip: !integrationAvailable }, async (t) => {
  const sourceFixture = await createLinkFixture(t, 5000);
  const outsideParent = await mkdtemp(join(tmpdir(), "dex-memory-link-line-outside-"));
  const outsideFixture = join(outsideParent, "fixture");
  const safeTemporaryRoot = resolve(tmpdir());
  assert.ok(resolve(outsideParent).startsWith(`${safeTemporaryRoot}${sep}`));
  t.after(async () => {
    assert.ok(resolve(outsideParent).startsWith(`${safeTemporaryRoot}${sep}`));
    await rm(outsideParent, { recursive: true, force: true });
  });
  await cp(sourceFixture.fixtureRoot, outsideFixture, { recursive: true });
  const receiptPath = join(outsideFixture, "receipts", "outside.json");
  const result = runNode(comparatorPath, [
    "--consumer", "validate-memory-links",
    "--fixture", outsideFixture,
    "--bundle", bundleRoot,
    "--receipt", receiptPath,
    "--current-source", validatorPath
  ]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /FIXTURE_INVALID/);
  await assert.rejects(readFile(receiptPath), { code: "ENOENT" });
});
