import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const fixtureSourceRoot = join(testRoot, "fixtures", "legacy-create-l1-l2-v1");

const request = {
  contract: "dex.memory.create.request.v0",
  operation: "create",
  idempotency_key: "fixture:legacy-create-l1-l2:001",
  candidate: {
    localizer: "TRACER-CREATE-L1-L2",
    trigger: "abrir memoria",
    title: "Tracer create L1+L2",
    anchor: "tracer-create-l1-l2",
    body: "Detalhe fixture-only."
  }
};

async function runCli(args, stdin = "", environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], { cwd: repoRoot, env: environment, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      exitCode
    }));
    child.stdin.end(stdin);
  });
}

async function createFixture(t) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memoria-plan-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(join(fixtureRoot, "work"));
  await writeFile(
    join(fixtureRoot, ".dex-memory-fixture.json"),
    `${JSON.stringify({
      contract: "dex.memory.disposable-run.v1",
      operation: "create",
      disposable: true,
      targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"]
    }, null, 2)}\n`
  );
  await writeFile(
    join(fixtureRoot, "manifest.json"),
    await readFile(join(fixtureSourceRoot, "manifest.json"))
  );
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), await readFile(join(fixtureSourceRoot, "baseline", "LEMBRANCA.md")));
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), await readFile(join(fixtureSourceRoot, "baseline", "MEMORIA.md")));
  return fixtureRoot;
}

async function createPlan(fixtureRoot, input = request) {
  const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(input));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function assertCliError(result, exitCode, code) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\{.*\}\n$/);
  const error = JSON.parse(result.stderr);
  assert.equal(error.contract, "dex.memory.error.v0");
  assert.equal(error.code, code);
  assert.equal(typeof error.message, "string");
  assert.ok(error.message.length > 0);
}

function stableJson(value) {
  if (Array.isArray(value)) return JSON.stringify(value.map((entry) => JSON.parse(stableJson(entry))));
  if (value && typeof value === "object") {
    return JSON.stringify(Object.fromEntries(Object.keys(value).sort().map((key) => [key, JSON.parse(stableJson(value[key]))])));
  }
  return JSON.stringify(value);
}

function resignPlan(plan) {
  const { plan_hash: ignored, ...unsigned } = plan;
  return { ...unsigned, plan_hash: createHash("sha256").update(stableJson(unsigned)).digest("hex") };
}

async function assertNoJournal(fixtureRoot) {
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
}

test("preserves exact V1 version output", async () => {
  const result = await runCli(["version"]);
  assert.deepEqual(result, { stdout: "0.1.6\n", stderr: "", exitCode: 0 });
});

test("preserves exact V1 doctor output under a controlled environment", async (t) => {
  const memoryRoot = await mkdtemp(join(tmpdir(), "dex-memoria-doctor-"));
  t.after(() => rm(memoryRoot, { recursive: true, force: true }));
  const result = await runCli(["doctor"], "", { ...process.env, DEX_MEMORIA_HOME: memoryRoot });
  assert.deepEqual(result, {
    stdout: `dex-memoria 0.1.6 ok\nPacote: ${repoRoot}\nMemoria home: ${resolve(memoryRoot)}\nMemoria home source: DEX_MEMORIA_HOME\nModo: contrato documental, sem runtime proprio\n`,
    stderr: "",
    exitCode: 0
  });
});

test("preserves exact V1 memory-home output", async (t) => {
  const memoryRoot = await mkdtemp(join(tmpdir(), "dex-memoria-home-"));
  t.after(() => rm(memoryRoot, { recursive: true, force: true }));
  const result = await runCli(["memory-home"], "", { ...process.env, DEX_MEMORIA_HOME: memoryRoot });
  assert.deepEqual(result, {
    stdout: `${resolve(memoryRoot)}\nsource=DEX_MEMORIA_HOME\nglobal=<DEX_MEMORIA_HOME>/global\ntemas=<DEX_MEMORIA_HOME>/temas/<tema>\nprojeto=<WORKSPACE>/.agents\n`,
    stderr: "",
    exitCode: 0
  });
});

