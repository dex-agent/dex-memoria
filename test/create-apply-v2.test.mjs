import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const fixturesRoot = join(testRoot, "fixtures");
const require = createRequire(import.meta.url);
const { planThemeV2 } = require("../bin/create-plan.js");

const l2Request = {
  contract: "dex.memory.create.theme-v2.request.v0",
  profile: "governed-theme-v2",
  operation: "create",
  idempotency_key: "fixture:theme-v2:apply:l2:001",
  identity: "11111111-1111-4111-8111-111111111111",
  target_layer: "L2",
  route_decision: "explicit-l2-memory",
  slug: "mapa-visual-v2",
  trigger: "Quando o mapa visual V2 falhar?",
  title: "Mapa visual V2",
  body: "Memória operacional curta.",
  created_at: "2026-07-13T12:00:00.000Z"
};

const l3Request = {
  ...l2Request,
  idempotency_key: "fixture:theme-v2:apply:l3:001",
  identity: "22222222-2222-4222-8222-222222222222",
  target_layer: "L3",
  route_decision: "explicit-l3-knowledge",
  slug: "journal-recuperavel",
  trigger: "E SE o journal falhar?",
  title: "Journal recuperável",
  body: "Conhecimento profundo com referências e artefatos sob demanda.",
  owner_skill: "dex-memoria"
};

const commonFailpoints = [
  {
    name: "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT",
    latest: "PREPARED",
    checkpoints: ["0001-PREPARED.json"]
  },
  {
    name: "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX",
    latest: "DESTINATION_PUBLISHED",
    checkpoints: ["0001-PREPARED.json", "0002-DESTINATION_PUBLISHED.json"]
  },
  {
    name: "FP_AFTER_INDEX_PUBLISH_BEFORE_CHECKPOINT",
    latest: "DESTINATION_PUBLISHED",
    checkpoints: ["0001-PREPARED.json", "0002-DESTINATION_PUBLISHED.json"]
  },
  {
    name: "FP_AFTER_INDEX_CHECKPOINT_BEFORE_L1",
    latest: "INDEX_PUBLISHED",
    checkpoints: ["0001-PREPARED.json", "0002-DESTINATION_PUBLISHED.json", "0003-INDEX_PUBLISHED.json"]
  },
  {
    name: "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT",
    latest: "INDEX_PUBLISHED",
    checkpoints: ["0001-PREPARED.json", "0002-DESTINATION_PUBLISHED.json", "0003-INDEX_PUBLISHED.json"]
  },
  {
    name: "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT",
    latest: "L1_PUBLISHED",
    checkpoints: [
      "0001-PREPARED.json",
      "0002-DESTINATION_PUBLISHED.json",
      "0003-INDEX_PUBLISHED.json",
      "0004-L1_PUBLISHED.json"
    ]
  }
];

const l3DirectoryFailpoint = {
  name: "FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH",
  latest: "PREPARED",
  checkpoints: ["0001-PREPARED.json"]
};

function runCli(args, stdin = "", environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: environment,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode, signal) => resolveRun({
      pid: child.pid,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
      exitCode,
      signal
    }));
    child.stdin.end(stdin);
  });
}

