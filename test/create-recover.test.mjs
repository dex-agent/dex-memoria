import assert from "node:assert/strict";
import { fork, spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testRoot = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testRoot, "..");
const cliPath = join(repoRoot, "bin", "dex-memoria.js");
const fixtureSourceRoot = join(testRoot, "fixtures", "legacy-create-l1-l2-v1");
const failpoints = [
  {
    name: "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT",
    latest: "PREPARED",
    checkpoints: ["0001-PREPARED.json"]
  },
  {
    name: "FP_AFTER_L1_CHECKPOINT_BEFORE_L2",
    latest: "L1_PUBLISHED",
    checkpoints: ["0001-PREPARED.json", "0002-L1_PUBLISHED.json"]
  }
];

const createRequest = {
  contract: "dex.memory.create.request.v0",
  operation: "create",
  idempotency_key: "fixture:legacy-create-l1-l2:recover-001",
  candidate: {
    localizer: "TRACER-RECOVER-L1-L2",
    trigger: "recuperar memoria",
    title: "Tracer recover L1+L2",
    anchor: "tracer-recover-l1-l2",
    body: "Recovery fixture-only."
  }
};

const recoverRequest = {
  contract: "dex.memory.create.recover.v0",
  idempotency_key: createRequest.idempotency_key
};

async function createFixture(t) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "dex-memoria-recover-"));
  t.after(() => rm(fixtureRoot, { recursive: true, force: true }));
  await mkdir(join(fixtureRoot, "work"));
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), `${JSON.stringify({
    contract: "dex.memory.disposable-run.v1",
    operation: "create",
    disposable: true,
    targets: ["work/LEMBRANCA.md", "work/MEMORIA.md"]
  }, null, 2)}\n`);
  await writeFile(join(fixtureRoot, "manifest.json"), await readFile(join(fixtureSourceRoot, "manifest.json")));
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), await baseline("LEMBRANCA.md"));
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), await baseline("MEMORIA.md"));
  return fixtureRoot;
}

function baseline(file) {
  return readFile(join(fixtureSourceRoot, "baseline", file));
}

function runCli(args, stdin = "", environment = process.env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      env: environment,
      stdio: ["pipe", "pipe", "pipe"]
    });
    collectChild(child, stdin, resolveRun, rejectRun);
  });
}

function collectChild(child, stdin, resolveRun, rejectRun) {
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
}

async function plan(fixtureRoot, request = createRequest) {
  const result = await runCli(["create", "plan", "--fixture", fixtureRoot], JSON.stringify(request));
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  return JSON.parse(result.stdout);
}

async function apply(fixtureRoot, createPlan) {
  return runCli(["create", "apply", "--fixture", fixtureRoot], JSON.stringify(createPlan));
}

async function recover(fixtureRoot, request = recoverRequest) {
  return runCli(["create", "recover", "--fixture", fixtureRoot], JSON.stringify(request));
}

function assertCliError(result, exitCode, code) {
  assert.equal(result.exitCode, exitCode);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^\{.*\}\n$/);
  const error = JSON.parse(result.stderr);
  assert.deepEqual(Object.keys(error), ["contract", "code", "message"]);
  assert.equal(error.contract, "dex.memory.error.v0");
  assert.equal(error.code, code);
  assert.equal(typeof error.message, "string");
  assert.ok(error.message.length > 0);
  return error;
}

async function transactionFiles(fixtureRoot, transactionId) {
  return (await readdir(join(fixtureRoot, "journal", transactionId))).sort();
}

async function latestState(fixtureRoot, transactionId) {
  const names = await transactionFiles(fixtureRoot, transactionId);
  const latest = names.at(-1);
  return JSON.parse(await readFile(join(fixtureRoot, "journal", transactionId, latest), "utf8")).state;
}

async function startAndKillAtFailpoint(fixtureRoot, createPlan, failpoint) {
  return new Promise((resolveKill, rejectKill) => {
    const child = fork(cliPath, ["create", "apply", "--fixture", fixtureRoot], {
      cwd: repoRoot,
      env: { ...process.env, DEX_MEMORIA_INTERNAL_TEST_FAILPOINT: failpoint },
      silent: true
    });
    const stdout = [];
    const stderr = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      rejectKill(new Error(`timed out waiting for ${failpoint}`));
    }, 5000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      rejectKill(error);
    });
    child.on("message", (message) => {
      try {
        assert.deepEqual(message, {
          contract: "dex.memory.test.failpoint.v0",
          failpoint,
          pid: child.pid,
          transaction_id: createPlan.transaction_id
        });
        assert.equal(child.kill("SIGKILL"), true);
      } catch (error) {
        clearTimeout(timeout);
        child.kill("SIGKILL");
        rejectKill(error);
      }
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      resolveKill({
        pid: child.pid,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode,
        signal
      });
    });
    child.stdin.end(JSON.stringify(createPlan));
  });
}