test("preserves exact V1 install dry-run output", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-install-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "target");
  const registryTarget = join(root, "registry");
  const result = await runCli(["install", "--target", target, "--registry-target", registryTarget, "--dry-run"]);
  assert.deepEqual(result, {
    stdout: [
      `Instalaria dex-memoria em: ${target}`,
      "- SKILL.md", "- SPEC.md", "- README.md", "- CHANGELOG.md", "- DECISIONS.md", "- VERSION", "- package.json",
      "- bin", "- contracts", "- docs", "- registry", "- templates", "- examples",
      `Instalaria redirecionador global em: ${join(registryTarget, "SKILL.md")}`,
      "- registry\\agents-skills\\dex-memoria\\SKILL.md",
      ""
    ].join("\n"),
    stderr: "",
    exitCode: 0
  });
});

test("help advertises the fixture-only create apply command", async () => {
  const result = await runCli(["help"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /dex-memoria create apply --fixture <fixture-root>/);
});

test("the internal planner source has no filesystem, clock, random or environment capability", async () => {
  const source = await readFile(join(repoRoot, "bin", "create-plan.js"), "utf8");
  assert.doesNotMatch(source, /node:fs|require\(["']fs["']\)|Date\s*\(|Date\.now|process\.env|Math\.random/);
});

test("npm test runs the node:test contract suite", async () => {
  const packageJson = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  assert.match(packageJson.scripts.test, /node --test/);
});

test("the test suite is Node 18 portable and self-contained", async () => {
  const source = await readFile(new URL("create-plan.test.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /import\.meta\.dirname/);
  assert.match(source, /fileURLToPath\(import\.meta\.url\)/);
  assert.doesNotMatch(source, new RegExp(["laboratorio", "memories"].join("-")));
  assert.doesNotMatch(source, /import \{ homedir,/);
});

test("create plan emits a deterministic read-only plan matching legacy goldens", async (t) => {
  const fixtureRoot = await createFixture(t);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));

  const first = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request));
  const second = await runCli(["create", "plan", "--fixture", fixtureRoot], `${JSON.stringify(request)}\n`);

  assert.equal(first.exitCode, 0);
  assert.equal(first.stderr, "");
  assert.equal(first.stdout, second.stdout);
  assert.match(first.stdout, /^\{.*\}\n$/);

  const plan = JSON.parse(first.stdout);
  assert.deepEqual(Object.keys(plan), [
    "contract",
    "operation",
    "idempotency_key",
    "request_fingerprint",
    "transaction_id",
    "targets",
    "plan_hash"
  ]);
  assert.equal(plan.contract, "dex.memory.create.plan.v0");
  assert.equal(plan.operation, "create");
  assert.equal(plan.idempotency_key, request.idempotency_key);
  assert.match(plan.request_fingerprint, /^[a-f0-9]{64}$/);
  assert.match(plan.transaction_id, /^[a-f0-9]{24}$/);
  assert.match(plan.plan_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(plan.targets.map((target) => target.slot), ["l1", "l2"]);
  assert.deepEqual(plan.targets.map((target) => target.relative_path), ["work/LEMBRANCA.md", "work/MEMORIA.md"]);
  assert.deepEqual(Object.keys(plan.targets[0]), [
    "slot", "relative_path", "before_exists", "before_sha256", "before_base64",
    "after_sha256", "after_base64", "changed"
  ]);
  assert.doesNotMatch(first.stdout, new RegExp(fixtureRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.deepEqual(Buffer.from(plan.targets[0].after_base64, "base64"), await readFile(join(fixtureSourceRoot, "expected", "LEMBRANCA.md")));
  assert.deepEqual(Buffer.from(plan.targets[1].after_base64, "base64"), await readFile(join(fixtureSourceRoot, "expected", "MEMORIA.md")));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
});

test("create plan rejects invalid JSON documents with the schema exit contract", async (t) => {
  const fixtureRoot = await createFixture(t);
  for (const input of ["", "{", "{}{}", `${JSON.stringify(request)}\n${JSON.stringify(request)}`, Buffer.from([0xff])]) {
    assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], input), 2, "INVALID_JSON");
  }
});

test("create plan rejects requests larger than 1 MiB", async (t) => {
  const fixtureRoot = await createFixture(t);
  const input = Buffer.alloc(1024 * 1024 + 1, 0x20).toString("utf8");
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], input), 2, "INVALID_SCHEMA");
});

