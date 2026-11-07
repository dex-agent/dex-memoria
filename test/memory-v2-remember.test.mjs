import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fsPromises from "node:fs/promises";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const cliPath = join(process.cwd(), "bin", "dex-memoria.js");
const require = createRequire(import.meta.url);
const { rememberMemory } = require("../bin/memory-v2-remember.js");
const { executeMemoryRoute } = require("../bin/memory-v2-route-executor.js");
const TEST_PROVENANCE = {
  entrypoint_realpath: cliPath,
  entrypoint_sha256: "a".repeat(64)
};

function runRemember(cwd, memoryHome, request) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, "v2", "remember"], {
      cwd,
      env: { ...process.env, DEX_MEMORIA_HOME: memoryHome },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({
      exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
    child.stdin.end(JSON.stringify(request));
  });
}

async function disposableRoots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-remember-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "consumer");
  const memoryHome = join(root, "memory-home");
  await mkdir(workspace, { recursive: true });
  return { workspace, memoryHome };
}

function dailyRequest(overrides = {}) {
  return {
    scope: "project",
    title: "Entrada cotidiana V2",
    trigger: "Quando um modelo pequeno precisar gravar sem estudar o código",
    body: "Use uma única entrada cotidiana e confira o recibo validado.",
    tags: ["#dex-memoria/entrada-cotidiana"],
    ...overrides
  };
}

test("v2 remember writes and validates one project memory from a small closed request", async (t) => {
  const roots = await disposableRoots(t);
  const result = await runRemember(roots.workspace, roots.memoryHome, dailyRequest());

  assert.equal(result.exitCode, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.contract, "dex.memory.remember.receipt.v2");
  assert.equal(receipt.status, "COMMITTED");
  assert.equal(receipt.normalized_request.contract, "dex.memory.remember.request.v2");
  assert.equal(receipt.normalized_request.target_layer, "L2");
  assert.equal(receipt.normalized_request.workspace_root, roots.workspace);
  assert.equal(receipt.normalized_request.memory_home, roots.memoryHome);
  assert.match(receipt.normalized_request.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{12}$/);
  assert.match(receipt.normalized_request.operation_id, /^remember-[a-f0-9]{24}$/);
  assert.deepEqual(receipt.routes.map((route) => route.scope), ["project"]);
  assert.equal(receipt.validations.project.ok, true);
  assert.equal(receipt.route_receipts.project.status, "COMMITTED");
  assert.equal(receipt.route_receipts.project.validation_ok, true);
  assert.equal(result.stdout.includes("Use uma única entrada cotidiana"), false);
  assert.match(await readFile(join(roots.workspace, ".agents", "lembranca.md"), "utf8"), /Entrada cotidiana V2/);
});

test("v2 remember hides private content from its public receipt", async (t) => {
  const roots = await disposableRoots(t);
  const secretMarker = "PRIVATE-PROBE-MUST-NOT-LEAK";
  const result = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({ body: secretMarker }));
  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.stdout.includes(secretMarker), false);
});

test("v2 remember chooses recover before resume when the pending route requires recovery", async (t) => {
  const roots = await disposableRoots(t);
  let call = 0;
  const receipt = await rememberMemory(dailyRequest({ scope: "dual" }), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route(route) {
      call += 1;
      if (call === 2) return { status: "FAILED", code: "RECOVERY_REQUIRED" };
      return {
        status: "COMMITTED",
        transaction_id: route.transaction_id,
        idempotency_key: route.idempotency_key,
        receipt_id: route.receipt_id,
        receipt_path: join(route.resolved_root, "receipt.json"),
        validation_receipt_path: join(route.resolved_root, "validation.json"),
        validation_receipt_hash: "a".repeat(64),
        validation_contract: "dex.memory.capability.unit-receipt.v2",
        validation_ok: true,
        candidate_id: "b".repeat(64),
        content_hash: "c".repeat(64),
        route_identity: "d".repeat(64),
        write_set_hash: "e".repeat(64)
      };
    }
  });
  assert.equal(receipt.status, "PARTIAL_PENDING");
  const recoveryAction = receipt.recovery.actions.find((entry) => entry.scope === "global");
  assert.ok(recoveryAction.command_input, "action de recovery deve trazer command_input executavel (issue #7)");
  assert.equal(recoveryAction.command_input.contract, "dex.memory.recover.request.v2");
  assert.equal(recoveryAction.command_input.scope, "global");
  assert.deepEqual(receipt.recovery, {
    mode: "recover_then_retry_new_operation",
    actions: [{
      scope: "global",
      failure_code: "RECOVERY_REQUIRED",
      cure: "RECOVER",
      command: "dex-memoria v2 recover",
      command_input: recoveryAction.command_input
    }],
    then_command: "dex-memoria v2 remember",
    next_operation_id: receipt.recovery.next_operation_id
  });
  assert.match(receipt.recovery.next_operation_id, /^remember-retry-[a-f0-9]{24}$/);
});