function expectedReceipt(createPlan, status, journalState = status === "ALREADY_COMMITTED" ? "COMMITTED" : "ROLLED_BACK") {
  return {
    contract: "dex.memory.create.receipt.v0",
    command: "recover",
    status,
    transaction_id: createPlan.transaction_id,
    idempotency_key: createPlan.idempotency_key,
    request_fingerprint: createPlan.request_fingerprint,
    plan_hash: createPlan.plan_hash,
    writes: createPlan.targets.map((target) => ({
      slot: target.slot,
      relative_path: target.relative_path,
      before_sha256: target.before_sha256,
      after_sha256: target.after_sha256,
      changed: target.changed
    })),
    journal_state: journalState,
    recovery_required: false
  };
}

for (const failpoint of failpoints) {
  test(`hard kill at ${failpoint.name} is recovered in a distinct process byte for byte`, async (t) => {
    const fixtureRoot = await createFixture(t);
    const beforeL1 = await baseline("LEMBRANCA.md");
    const beforeL2 = await baseline("MEMORIA.md");
    const createPlan = await plan(fixtureRoot);

    const killed = await startAndKillAtFailpoint(fixtureRoot, createPlan, failpoint.name);

    assert.equal(killed.stdout, "");
    assert.equal(killed.stderr, "");
    assert.notEqual(killed.exitCode, 0);
    assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), Buffer.from(createPlan.targets[0].after_base64, "base64"));
    assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
    assert.deepEqual(await transactionFiles(fixtureRoot, createPlan.transaction_id), failpoint.checkpoints);
    assert.equal(await latestState(fixtureRoot, createPlan.transaction_id), failpoint.latest);

    const recovered = await recover(fixtureRoot);

    assert.equal(recovered.exitCode, 0);
    assert.equal(recovered.stderr, "");
    assert.notEqual(recovered.pid, killed.pid);
    assert.deepEqual(JSON.parse(recovered.stdout), expectedReceipt(createPlan, "ROLLED_BACK"));
    assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
    assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
    assert.equal(await latestState(fixtureRoot, createPlan.transaction_id), "ROLLED_BACK");
    t.diagnostic(JSON.stringify({
      failpoint: failpoint.name,
      killed_pid: killed.pid,
      recovery_pid: recovered.pid,
      checkpoint_before_recovery: failpoint.latest,
      restored_bytes: { l1: beforeL1.length, l2: beforeL2.length }
    }));

    const checkpointNames = await transactionFiles(fixtureRoot, createPlan.transaction_id);
    const second = await recover(fixtureRoot);
    assert.deepEqual(JSON.parse(second.stdout), expectedReceipt(createPlan, "ALREADY_ROLLED_BACK"));
    assert.deepEqual(await transactionFiles(fixtureRoot, createPlan.transaction_id), checkpointNames);
  });
}

test("recover rolls back a valid PREPARED transaction", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  const transactionRoot = join(fixtureRoot, "journal", createPlan.transaction_id);
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: createPlan.transaction_id,
    idempotency_key: createPlan.idempotency_key,
    request_fingerprint: createPlan.request_fingerprint,
    plan_hash: createPlan.plan_hash,
    plan: createPlan
  })}\n`);

  const result = await recover(fixtureRoot);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), expectedReceipt(createPlan, "ROLLED_BACK"));
  assert.deepEqual(await transactionFiles(fixtureRoot, createPlan.transaction_id), ["0001-PREPARED.json", "0002-ROLLED_BACK.json"]);
});

test("recover safety-blocks a valid journal reached through a transaction symlink without mutation", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  const linkedTransactionRoot = join(fixtureRoot, "linked-transaction");
  await mkdir(linkedTransactionRoot);
  await writeFile(join(linkedTransactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: createPlan.transaction_id,
    idempotency_key: createPlan.idempotency_key,
    request_fingerprint: createPlan.request_fingerprint,
    plan_hash: createPlan.plan_hash,
    plan: createPlan
  })}\n`);
  await mkdir(join(fixtureRoot, "journal"));
  await symlink(linkedTransactionRoot, join(fixtureRoot, "journal", createPlan.transaction_id), "junction");
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  const beforeCheckpoints = await readdir(linkedTransactionRoot);

  const result = await recover(fixtureRoot);

  assertCliError(result, 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
  assert.deepEqual(await readdir(linkedTransactionRoot), beforeCheckpoints);
});