async function createFixture(t, layer, capability = "transaction") {
  const fixtureRoot = await mkdtemp(join(tmpdir(), `dex-memoria-v2-apply-${layer.toLowerCase()}-`));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  const sourceRoot = join(fixturesRoot, `governed-theme-v2-plan-${layer.toLowerCase()}`);
  await cp(join(sourceRoot, "baseline"), join(fixtureRoot, "work"), { recursive: true });
  const manifest = JSON.parse(await readFile(join(sourceRoot, "manifest.json"), "utf8"));
  await writeFile(join(fixtureRoot, "manifest.json"), `${JSON.stringify(capability === "transaction" ? {
    ...manifest,
    contract: "dex.memory.fixture.governed-theme-v2-transaction.v0"
  } : manifest, null, 2)}\n`);
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/tema-exemplo"]
  }, null, 2)}\n`);
  return fixtureRoot;
}

async function createPlan(fixtureRoot, request = l2Request) {
  const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request));
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

function stableJson(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

function transactionId(plan) {
  return createHash("sha256").update(stableJson({
    profile: plan.profile,
    idempotency_key: plan.idempotency_key,
    request_fingerprint: plan.request_fingerprint,
    targets: plan.targets
  })).digest("hex").slice(0, 24);
}

function rebuildPlan(originalPlan, request) {
  const snapshot = Object.fromEntries(originalPlan.targets.map((target) => [target.slot, {
    exists: target.before_exists,
    bytes_base64: target.before_base64
  }]));
  snapshot.index_entries = [];
  const themeRoot = originalPlan.targets.find((target) => target.slot === "l1").relative_path.replace(/\/lembranca\.md$/, "");
  const directory = request.target_layer === "L2" ? "memorias" : "conhecimento";
  const paths = [
    `${themeRoot}/lembranca.md`,
    `${themeRoot}/${directory}/INDEX.md`,
    request.target_layer === "L2"
      ? `${themeRoot}/memorias/${request.slug}.md`
      : `${themeRoot}/conhecimento/${request.slug}/README.md`
  ];
  return planThemeV2(request, snapshot, paths);
}

function assertCliError(result, exitCode, code) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\{.*\}\n$/);
  const error = JSON.parse(result.stderr);
  assert.equal(error.contract, "dex.memory.error.v0");
  assert.equal(error.code, code);
  return error;
}

function recoverRequest(plan) {
  return {
    contract: "dex.memory.create.theme-v2.recover.v0",
    profile: "governed-theme-v2",
    idempotency_key: plan.idempotency_key
  };
}

function apply(fixtureRoot, plan, environment = process.env) {
  return runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan), environment);
}

function recover(fixtureRoot, plan) {
  return runCli(["create", "recover", "--fixture", fixtureRoot], JSON.stringify(recoverRequest(plan)));
}

async function snapshotWorkTree(fixtureRoot) {
  const root = join(fixtureRoot, "work");
  const rows = [];
  async function visit(relative = "") {
    const absolute = relative ? join(root, ...relative.split("/")) : root;
    for (const name of (await readdir(absolute)).sort()) {
      const childRelative = relative ? `${relative}/${name}` : name;
      const childAbsolute = join(root, ...childRelative.split("/"));
      const stat = await lstat(childAbsolute);
      if (stat.isDirectory()) {
        rows.push(`d:${childRelative}`);
        await visit(childRelative);
      } else {
        const bytes = await readFile(childAbsolute);
        rows.push(`f:${childRelative}:${createHash("sha256").update(bytes).digest("hex")}`);
      }
    }
  }
  await visit();
  return rows;
}

async function transactionFiles(fixtureRoot, plan) {
  return (await readdir(join(fixtureRoot, "journal", transactionId(plan)))).sort();
}

async function latestState(fixtureRoot, plan) {
  const files = await transactionFiles(fixtureRoot, plan);
  return JSON.parse(await readFile(join(fixtureRoot, "journal", transactionId(plan), files.at(-1)), "utf8")).state;
}

function startAndKillAtFailpoint(fixtureRoot, plan, failpoint) {
  return new Promise((resolveRun, rejectRun) => {
    const child = fork(cliPath, ["create", "apply", "--fixture", fixtureRoot], {
      cwd: repoRoot,
      env: { ...process.env, DEX_MEMORIA_INTERNAL_TEST_FAILPOINT: failpoint },
      stdio: ["pipe", "pipe", "pipe", "ipc"]
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      rejectRun(new Error(`timed out waiting for ${failpoint}`));
    }, 10000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("message", (message) => {
      try {
        assert.deepEqual(message, {
          contract: "dex.memory.test.failpoint.v0",
          failpoint,
          pid: child.pid,
          transaction_id: transactionId(plan)
        });
        child.kill("SIGKILL");
      } catch (error) {
        clearTimeout(timer);
        child.kill("SIGKILL");
        rejectRun(error);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      rejectRun(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolveRun({
        pid: child.pid,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode,
        signal
      });
    });
    child.stdin.end(JSON.stringify(plan));
  });
}

test("V2 L2 apply publishes destination, index and L1 then commits", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  const expectedTransactionId = transactionId(plan);

  const result = await runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(plan));

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stderr, "");
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.contract, "dex.memory.create.theme-v2.receipt.v0");
  assert.equal(receipt.command, "apply");
  assert.equal(receipt.status, "COMMITTED");
  assert.equal(receipt.transaction_id, expectedTransactionId);
  assert.deepEqual(receipt.publish_order, ["destination", "index", "l1"]);
  assert.equal(receipt.journal_state, "COMMITTED");

  for (const target of plan.targets) {
    assert.deepEqual(
      await readFile(join(fixtureRoot, ...target.relative_path.split("/"))),
      Buffer.from(target.after_base64, "base64")
    );
  }
  assert.deepEqual(await readdir(join(fixtureRoot, "journal", expectedTransactionId)), [
    "0001-PREPARED.json",
    "0002-DESTINATION_PUBLISHED.json",
    "0003-INDEX_PUBLISHED.json",
    "0004-L1_PUBLISHED.json",
    "0005-COMMITTED.json"
  ]);
});

test("V2 L3 apply owns the new slug directory and commits the direct L1 route", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const plan = await createPlan(fixtureRoot, l3Request);
  const result = await apply(fixtureRoot, plan);

  assert.equal(result.exitCode, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.contract, "dex.memory.create.theme-v2.receipt.v0");
  assert.equal(receipt.transaction_id, transactionId(plan));
  assert.deepEqual(receipt.publish_order, ["destination", "index", "l1"]);
  assert.deepEqual(
    await readFile(join(fixtureRoot, "work", "tema-exemplo", "conhecimento", "journal-recuperavel", "README.md")),
    Buffer.from(plan.targets.find((target) => target.slot === "destination").after_base64, "base64")
  );
  const prepared = JSON.parse(await readFile(
    join(fixtureRoot, "journal", transactionId(plan), "0001-PREPARED.json"),
    "utf8"
  ));
  assert.deepEqual(prepared.directories, [{
    relative_path: "work/tema-exemplo/conhecimento/journal-recuperavel",
    before_exists: false,
    owned_if_created: true
  }]);
});

test("the plan-only V2 fixture remains non-writing", async (t) => {
  const fixtureRoot = await createFixture(t, "L2", "plan-only");
  const plan = await createPlan(fixtureRoot);
  const before = await snapshotWorkTree(fixtureRoot);

  assertCliError(await apply(fixtureRoot, plan), 2, "INVALID_SCHEMA");
  assertCliError(await recover(fixtureRoot, plan), 2, "INVALID_SCHEMA");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), before);
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});

test("V2 apply retries are idempotent and divergent plans conflict", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const original = await createPlan(fixtureRoot);
  const divergent = await createPlan(fixtureRoot, {
    ...l2Request,
    body: "Outro conteúdo usando a mesma chave de idempotência."
  });

  assert.equal((await apply(fixtureRoot, original)).exitCode, 0);
  const checkpoints = await transactionFiles(fixtureRoot, original);
  const retry = await apply(fixtureRoot, original);
  assert.equal(retry.exitCode, 0, retry.stderr);
  assert.equal(JSON.parse(retry.stdout).status, "ALREADY_COMMITTED");
  assert.deepEqual(await transactionFiles(fixtureRoot, original), checkpoints);

  assertCliError(await apply(fixtureRoot, divergent), 4, "IDEMPOTENCY_CONFLICT");
  assert.deepEqual(await transactionFiles(fixtureRoot, original), checkpoints);
});

test("V2 apply rejects mismatched outer and embedded idempotency keys before journal", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  const tampered = structuredClone(plan);
  tampered.idempotency_key = "fixture:theme-v2:outer-key:divergent";
  const { plan_hash: ignored, ...unsigned } = tampered;
  tampered.plan_hash = createHash("sha256").update(stableJson(unsigned)).digest("hex");

  assertCliError(await apply(fixtureRoot, tampered), 2, "INVALID_SCHEMA");
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});

for (const [label, requestChange] of [
  ["reserved slug", { slug: "memoria" }],
  ["impossible created_at", { created_at: "2026-02-30T12:00:00.000Z" }]
]) {
  test(`V2 apply rejects an owner-rebuilt plan with ${label}`, async (t) => {
    const fixtureRoot = await createFixture(t, "L2");
    const original = await createPlan(fixtureRoot);
    const ownerRebuilt = rebuildPlan(original, { ...l2Request, ...requestChange });

    assertCliError(await apply(fixtureRoot, ownerRebuilt), 2, "INVALID_SCHEMA");
    await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
  });
}

test("V2 failpoints require IPC and fail before journal creation", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);

  assertCliError(await apply(fixtureRoot, plan, {
    ...process.env,
    DEX_MEMORIA_INTERNAL_TEST_FAILPOINT: "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT"
  }), 6, "FAILPOINT_UNAVAILABLE");
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});

test("V2 apply accepts every idempotency key accepted by its plan contract", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot, {
    ...l2Request,
    idempotency_key: " fixture:theme-v2:spaces:001 "
  });

  const result = await apply(fixtureRoot, plan);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "COMMITTED");
});

test("V2 plan rejects an orphan L1 route instead of emitting changed=false", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const firstPlan = await createPlan(fixtureRoot);
  const l1 = firstPlan.targets.find((target) => target.slot === "l1");
  await writeFile(
    join(fixtureRoot, ...l1.relative_path.split("/")),
    Buffer.from(l1.after_base64, "base64")
  );

  const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(l2Request));
  assertCliError(result, 4, "PLAN_CONFLICT");
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});

test("V2 journal scanning validates each stored plan intrinsically", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const first = await createPlan(fixtureRoot);
  assert.equal((await apply(fixtureRoot, first)).exitCode, 0);

  const secondRequest = {
    ...l2Request,
    idempotency_key: "fixture:theme-v2:apply:l2:002",
    identity: "33333333-3333-4333-8333-333333333333",
    slug: "segunda-memoria",
    trigger: "Quando a segunda memória for necessária?",
    title: "Segunda memória",
    body: "Outra memória leve."
  };
  const second = await createPlan(fixtureRoot, secondRequest);
  const result = await apply(fixtureRoot, second);

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "COMMITTED");
  assert.notEqual(transactionId(first), transactionId(second));
  assert.deepEqual((await readdir(join(fixtureRoot, "journal"))).sort(), [transactionId(first), transactionId(second)].sort());
});

for (const slot of ["l1", "index", "destination"]) {
  test(`V2 apply preserves ${slot} drift and creates no journal`, async (t) => {
    const fixtureRoot = await createFixture(t, "L2");
    const plan = await createPlan(fixtureRoot);
    const target = plan.targets.find((entry) => entry.slot === slot);
    const targetPath = join(fixtureRoot, ...target.relative_path.split("/"));
    const thirdVersion = Buffer.from(`third-version-${slot}\n`);
    await writeFile(targetPath, thirdVersion);

    assertCliError(await apply(fixtureRoot, plan), 4, "PLAN_CONFLICT");
    assert.deepEqual(await readFile(targetPath), thirdVersion);
    await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
  });
}

for (const slot of ["l1", "index", "destination"]) {
  test(`V2 apply rejects a re-hashed owner-invalid ${slot} payload`, async (t) => {
    const fixtureRoot = await createFixture(t, "L2");
    const plan = await createPlan(fixtureRoot);
    const tampered = structuredClone(plan);
    const target = tampered.targets.find((entry) => entry.slot === slot);
    const arbitrary = Buffer.from(`owner-invalid-${slot}\n`);
    target.after_base64 = arbitrary.toString("base64");
    target.after_sha256 = createHash("sha256").update(arbitrary).digest("hex");
    target.changed = true;
    const { plan_hash: ignored, ...unsigned } = tampered;
    tampered.plan_hash = createHash("sha256").update(stableJson(unsigned)).digest("hex");

    assertCliError(await apply(fixtureRoot, tampered), 4, "PLAN_CONFLICT");
    await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
  });
}

test("V2 L3 apply refuses a slug directory that appeared after plan", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const plan = await createPlan(fixtureRoot, l3Request);
  const slugDirectory = join(fixtureRoot, "work", "tema-exemplo", "conhecimento", "journal-recuperavel");
  await mkdir(slugDirectory);

  assertCliError(await apply(fixtureRoot, plan), 4, "PLAN_CONFLICT");
  assert.deepEqual(await readdir(slugDirectory), []);
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});

for (const [layer, request, failpoints] of [
  ["L2", l2Request, commonFailpoints],
  ["L3", l3Request, [l3DirectoryFailpoint, ...commonFailpoints]]
]) {
  for (const failpoint of failpoints) {
    test(`V2 ${layer} hard kill at ${failpoint.name} recovers B0 in a new process`, async (t) => {
      const fixtureRoot = await createFixture(t, layer);
      const baseline = await snapshotWorkTree(fixtureRoot);
      const plan = await createPlan(fixtureRoot, request);

      const killed = await startAndKillAtFailpoint(fixtureRoot, plan, failpoint.name);

      assert.equal(killed.stdout, "");
      assert.equal(killed.stderr, "");
      assert.notEqual(killed.exitCode, 0);
      assert.deepEqual(await transactionFiles(fixtureRoot, plan), failpoint.checkpoints);
      assert.equal(await latestState(fixtureRoot, plan), failpoint.latest);

      const recovered = await recover(fixtureRoot, plan);
      assert.equal(recovered.exitCode, 0, recovered.stderr);
      assert.equal(recovered.stderr, "");
      assert.notEqual(recovered.pid, killed.pid);
      const receipt = JSON.parse(recovered.stdout);
      assert.equal(receipt.contract, "dex.memory.create.theme-v2.receipt.v0");
      assert.equal(receipt.command, "recover");
      assert.equal(receipt.status, "ROLLED_BACK");
      assert.equal(receipt.journal_state, "ROLLED_BACK");
      assert.deepEqual(await snapshotWorkTree(fixtureRoot), baseline);
      assert.equal(await latestState(fixtureRoot, plan), "ROLLED_BACK");

      const checkpoints = await transactionFiles(fixtureRoot, plan);
      const second = await recover(fixtureRoot, plan);
      assert.equal(second.exitCode, 0, second.stderr);
      assert.equal(JSON.parse(second.stdout).status, "ALREADY_ROLLED_BACK");
      assert.deepEqual(await transactionFiles(fixtureRoot, plan), checkpoints);
    });
  }
}

for (const slot of ["l1", "index", "destination"]) {
  test(`V2 recovery preflight blocks third-version ${slot} before any rollback`, async (t) => {
    const fixtureRoot = await createFixture(t, "L2");
    const plan = await createPlan(fixtureRoot);
    const killed = await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT");
    assert.notEqual(killed.exitCode, 0);
    const target = plan.targets.find((entry) => entry.slot === slot);
    const targetPath = join(fixtureRoot, ...target.relative_path.split("/"));
    const thirdVersion = Buffer.from(`third-version-recovery-${slot}\n`);
    await writeFile(targetPath, thirdVersion);
    const beforeAttempt = await snapshotWorkTree(fixtureRoot);

    assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
    assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
    assert.deepEqual(await readFile(targetPath), thirdVersion);
    assert.equal(await latestState(fixtureRoot, plan), "L1_PUBLISHED");
  });
}

test("V2 recovery rejects an impossible target vector for the latest checkpoint", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX");
  const destination = plan.targets.find((target) => target.slot === "destination");
  const l1 = plan.targets.find((target) => target.slot === "l1");
  await rm(join(fixtureRoot, ...destination.relative_path.split("/")), { force: true });
  await writeFile(join(fixtureRoot, ...l1.relative_path.split("/")), Buffer.from(l1.after_base64, "base64"));
  const beforeAttempt = await snapshotWorkTree(fixtureRoot);

  assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
});

test("V2 L3 recovery preserves a directory containing an unexpected file", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const plan = await createPlan(fixtureRoot, l3Request);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT");
  const slugDirectory = join(fixtureRoot, "work", "tema-exemplo", "conhecimento", "journal-recuperavel");
  await writeFile(join(slugDirectory, "manual.txt"), "manual\n");
  const beforeAttempt = await snapshotWorkTree(fixtureRoot);

  assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
  assert.equal(await readFile(join(slugDirectory, "manual.txt"), "utf8"), "manual\n");
});

test("V2 L3 recovery preflight rejects a foreign file disguised as another role temporary", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const plan = await createPlan(fixtureRoot, l3Request);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT");
  const slugDirectory = join(fixtureRoot, "work", "tema-exemplo", "conhecimento", "journal-recuperavel");
  const disguisedName = `.dex-memory-${transactionId(plan)}-l1.tmp`;
  await writeFile(join(slugDirectory, disguisedName), "foreign\n");
  const beforeAttempt = await snapshotWorkTree(fixtureRoot);

  assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
  assert.equal(await latestState(fixtureRoot, plan), "L1_PUBLISHED");
});

test("V2 recovery preflight rejects divergent bytes at an exact registered publish temporary path", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const plan = await createPlan(fixtureRoot, l3Request);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH");
  const destination = plan.targets.find((target) => target.slot === "destination");
  const temporaryPath = join(
    dirname(join(fixtureRoot, ...destination.relative_path.split("/"))),
    `.dex-memory-${transactionId(plan)}-destination.tmp`
  );
  await writeFile(temporaryPath, "manual-not-owned\n");
  const beforeAttempt = await snapshotWorkTree(fixtureRoot);

  assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
  assert.equal(await latestState(fixtureRoot, plan), "PREPARED");
});

test("V2 recovery accepts and removes an exact plan-owned publish temporary", async (t) => {
  const fixtureRoot = await createFixture(t, "L3");
  const baseline = await snapshotWorkTree(fixtureRoot);
  const plan = await createPlan(fixtureRoot, l3Request);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH");
  const destination = plan.targets.find((target) => target.slot === "destination");
  const temporaryPath = join(
    dirname(join(fixtureRoot, ...destination.relative_path.split("/"))),
    `.dex-memory-${transactionId(plan)}-destination.tmp`
  );
  await writeFile(temporaryPath, Buffer.from(destination.after_base64, "base64"));

  const result = await recover(fixtureRoot, plan);
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, "ROLLED_BACK");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), baseline);
});

test("V2 recovery preflight rejects stale rollback temporaries before the first restore", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT");
  const index = plan.targets.find((target) => target.slot === "index");
  const rollbackTemporary = join(
    dirname(join(fixtureRoot, ...index.relative_path.split("/"))),
    `.dex-memory-${transactionId(plan)}-rollback-index.tmp`
  );
  await writeFile(rollbackTemporary, "stale\n");
  const beforeAttempt = await snapshotWorkTree(fixtureRoot);

  assertCliError(await recover(fixtureRoot, plan), 3, "SAFETY_BLOCKED");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
  assert.equal(await latestState(fixtureRoot, plan), "L1_PUBLISHED");
});

test("V2 recover binds stored target paths to the theme authorized by the current manifest", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX");
  const sourceTheme = join(fixturesRoot, "governed-theme-v2-plan-l2", "baseline", "tema-exemplo");
  await cp(sourceTheme, join(fixtureRoot, "work", "outro-tema"), { recursive: true });
  const manifestPath = join(fixtureRoot, "manifest.json");
  const markerPath = join(fixtureRoot, ".dex-memory-fixture.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const marker = JSON.parse(await readFile(markerPath, "utf8"));
  await writeFile(manifestPath, `${JSON.stringify({ ...manifest, theme: "outro-tema" }, null, 2)}\n`);
  await writeFile(markerPath, `${JSON.stringify({ ...marker, targets: ["work/outro-tema"] }, null, 2)}\n`);
  const beforeAttempt = await snapshotWorkTree(fixtureRoot);

  assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeAttempt);
  assert.equal(await latestState(fixtureRoot, plan), "DESTINATION_PUBLISHED");
});

test("V2 nonterminal journal requires recovery before another apply", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  await startAndKillAtFailpoint(fixtureRoot, plan, "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX");
  const beforeRetry = await snapshotWorkTree(fixtureRoot);

  assertCliError(await apply(fixtureRoot, plan), 5, "RECOVERY_REQUIRED");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), beforeRetry);
  assert.equal(await latestState(fixtureRoot, plan), "DESTINATION_PUBLISHED");
});

test("V2 recover rejects corrupt journals without target mutation", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  const baseline = await snapshotWorkTree(fixtureRoot);
  const transactionRoot = join(fixtureRoot, "journal", transactionId(plan));
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), "{\n");

  assertCliError(await recover(fixtureRoot, plan), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await snapshotWorkTree(fixtureRoot), baseline);
});

test("V2 apply blocks a transaction journal symlink before external mutation", async (t) => {
  const fixtureRoot = await createFixture(t, "L2");
  const plan = await createPlan(fixtureRoot);
  const externalRoot = await mkdtemp(join(tmpdir(), "dex-memoria-v2-external-journal-"));
  t.after(() => rm(externalRoot, { recursive: true, force: true }));
  await mkdir(join(fixtureRoot, "journal"));
  try {
    await symlink(externalRoot, join(fixtureRoot, "journal", transactionId(plan)), "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "UNKNOWN"].includes(error.code)) {
      t.skip("symlink creation is unavailable");
      return;
    }
    throw error;
  }

  assertCliError(await apply(fixtureRoot, plan), 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readdir(externalRoot), []);
});

test("V2 terminal journals are no-ops even after later drift", async (t) => {
  const committedRoot = await createFixture(t, "L2");
  const committedPlan = await createPlan(committedRoot);
  assert.equal((await apply(committedRoot, committedPlan)).exitCode, 0);
  const committedL1 = committedPlan.targets.find((target) => target.slot === "l1");
  const committedL1Path = join(committedRoot, ...committedL1.relative_path.split("/"));
  await writeFile(committedL1Path, "post-commit-manual\n");
  const committedCheckpoints = await transactionFiles(committedRoot, committedPlan);
  const committedRecovery = await recover(committedRoot, committedPlan);
  assert.equal(committedRecovery.exitCode, 0, committedRecovery.stderr);
  assert.equal(JSON.parse(committedRecovery.stdout).status, "ALREADY_COMMITTED");
  assert.equal(await readFile(committedL1Path, "utf8"), "post-commit-manual\n");
  assert.deepEqual(await transactionFiles(committedRoot, committedPlan), committedCheckpoints);

  const rolledBackRoot = await createFixture(t, "L2");
  const rolledBackPlan = await createPlan(rolledBackRoot);
  await startAndKillAtFailpoint(rolledBackRoot, rolledBackPlan, "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT");
  assert.equal((await recover(rolledBackRoot, rolledBackPlan)).exitCode, 0);
  const rolledBackL1 = rolledBackPlan.targets.find((target) => target.slot === "l1");
  const rolledBackL1Path = join(rolledBackRoot, ...rolledBackL1.relative_path.split("/"));
  await writeFile(rolledBackL1Path, "post-rollback-manual\n");
  const rolledBackCheckpoints = await transactionFiles(rolledBackRoot, rolledBackPlan);
  const rolledBackRecovery = await recover(rolledBackRoot, rolledBackPlan);
  assert.equal(rolledBackRecovery.exitCode, 0, rolledBackRecovery.stderr);
  assert.equal(JSON.parse(rolledBackRecovery.stdout).status, "ALREADY_ROLLED_BACK");
  assert.equal(await readFile(rolledBackL1Path, "utf8"), "post-rollback-manual\n");
  assert.deepEqual(await transactionFiles(rolledBackRoot, rolledBackPlan), rolledBackCheckpoints);
});

test("V2 transaction schemas are separate, closed and publicly owned", async () => {
  const contracts = [
    ["dex.memory.fixture.governed-theme-v2-transaction.v0.schema.json", "dex.memory.fixture.governed-theme-v2-transaction.v0"],
    ["dex.memory.create.theme-v2.checkpoint.internal.v0.schema.json", "dex.memory.create.theme-v2.checkpoint.internal.v0"],
    ["dex.memory.create.theme-v2.receipt.v0.schema.json", "dex.memory.create.theme-v2.receipt.v0"],
    ["dex.memory.create.theme-v2.recover.v0.schema.json", "dex.memory.create.theme-v2.recover.v0"]
  ];
  const validator = await readFile(join(repoRoot, "scripts", "validate-create-contracts.js"), "utf8");
  const publicValidator = await readFile(join(repoRoot, "scripts", "validate-public.js"), "utf8");
  for (const [file, contract] of contracts) {
    const schema = JSON.parse(await readFile(join(repoRoot, "contracts", "schemas", file), "utf8"));
    assert.equal(schema.title, contract);
    if (file.includes("checkpoint")) {
      assert.equal(schema.unevaluatedProperties, false);
      assert.equal(Object.hasOwn(schema, "additionalProperties"), false);
    } else {
      assert.equal(schema.additionalProperties, false);
    }
    assert.match(validator, new RegExp(file.replaceAll(".", "\\.")));
    assert.match(publicValidator, new RegExp(file.replaceAll(".", "\\.")));
  }
  const receipt = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.create.theme-v2.receipt.v0.schema.json"),
    "utf8"
  ));
  assert.deepEqual(receipt.oneOf.map((variant) => [
    variant.properties.command.const,
    variant.properties.status.const,
    variant.properties.journal_state.const
  ]), [
    ["apply", "COMMITTED", "COMMITTED"],
    ["apply", "ALREADY_COMMITTED", "COMMITTED"],
    ["recover", "ROLLED_BACK", "ROLLED_BACK"],
    ["recover", "ALREADY_ROLLED_BACK", "ROLLED_BACK"],
    ["recover", "ALREADY_COMMITTED", "COMMITTED"]
  ]);
  const planSchema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.create.theme-v2.plan.v0.schema.json"),
    "utf8"
  ));
  assert.equal(planSchema.$defs.target.properties.changed.const, true);
  const requestSchema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.create.theme-v2.request.v0.schema.json"),
    "utf8"
  ));
  const fixtureSchema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.fixture.governed-theme-v2-transaction.v0.schema.json"),
    "utf8"
  ));
  const planFixtureSchema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.fixture.governed-theme-v2-plan.v0.schema.json"),
    "utf8"
  ));
  assert.deepEqual(fixtureSchema.properties.theme.not.enum, requestSchema.properties.slug.not.enum);
  assert.deepEqual(planFixtureSchema.properties.theme.not.enum, requestSchema.properties.slug.not.enum);
});

test("V2 transaction documentation freezes emitted recovery status and exit codes", async () => {
  const transactionDoc = await readFile(
    join(repoRoot, "docs", "cli-create-theme-v2-transaction-v0.md"),
    "utf8"
  );
  const normalizedTransactionDoc = transactionDoc.replace(/\r\n?/g, "\n");
  for (const expected of [
    "status `ROLLED_BACK`",
    "`plan`\nproduz exatamente um plano `dex.memory.create.theme-v2.plan.v0`",
    "`apply` e\n`recover` produzem exatamente um recibo",
    "dex-memoria create plan --fixture <fixture-root> < request.json",
    "dex-memoria create apply --fixture <fixture-root> < plan.json",
    "dex-memoria create recover --fixture <fixture-root> < recover.json",
    "| `0` | plano ou recibo valido, incluindo no-op terminal |",
    "| `2` | `INVALID_USAGE`, `INVALID_JSON` ou `INVALID_SCHEMA` |",
    "| `3` | `SAFETY_BLOCKED` antes de mutacao autorizada |",
    "| `4` | `PLAN_CONFLICT`, `JOURNAL_CONFLICT`, `RECOVERY_CONFLICT`, `IDEMPOTENCY_CONFLICT` ou `TRANSACTION_ROLLED_BACK` |",
    "| `5` | `RECOVERY_REQUIRED` antes de novo apply |",
    "| `6` | `FAILPOINT_UNAVAILABLE` ou falha de I/O sanitizada como `IO_FAILURE` |"
  ]) {
    assert.ok(normalizedTransactionDoc.includes(expected), `missing transaction documentation contract: ${expected}`);
  }
});