test("v2 remember retries a physically rolled-back dual sibling with a deterministic new operation", async (t) => {
  const roots = await disposableRoots(t);
  const request = dailyRequest({ scope: "dual", title: "Rollback cotidiano" });
  let failureInjected = false;
  const globalL1 = join(roots.memoryHome, "global", "LEMBRANCA.md");
  const failingFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (!failureInjected && destination === globalL1) {
        failureInjected = true;
        const error = new Error("synthetic L1 publication failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    }
  };
  const first = await rememberMemory(request, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE,
      ...(route.scope === "global" ? { file_system: failingFileSystem } : {})
    })
  });

  assert.equal(first.status, "PARTIAL_PENDING");
  assert.equal(first.route_receipts.global.failure_code, "TRANSACTION_ROLLED_BACK");
  assert.equal(first.route_receipts.global.failure_cause, "EIO");
  assert.equal(first.recovery.mode, "retry_new_operation");
  assert.match(first.recovery.next_operation_id, /^remember-retry-[a-f0-9]{24}$/);

  const retried = await rememberMemory({ ...request, operation_id: first.recovery.next_operation_id }, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE
    })
  });
  assert.equal(retried.status, "COMMITTED");
  assert.equal(retried.route_receipts.project.deduplicated, true);
  assert.equal(retried.route_receipts.global.deduplicated, false);
  assert.equal(retried.validations.project.ok, true);
  assert.equal(retried.validations.global.ok, true);
});

test("v2 remember gives a new deterministic operation after a single route rolls back", async (t) => {
  const roots = await disposableRoots(t);
  const request = dailyRequest({ title: "Rollback single" });
  const projectL1 = join(roots.workspace, ".agents", "lembranca.md");
  let failureInjected = false;
  const failingFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (!failureInjected && destination === projectL1) {
        failureInjected = true;
        const error = new Error("synthetic single-route L1 failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    }
  };
  const failed = await rememberMemory(request, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE,
      file_system: failingFileSystem
    })
  });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.route_receipts.project.failure_code, "TRANSACTION_ROLLED_BACK");
  assert.equal(failed.recovery.mode, "retry_new_operation");
  assert.match(failed.recovery.next_operation_id, /^remember-retry-[a-f0-9]{24}$/);

  const retried = await rememberMemory({ ...request, operation_id: failed.recovery.next_operation_id }, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE
    })
  });
  assert.equal(retried.status, "COMMITTED");
  assert.equal(retried.validations.project.ok, true);
});

test("v2 remember accounts for every pending dual route before retry", async (t) => {
  const roots = await disposableRoots(t);
  const recoverBoth = await rememberMemory(dailyRequest({ scope: "dual" }), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route(route) {
      return { status: "FAILED", code: route.scope === "project" ? "RECOVERY_REQUIRED" : "ROLLBACK_REQUIRED" };
    }
  });
  assert.equal(recoverBoth.status, "FAILED");
  assert.equal(recoverBoth.recovery.mode, "recover_then_retry_new_operation");
  assert.deepEqual(recoverBoth.recovery.actions.map((action) => action.scope), ["project", "global"]);
  assert.deepEqual(recoverBoth.recovery.actions.map((action) => action.command), [
    "dex-memoria v2 recover", "dex-memoria v2 recover"
  ]);
  assert.match(recoverBoth.recovery.next_operation_id, /^remember-retry-[a-f0-9]{24}$/);

  const mixed = await rememberMemory(dailyRequest({ scope: "dual", title: "Pendência mista" }), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route(route) {
      return { status: "FAILED", code: route.scope === "project" ? "ROUTE_CONFLICT" : "ROLLBACK_REQUIRED" };
    }
  });
  assert.equal(mixed.recovery.mode, "manual_resolution");
  assert.deepEqual(mixed.recovery.actions.map((action) => action.failure_code), ["ROUTE_CONFLICT", "ROLLBACK_REQUIRED"]);
  assert.equal(mixed.recovery.actions[0].command, null);
  assert.equal(mixed.recovery.actions[1].command, "dex-memoria v2 recover");
  assert.equal(mixed.recovery.then_command, "dex-memoria v2 remember");
  assert.match(mixed.recovery.next_operation_id, /^remember-retry-[a-f0-9]{24}$/);
});

