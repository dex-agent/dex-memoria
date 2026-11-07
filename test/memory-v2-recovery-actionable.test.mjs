import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fsPromises from "node:fs/promises";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
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

function runCli(args, memoryHome, stdinPayload) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
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
    child.stdin.end(JSON.stringify(stdinPayload));
  });
}

async function disposableRoots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-recovery-actionable-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "consumer");
  const memoryHome = join(root, "memory-home");
  await mkdir(workspace, { recursive: true });
  return { workspace, memoryHome };
}

function dailyRequest(overrides = {}) {
  return {
    scope: "global",
    title: "Entrada com journal conflitante",
    trigger: "Quando o journal de rota simples entra em conflito e o loop precisa de cura acionavel",
    body: "A cura deve chegar no receipt com comando e entrada executaveis, sem resolucao manual muda.",
    tags: ["#dex-memoria/recovery-acionavel"],
    ...overrides
  };
}

test("journal conflict yields actionable recovery guidance instead of silent manual resolution", async (t) => {
  const roots = await disposableRoots(t);

  const receipt = await rememberMemory(dailyRequest(), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() {
      return { status: "FAILED", code: "JOURNAL_CONFLICT", message: "stored journal does not belong to this route" };
    }
  });

  assert.equal(receipt.status, "FAILED");
  const action = receipt.recovery?.actions?.find((entry) => entry.scope === "global");
  assert.ok(action, "deve existir action para a rota global");
  assert.equal(action.failure_code, "JOURNAL_CONFLICT");
  assert.equal(action.command, "dex-memoria v2 recover", "JOURNAL_CONFLICT deve entregar o comando de recover (nunca null)");
  assert.ok(
    action.command_input && action.command_input.contract === "dex.memory.recover.request.v2",
    "command_input deve carregar o contrato de stdin do v2 recover"
  );
  assert.equal(action.command_input.scope, "global");
  assert.ok(action.command_input.request && action.command_input.request.operation_id, "command_input.request deve reproduzir o plano da operacao");
  assert.equal(receipt.recovery.mode, "recover_then_retry_new_operation");
  assert.match(receipt.recovery.next_operation_id ?? "", /^remember-/, "deve oferecer operation_id novo para o retry");
});

test("idempotency conflict yields retry_new_operation with next_operation_id", async (t) => {
  const roots = await disposableRoots(t);

  const receipt = await rememberMemory(dailyRequest(), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() {
      return { status: "FAILED", code: "IDEMPOTENCY_CONFLICT", message: "idempotency key belongs to another request" };
    }
  });

  assert.equal(receipt.status, "FAILED");
  const action = receipt.recovery?.actions?.find((entry) => entry.scope === "global");
  assert.equal(action.failure_code, "IDEMPOTENCY_CONFLICT");
  assert.equal(receipt.recovery.mode, "retry_new_operation", "conflito de idempotencia se cura com operation_id novo, sem recover");
  assert.equal(action.command, null, "IDEMPOTENCY_CONFLICT nao exige recover");
  assert.match(receipt.recovery.next_operation_id ?? "", /^remember-/, "deve oferecer operation_id novo (fecha o dead-end da revisao adversarial)");
  assert.equal(receipt.recovery.then_command, "dex-memoria v2 remember");
});

test("route busy yields retry_same_operation with then_command and no next_operation_id", async (t) => {
  const roots = await disposableRoots(t);
  const receipt = await rememberMemory(dailyRequest(), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route() {
      return { status: "FAILED", code: "ROUTE_BUSY", message: "route mutex is held by another writer" };
    }
  });
  assert.equal(receipt.status, "FAILED");
  const action = receipt.recovery.actions.find((entry) => entry.scope === "global");
  assert.equal(action.failure_code, "ROUTE_BUSY");
  assert.equal(action.command, null, "ROUTE_BUSY nao exige recover");
  assert.equal(action.failure_message, "route mutex is held by another writer", "message do executor deve chegar na action");
  assert.equal(receipt.recovery.mode, "retry_same_operation", "transiente se cura repetindo a MESMA operacao");
  assert.equal(receipt.recovery.then_command, "dex-memoria v2 remember");
  assert.equal(receipt.recovery.next_operation_id, undefined, "retry da mesma operacao nao oferta id novo");
});

test("recover then retry commits after a non-terminal journal loop", async (t) => {
  const roots = await disposableRoots(t);
  const request = dailyRequest();
  const globalRoot = join(roots.memoryHome, "global");
  const l1Path = join(globalRoot, "LEMBRANCA.md");
  let l1PublishFailed = false;
  let rollbackRemovalFailed = false;
  const failingFileSystem = {
    ...fsPromises,
    async rename(source, destination) {
      if (!l1PublishFailed && destination === l1Path) {
        l1PublishFailed = true;
        const error = new Error("synthetic publish transport failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    },
    async rm(target, options) {
      if (l1PublishFailed && !rollbackRemovalFailed && target.startsWith(join(globalRoot, "memorias"))) {
        rollbackRemovalFailed = true;
        const error = new Error("synthetic rollback transport failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rm(target, options);
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
  assert.equal(failed.route_receipts.global.failure_code, "ROLLBACK_REQUIRED");

  const retried = await rememberMemory(request, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE
    })
  });
  assert.equal(retried.status, "FAILED");
  const action = retried.recovery?.actions?.find((entry) => entry.scope === "global");
  assert.ok(action?.command_input, "a action de recovery deve trazer command_input executavel as-is");
  assert.equal(retried.recovery.mode, "recover_then_retry_new_operation");

  const recovered = await runCli(["v2", "recover"], roots.memoryHome, action.command_input);
  assert.equal(recovered.exitCode, 0, recovered.stderr || recovered.stdout);
  const recoveredReceipt = JSON.parse(recovered.stdout);
  assert.equal(recoveredReceipt.status, "ROLLED_BACK", "recover bem-sucedido reporta status ROLLED_BACK");
  assert.ok(
    ["ROLLED_BACK", "ALREADY_ROLLED_BACK"].includes(recoveredReceipt.recovery_status ?? recoveredReceipt.status),
    "journal deve terminar ROLLED_BACK apos o recover do command_input"
  );

  const committed = await rememberMemory({ ...request, operation_id: retried.recovery.next_operation_id }, {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE
    })
  });
  assert.equal(committed.status, "COMMITTED", "retry com operation_id novo deve commitar — fim do loop do issue #7");
});