for (const { slot, file } of [{ slot: "l1", file: "LEMBRANCA.md" }, { slot: "l2", file: "MEMORIA.md" }]) {
  test(`recover rejects third-version ${slot} bytes before overwriting either target`, async (t) => {
    const fixtureRoot = await createFixture(t);
    const createPlan = await plan(fixtureRoot);
    const committed = await apply(fixtureRoot, createPlan);
    assert.equal(committed.exitCode, 0);
    await rm(join(fixtureRoot, "journal", createPlan.transaction_id, "0003-COMMITTED.json"));
    const otherFile = file === "LEMBRANCA.md" ? "MEMORIA.md" : "LEMBRANCA.md";
    const otherBefore = await readFile(join(fixtureRoot, "work", otherFile));
    const thirdBytes = Buffer.from(`third-version-${slot}\n`);
    await writeFile(join(fixtureRoot, "work", file), thirdBytes);

    const result = await recover(fixtureRoot);

    assertCliError(result, 4, "RECOVERY_CONFLICT");
    assert.deepEqual(await readFile(join(fixtureRoot, "work", file)), thirdBytes);
    assert.deepEqual(await readFile(join(fixtureRoot, "work", otherFile)), otherBefore);
    assert.equal(await latestState(fixtureRoot, createPlan.transaction_id), "L1_PUBLISHED");
  });
}

test("recover treats COMMITTED as a no-op without a new checkpoint", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  assert.equal((await apply(fixtureRoot, createPlan)).exitCode, 0);
  const checkpoints = await transactionFiles(fixtureRoot, createPlan.transaction_id);
  const result = await recover(fixtureRoot);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), expectedReceipt(createPlan, "ALREADY_COMMITTED"));
  assert.deepEqual(await transactionFiles(fixtureRoot, createPlan.transaction_id), checkpoints);
});

test("recover keeps COMMITTED as a no-op even when a target has a third version", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  assert.equal((await apply(fixtureRoot, createPlan)).exitCode, 0);
  const thirdBytes = Buffer.from("post-commit-third-version\n");
  await writeFile(join(fixtureRoot, "work", "LEMBRANCA.md"), thirdBytes);
  const checkpoints = await transactionFiles(fixtureRoot, createPlan.transaction_id);
  const result = await recover(fixtureRoot);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), expectedReceipt(createPlan, "ALREADY_COMMITTED"));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), thirdBytes);
  assert.deepEqual(await transactionFiles(fixtureRoot, createPlan.transaction_id), checkpoints);
});

test("recover keeps ROLLED_BACK as a no-op even when a target has a third version", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  const transactionRoot = join(fixtureRoot, "journal", createPlan.transaction_id);
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: createPlan.transaction_id,
    idempotency_key: createPlan.idempotency_key,
    request_fingerprint: createPlan.request_fingerprint,
    plan_hash: createPlan.plan_hash,
    plan: createPlan
  })}\n`);
  assert.equal((await recover(fixtureRoot)).exitCode, 0);
  const thirdBytes = Buffer.from("post-rollback-third-version\n");
  await writeFile(join(fixtureRoot, "work", "MEMORIA.md"), thirdBytes);
  const checkpoints = await transactionFiles(fixtureRoot, createPlan.transaction_id);
  const result = await recover(fixtureRoot);
  assert.equal(result.exitCode, 0);
  assert.deepEqual(JSON.parse(result.stdout), expectedReceipt(createPlan, "ALREADY_ROLLED_BACK"));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), thirdBytes);
  assert.deepEqual(await transactionFiles(fixtureRoot, createPlan.transaction_id), checkpoints);
});

test("recover rejects absent, ambiguous and corrupt journals without overwriting", async (t) => {
  const absentRoot = await createFixture(t);
  assertCliError(await recover(absentRoot), 4, "RECOVERY_CONFLICT");

  const corruptRoot = await createFixture(t);
  const corruptPlan = await plan(corruptRoot);
  await mkdir(join(corruptRoot, "journal", corruptPlan.transaction_id), { recursive: true });
  await writeFile(join(corruptRoot, "journal", corruptPlan.transaction_id, "0001-PREPARED.json"), "{\n");
  assertCliError(await recover(corruptRoot), 4, "RECOVERY_CONFLICT");

  const ambiguousRoot = await createFixture(t);
  const ambiguousPlan = await plan(ambiguousRoot);
  const secondPlan = await plan(ambiguousRoot, {
    ...createRequest,
    candidate: { ...createRequest.candidate, body: "A distinct but valid plan using the same idempotency key." }
  });
  for (const journalPlan of [ambiguousPlan, secondPlan]) {
    const transactionRoot = join(ambiguousRoot, "journal", journalPlan.transaction_id);
    await mkdir(transactionRoot, { recursive: true });
    await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
      state: "PREPARED",
      transaction_id: journalPlan.transaction_id,
      idempotency_key: journalPlan.idempotency_key,
      request_fingerprint: journalPlan.request_fingerprint,
      plan_hash: journalPlan.plan_hash,
      plan: journalPlan
    })}\n`);
  }
  const ambiguousError = assertCliError(await recover(ambiguousRoot), 4, "RECOVERY_CONFLICT");
  assert.match(ambiguousError.message, /ambiguous/i);
});