test("create plan enforces the closed request schema and lexical rules", async (t) => {
  const fixtureRoot = await createFixture(t);
  const cases = [
    { value: { ...request, path: "work/LEMBRANCA.md" }, label: "unknown root field" },
    { value: { ...request, contract: "other" }, label: "contract" },
    { value: { ...request, operation: "update" }, label: "operation" },
    { value: { ...request, idempotency_key: " " }, label: "blank idempotency key" },
    { value: { ...request, idempotency_key: "x".repeat(257) }, label: "idempotency key limit" },
    { value: { ...request, candidate: { ...request.candidate, target: "work/MEMORIA.md" } }, label: "unknown candidate field" },
    { value: { ...request, candidate: { ...request.candidate, localizer: "bad-localizer" } }, label: "localizer syntax" },
    { value: { ...request, candidate: { ...request.candidate, localizer: "A".repeat(129) } }, label: "localizer limit" },
    { value: { ...request, candidate: { ...request.candidate, trigger: "x".repeat(513) } }, label: "trigger limit" },
    { value: { ...request, candidate: { ...request.candidate, title: "x".repeat(257) } }, label: "title limit" },
    { value: { ...request, candidate: { ...request.candidate, anchor: "Bad-Anchor" } }, label: "anchor syntax" },
    { value: { ...request, candidate: { ...request.candidate, anchor: "a".repeat(129) } }, label: "anchor limit" },
    { value: { ...request, candidate: { ...request.candidate, body: "x".repeat(65537) } }, label: "body limit" },
    { value: { ...request, candidate: { ...request.candidate, body: "\t" } }, label: "blank body" }
  ];
  for (const { value, label } of cases) {
    const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(value));
    try {
      assertCliError(result, 2, "INVALID_SCHEMA");
    } catch (error) {
      error.message = `${label}: ${error.message}`;
      throw error;
    }
  }
});

test("create plan rejects invalid fixture command usage", async () => {
  assertCliError(await runCli(["create", "plan"], JSON.stringify(request)), 2, "INVALID_USAGE");
  assertCliError(await runCli(["create", "plan", "--fixture", "a", "extra"], JSON.stringify(request)), 2, "INVALID_USAGE");
  assertCliError(await runCli(["create", "apply"], JSON.stringify(request)), 2, "INVALID_USAGE");
});