test("v2 remember is deterministic and retries dual scope without a second write", async (t) => {
  const roots = await disposableRoots(t);
  const request = dailyRequest({ scope: "dual", title: "Memória compartilhada" });
  const first = await runRemember(roots.workspace, roots.memoryHome, request);
  const second = await runRemember(roots.workspace, roots.memoryHome, request);

  assert.equal(first.exitCode, 0, first.stderr);
  assert.equal(second.exitCode, 0, second.stderr);
  const firstReceipt = JSON.parse(first.stdout);
  const secondReceipt = JSON.parse(second.stdout);
  assert.equal(secondReceipt.operation_id, firstReceipt.operation_id);
  assert.deepEqual(secondReceipt.routes.map((route) => route.scope), ["project", "global"]);
  assert.equal(secondReceipt.route_receipts.project.deduplicated, true);
  assert.equal(secondReceipt.route_receipts.global.deduplicated, true);
  assert.equal(secondReceipt.validations.project.ok, true);
  assert.equal(secondReceipt.validations.global.ok, true);
  assert.notEqual(secondReceipt.route_receipts.project.receipt_path, secondReceipt.route_receipts.global.receipt_path);
  assert.notEqual(secondReceipt.route_receipts.project.validation_receipt_path, secondReceipt.route_receipts.global.validation_receipt_path);
  assert.notEqual(secondReceipt.route_receipts.project.route_identity, secondReceipt.route_receipts.global.route_identity);
});

test("v2 remember preserves global L2 and theme L3 routes", async (t) => {
  const roots = await disposableRoots(t);
  const globalResult = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({
    scope: "global",
    title: "Memória global cotidiana"
  }));
  const themeResult = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({
    scope: "theme",
    theme: "dex-memoria",
    target_layer: "L3",
    owner_skill: "dex-memoria",
    title: "Conhecimento temático cotidiano"
  }));

  assert.equal(globalResult.exitCode, 0, globalResult.stderr);
  assert.equal(themeResult.exitCode, 0, themeResult.stderr);
  const globalReceipt = JSON.parse(globalResult.stdout);
  const themeReceipt = JSON.parse(themeResult.stdout);
  assert.deepEqual(globalReceipt.routes.map((route) => route.scope), ["global"]);
  assert.equal(globalReceipt.validations.global.ok, true);
  assert.deepEqual(themeReceipt.routes.map((route) => route.scope), ["theme"]);
  assert.equal(themeReceipt.normalized_request.target_layer, "L3");
  assert.equal(themeReceipt.normalized_request.owner_skill, "dex-memoria");
  assert.equal(themeReceipt.validations.theme.ok, true);
});

test("v2 remember rejects unsafe implicit choices instead of guessing", async (t) => {
  const roots = await disposableRoots(t);
  const missingScope = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({ scope: undefined }));
  const missingOwner = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({ target_layer: "L3" }));

  assert.equal(missingScope.exitCode, 2);
  assert.match(missingScope.stderr, /INVALID_REMEMBER_REQUEST.*scope/i);
  assert.equal(missingOwner.exitCode, 2);
  assert.match(missingOwner.stderr, /INVALID_REMEMBER_REQUEST.*owner_skill/i);
});