test("recover validates checkpoint sequence and identifiers before restoring", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  assert.equal((await apply(fixtureRoot, createPlan)).exitCode, 0);
  const transactionRoot = join(fixtureRoot, "journal", createPlan.transaction_id);
  await rm(join(transactionRoot, "0003-COMMITTED.json"));
  await writeFile(join(transactionRoot, "0003-L1_PUBLISHED.json"), `${JSON.stringify({
    state: "L1_PUBLISHED",
    transaction_id: "ffffffffffffffffffffffff"
  })}\n`);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));

  assertCliError(await recover(fixtureRoot), 4, "RECOVERY_CONFLICT");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
});

test("recover rejects a skipped L1_PUBLISHED checkpoint", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  const transactionRoot = join(fixtureRoot, "journal", createPlan.transaction_id);
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: createPlan.transaction_id,
    idempotency_key: createPlan.idempotency_key,
    request_fingerprint: createPlan.request_fingerprint,
    plan_hash: createPlan.plan_hash,
    plan: createPlan
  })}\n`);
  await writeFile(join(transactionRoot, "0002-COMMITTED.json"), `${JSON.stringify({
    state: "COMMITTED",
    transaction_id: createPlan.transaction_id,
    plan_hash: createPlan.plan_hash
  })}\n`);
  assertCliError(await recover(fixtureRoot), 4, "RECOVERY_CONFLICT");
});

test("recover treats valid JSON with an invalid checkpoint schema as journal corruption", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  const transactionRoot = join(fixtureRoot, "journal", createPlan.transaction_id);
  await mkdir(transactionRoot, { recursive: true });
  await writeFile(join(transactionRoot, "0001-PREPARED.json"), `${JSON.stringify({
    state: "PREPARED",
    transaction_id: createPlan.transaction_id,
    idempotency_key: createPlan.idempotency_key,
    request_fingerprint: createPlan.request_fingerprint,
    plan_hash: createPlan.plan_hash,
    plan: createPlan,
    extra: true
  })}\n`);
  assertCliError(await recover(fixtureRoot), 4, "RECOVERY_CONFLICT");
});

test("recover enforces closed input, stream and subcommand-specific usage contracts", async (t) => {
  const fixtureRoot = await createFixture(t);
  assertCliError(await recover(fixtureRoot, { ...recoverRequest, transaction_id: "aaaaaaaaaaaaaaaaaaaaaaaa" }), 2, "INVALID_SCHEMA");
  assertCliError(await recover(fixtureRoot, { ...recoverRequest, idempotency_key: " " }), 2, "INVALID_SCHEMA");
  assertCliError(await recover(fixtureRoot, { ...recoverRequest, idempotency_key: "x".repeat(257) }), 2, "INVALID_SCHEMA");
  assertCliError(await runCli(["create", "recover", "--fixture", fixtureRoot], "{"), 2, "INVALID_JSON");

  for (const subcommand of ["plan", "apply", "recover"]) {
    const result = await runCli(["create", subcommand], "{}");
    assertCliError(result, 2, "INVALID_USAGE");
    assert.match(JSON.parse(result.stderr).message, new RegExp(`create ${subcommand} --fixture`));
  }
});

test("recover revalidates the fixture marker before reading journals or targets", async (t) => {
  const fixtureRoot = await createFixture(t);
  const beforeL1 = await readFile(join(fixtureRoot, "work", "LEMBRANCA.md"));
  const beforeL2 = await readFile(join(fixtureRoot, "work", "MEMORIA.md"));
  await writeFile(join(fixtureRoot, ".dex-memory-fixture.json"), "{}\n");
  const result = await recover(fixtureRoot);
  assertCliError(result, 3, "SAFETY_BLOCKED");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), beforeL1);
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), beforeL2);
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});

test("a requested failpoint without IPC fails explicitly before journal or target writes", async (t) => {
  const fixtureRoot = await createFixture(t);
  const createPlan = await plan(fixtureRoot);
  const result = await runCli(
    ["create", "apply", "--fixture", fixtureRoot],
    JSON.stringify(createPlan),
    { ...process.env, DEX_MEMORIA_INTERNAL_TEST_FAILPOINT: failpoints[0].name }
  );
  assertCliError(result, 6, "FAILPOINT_UNAVAILABLE");
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "LEMBRANCA.md")), await baseline("LEMBRANCA.md"));
  assert.deepEqual(await readFile(join(fixtureRoot, "work", "MEMORIA.md")), await baseline("MEMORIA.md"));
  await assert.rejects(readdir(join(fixtureRoot, "journal")), { code: "ENOENT" });
});