test("create plan blocks invalid marker and manifest before planning", async (t) => {
  const fixtureRoot = await createFixture(t);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), "{}\n");
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");

  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"]
  })}\n`);
  await writeFile(join(fixtureRoot, "manifest.json"), `${JSON.stringify({
    contract: "dex.memory.fixture.legacy-create-l1-l2.v1",
    operation: "create",
    disposable_runs_only: true,
    targets: ["../LEMBRANCA.md", "work/MEMORIA.md"]
  })}\n`);
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");
});

test("create plan enforces closed marker and manifest schemas", async (t) => {
  const markerRoot = await createFixture(t);
  await writeFile(join(markerRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"],
    extra: true
  })}\n`);
  assertCliError(await runCli(["create", "plan", "--fixture", markerRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");

  const manifestRoot = await createFixture(t);
  await writeFile(join(manifestRoot, "manifest.json"), `${JSON.stringify({
    contract: "dex.memory.fixture.legacy-create-l1-l2.v1",
    operation: "create",
    disposable_runs_only: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"],
    extra: true
  })}\n`);
  assertCliError(await runCli(["create", "plan", "--fixture", manifestRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");
});

test("create plan blocks a symlink target", async (t) => {
  const fixtureRoot = await createFixture(t);
  const external = join(fixtureRoot, "external.md");
  await writeFile(external, "external\n");
  await rm(join(fixtureRoot, "work", "LEMBRANCA.md"));
  try {
    await symlink(external, join(fixtureRoot, "work", "LEMBRANCA.md"), "file");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 3, "SAFETY_BLOCKED");
});

test("create plan sanitizes unexpected target I/O failures", async (t) => {
  const fixtureRoot = await createFixture(t);
  const target = join(fixtureRoot, "work", "LEMBRANCA.md");
  await rm(target);
  await mkdir(target);
  assertCliError(await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request)), 6, "IO_FAILURE");
});

test("create apply commits both targets byte for byte and emits a receipt", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^\{.*\}\n$/);
  const receipt = JSON.parse(result.stdout);
  assert.deepEqual(receipt, {
    contract: "dex.memory.create.receipt.v0",
    command: "apply",
    status: "COMMITTED",
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    writes: plan.targets.map((target) => ({
      slot: target.slot,
      relative_path: target.relative_path,
      before_sha256: target.before_sha256,
      after_sha256: target.after_sha256,
      changed: target.changed
    })),
    journal_state: "COMMITTED",
    recovery_required: false
  });
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), Buffer.from(plan.targets[0].after_base64, "base64"));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), Buffer.from(plan.targets[1].after_base64, "base64"));
  assert.deepEqual(await readdir(join(fixtureRoot, "journal", plan.transaction_id)), [
    "0001-PREPARED.json", "0002-L1_PUBLISHED.json", "0003-COMMITTED.json"
  ]);
  assert.deepEqual(JSON.parse(await readFile(join(fixtureRoot, "journal", plan.transaction_id, "0001-PREPARED.json"), "utf8")), {
    state: "PREPARED",
    transaction_id: plan.transaction_id,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    plan_hash: plan.plan_hash,
    plan
  });
});

test("create apply rejects a closed-schema violation before journal creation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify({ ...plan, path: "outside" }));
  assertCliError(result, 2, "INVALID_SCHEMA");
  await assertNoJournal(fixtureRoot);
});

test("create apply rejects a tampered plan hash before journal creation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  plan.targets[0].after_base64 = Buffer.from("tampered\n").toString("base64");
  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
  assertCliError(result, 4, "PLAN_CONFLICT");
  await assertNoJournal(fixtureRoot);
});

test("create apply rejects re-signed relative paths not derived from the fixture", async (t) => {
  const fixtureRoot = await createFixture(t);
  const original = await createPlan(fixtureRoot);
  original.targets[0].relative_path = "work/MEMORIA.md";
  original.targets[1].relative_path = "work/LEMBRANCA.md";
  const plan = resignPlan(original);
  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
  assertCliError(result, 4, "PLAN_CONFLICT");
  await assertNoJournal(fixtureRoot);
});

for (const { slot, file } of [
  { slot: "l1", file: "LEMBRANCA.md" },
  { slot: "l2", file: "MEMORIA.md" }
]) {
  test(`create apply preserves manual ${slot} drift and creates no journal`, async (t) => {
    const fixtureRoot = await createFixture(t);
    const plan = await createPlan(fixtureRoot);
    const targetPath = join(fixtureRoot, "work", file);
    const edited = Buffer.from(`manual-${slot}-edit\n`);
    await writeFile(targetPath, edited);
    const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
    assertCliError(result, 4, "PLAN_CONFLICT");
    assert.deepEqual(await readFile(targetPath), edited);
    await assertNoJournal(fixtureRoot);
  });
}