test("v2 remember: campo desconhecido ensina campos validos e aponta --schema", async (t) => {
  const roots = await disposableRoots(t);
  const badField = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({ campo_desconhecido: 1 }));

  assert.equal(badField.exitCode, 2);
  assert.match(badField.stderr, /INVALID_REMEMBER_REQUEST/);
  assert.match(badField.stderr, /unknown fields: campo_desconhecido/);
  assert.match(badField.stderr, /campos validos:/);
  assert.match(badField.stderr, /--schema/);
});

test("v2 remember reuses canonical candidate limits before any route executes", async (t) => {
  const roots = await disposableRoots(t);
  let calls = 0;
  const options = {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() { calls += 1; }
  };
  for (const request of [
    dailyRequest({ title: "linha um\nlinha dois" }),
    dailyRequest({ trigger: "gatilho\u0000invalido" }),
    dailyRequest({ body: "x".repeat(65537) }),
    dailyRequest({ target_layer: "L3", owner_skill: "Owner Invalido" })
  ]) {
    await assert.rejects(() => rememberMemory(request, options), (error) => error.code === "INVALID_CANDIDATE");
  }
  assert.equal(calls, 0);
});

test("v2 remember does not fabricate writer identities when every route fails", async (t) => {
  const roots = await disposableRoots(t);
  const receipt = await rememberMemory(dailyRequest(), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() { return { status: "FAILED", code: "ROUTE_CONFLICT" }; }
  });
  assert.equal(receipt.status, "FAILED");
  assert.equal(receipt.candidate_id, null);
  assert.equal(receipt.content_hash, null);
  assert.deepEqual(receipt.recovery, {
    mode: "manual_resolution",
    actions: [{
      scope: "project",
      failure_code: "ROUTE_CONFLICT",
      cure: "MANUAL",
      command: null
    }]
  });
});

test("the installed bridge and canonical skill expose remember without mandatory development reading", async () => {
  const [skill, redirector, openai] = await Promise.all([
    readFile(join(process.cwd(), "SKILL.md"), "utf8"),
    readFile(join(process.cwd(), "registry", "agents-skills", "dex-memoria", "SKILL.md"), "utf8"),
    readFile(join(process.cwd(), "registry", "agents-skills", "dex-memoria", "agents", "openai.yaml"), "utf8")
  ]);
  const dailyPrefix = skill.split("\n").slice(0, 120).join("\n");
  assert.match(dailyPrefix, /dex-memoria v2 remember/);
  assert.match(dailyPrefix, /scope.*project.*global.*theme.*dual/is);
  for (const surface of [skill, redirector, openai]) {
    assert.doesNotMatch(surface, /leia (?:completamente|integralmente)/i);
  }
  assert.doesNotMatch(dailyPrefix, /abra.*SPEC\.md|abra.*docs\/usage\.md|abra.*runtime-boundary/i);
});

test("the public remember receipt schema closes nested output and excludes private payload", async () => {
  const schema = JSON.parse(await readFile(join(
    process.cwd(), "contracts", "schemas", "dex.memory.remember.receipt.v2.schema.json"
  ), "utf8"));
  const normalized = schema.properties.normalized_request;

  assert.equal(schema.additionalProperties, false);
  assert.equal(normalized.additionalProperties, false);
  for (const privateField of ["body", "title", "trigger", "tags"]) {
    assert.equal(Object.hasOwn(normalized.properties, privateField), false);
  }
  assert.equal(
    schema.properties.routes.$ref,
    "dex.memory.operation.plan.v2.schema.json#/properties/routes"
  );
  assert.equal(
    schema.properties.route_receipts.$ref,
    "dex.memory.operation.receipt.v2.schema.json#/properties/route_receipts"
  );
  assert.equal(schema.properties.validations.additionalProperties.oneOf.length, 2);
  const recoveryObject = schema.properties.recovery.oneOf.find((variant) => variant.type === "object");
  assert.deepEqual(recoveryObject.required, ["mode", "actions"]);
  assert.equal(recoveryObject.additionalProperties, false);
  assert.equal(recoveryObject.properties.actions.minItems, 1);
  assert.equal(recoveryObject.properties.actions.maxItems, 2);
  assert.equal(recoveryObject.properties.actions.items.additionalProperties, false);
  assert.deepEqual(recoveryObject.properties.actions.items.required, ["scope", "failure_code", "cure", "command"]);
});