test("create apply enforces JSON, usage and marker stream contracts before journal", async (t) => {
  const fixtureRoot = await createFixture(t);
  assertCliError(await runCli(["create", "apply", "--fixture", fixtureRoot], "{"), 2, "INVALID_JSON");
  await assertNoJournal(fixtureRoot);

  const plan = await createPlan(fixtureRoot);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), "{}\n");
  const blocked = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));
  assertCliError(blocked, 3, "SAFETY_BLOCKED");
  assert.doesNotMatch(blocked.stderr, new RegExp(fixtureRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  await assertNoJournal(fixtureRoot);
});

test("create apply sanitizes unexpected target I/O failure with exit 6 and no journal", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const targetPath = join(fixtureRoot, "work", "LEMBRANCA.md");
  await rm(targetPath);
  await mkdir(targetPath);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 6, "IO_FAILURE");
  assert.doesNotMatch(result.stderr, /EISDIR|LEMBRANCA|dex-memoria-plan-/i);
  await assertNoJournal(fixtureRoot);
});

test("create apply blocks a journal symlink before any external write", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memoria-journal-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  try {
    await symlink(externalRoot, join(fixtureRoot, "journal"), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readdir(externalRoot), []);
});

test("create apply blocks a transaction journal symlink before any external write", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memoria-transaction-external-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  await mkdir(join(fixtureRoot, "journal"));
  try {
    await symlink(externalRoot, join(fixtureRoot, "journal", plan.transaction_id), "junction");
  } catch (error) {
    if (error.code === "EPERM") {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assertCliError(result, 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readdir(externalRoot), []);
});

test("create apply returns ALREADY_COMMITTED without new checkpoints or duplicate content", async (t) => {
  const fixtureRoot = await createFixture(t);
  const plan = await createPlan(fixtureRoot);
  assert.equal((await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan))).exitCode, 0);
  const firstL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const firstL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  const beforeCheckpoints = await readdir(join(fixtureRoot, "journal", plan.transaction_id));

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "ALREADY_COMMITTED");
  assert.equal(receipt.journal_state, "COMMITTED");
  assert.equal(receipt.recovery_required, false);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), firstL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), firstL2);
  assert.deepEqual(await readdir(join(fixtureRoot, "journal", plan.transaction_id)), beforeCheckpoints);
});

test("create apply rejects an idempotency key reused for a divergent request and plan", async (t) => {
  const fixtureRoot = await createFixture(t);
  const committedPlan = await createPlan(fixtureRoot);
  const divergentPlan = await createPlan(fixtureRoot, {
    ...request,
    candidate: { ...request.candidate, body: "Different fixture-only detail." }
  });
  assert.equal((await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(committedPlan))).exitCode, 0);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(divergentPlan));

  assertCliError(result, 4, "IDEMPOTENCY_CONFLICT");
  await assert.rejects(readdir(join(fixtureRoot, "journal", divergentPlan.transaction_id)), { code: "ENOENT" });
});

for (const state of ["PREPARED", "L1_PUBLISHED", "ROLLED_BACK"]) {
  test(`create apply requires recovery when an existing journal is ${state}`, async (t) => {
    const fixtureRoot = await createFixture(t);
    const plan = await createPlan(fixtureRoot);
    const transactionRoot = join(fixtureRoot, "journal", plan.transaction_id);
    await mkdir(transactionRoot, { recursive: true });
    await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
      state: "PREPARED",
      transaction_id: plan.transaction_id,
      idempotency_key: plan.idempotency_key,
      request_fingerprint: plan.request_fingerprint,
      plan_hash: plan.plan_hash,
      plan
    })}\n`);
    if (state !== "PREPARED") {
      await writeFile(join(transactionRoot, `0002-${state}.json`), `${JSON.stringify({ state, transaction_id: plan.transaction_id })}\n`);
    }

    const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

    assertCliError(result, 5, "RECOVERY_REQUIRED");
    assert.deepEqual(await readdir(transactionRoot), state === "PREPARED"
      ? ["0001-PREPARED.json"]
      : ["0001-PREPARED.json", `0002-${state}.json`]);
  });
}
