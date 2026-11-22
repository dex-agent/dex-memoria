import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import * as fsPromises from "node:fs/promises";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

// issue #10 F6/F7: fluxo DUAL command_input -> recover -> retry travado por
// regressao (adaptacao dual do irmão single-scope de recovery-actionable) e
// guidance no receipt do v2 recover de 2º nivel (JOURNAL_CONFLICT).

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
  const root = await mkdtemp(join(tmpdir(), "dex-memory-dual-recover-retry-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "consumer");
  const memoryHome = join(root, "memory-home");
  await mkdir(workspace, { recursive: true });
  return { workspace, memoryHome };
}

function dualRequest(overrides = {}) {
  return {
    scope: "dual",
    title: "Dual recover retry travado",
    trigger: "Quando o fluxo dual command_input recover retry precisa de regressao dedicada",
    body: "A variante dual do loop de recovery deve terminar COMMITTED nas duas rotas.",
    tags: ["#dex-memoria/dual-recover-retry"],
    ...overrides
  };
}

// Filesystem sintetico com rollback NAO-terminal: a publicacao da L1 falha e a
// limpeza do diretorio de memorias tambem falha, deixando journal + destinos
// publicados exigindo recover explicito (RECOVERY_REQUIRED/ROLLBACK_REQUIRED).
function nonTerminalRollbackFileSystem(l1Path, memoriasPath) {
  let l1Failed = false;
  let memoriasFailed = false;
  return {
    ...fsPromises,
    async rename(source, destination) {
      if (!l1Failed && destination === l1Path) {
        l1Failed = true;
        const error = new Error("synthetic publish failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rename(source, destination);
    },
    async rm(target) {
      if (l1Failed && !memoriasFailed && target === memoriasPath) {
        memoriasFailed = true;
        const error = new Error("synthetic rollback failure");
        error.code = "EIO";
        throw error;
      }
      return fsPromises.rm(target);
    }
  };
}

async function findJournalFile(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const found = await findJournalFile(entryPath);
      if (found) return found;
    } else if (entry.name === "journal.json") {
      return entryPath;
    }
  }
  return null;
}

test("dual recover then retry commits both routes via command_input (issue #10 F6)", async (t) => {
  const roots = await disposableRoots(t);
  const projectL1 = join(roots.workspace, ".agents", "lembranca.md");
  const projectMemorias = join(roots.workspace, ".agents", "memorias");

  const failed = await rememberMemory(dualRequest(), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE,
      file_system: nonTerminalRollbackFileSystem(projectL1, projectMemorias)
    })
  });
  assert.equal(failed.status, "PARTIAL_PENDING", "falha sintetica nao-terminal na rota project deixa o dual parcial");
  assert.equal(failed.recovery?.mode, "recover_then_retry_new_operation");
  const projectAction = failed.recovery?.actions?.find((entry) => entry.scope === "project");
  assert.equal(projectAction?.failure_code, "ROLLBACK_REQUIRED");
  assert.ok(projectAction?.command_input, "action de recover dual deve trazer command_input executavel as-is");

  const recovered = await runCli(["v2", "recover"], roots.memoryHome, projectAction.command_input);
  assert.equal(recovered.exitCode, 0, recovered.stderr || recovered.stdout);
  const recoveredReceipt = JSON.parse(recovered.stdout);
  assert.equal(recoveredReceipt.status, "ROLLED_BACK", "recover dual deve terminar ROLLED_BACK na rota project");

  const committed = await rememberMemory(
    { ...dualRequest(), operation_id: failed.recovery.next_operation_id },
    {
      cwd: roots.workspace,
      memory_home: roots.memoryHome,
      execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
        producer_provenance: TEST_PROVENANCE
      })
    }
  );
  assert.equal(committed.status, "COMMITTED", "retry dual com operation_id novo deve commitar");
  const committedScopes = committed.routes.map((route) => route.scope).sort();
  assert.deepEqual(committedScopes, ["global", "project"], "dual commitado precisa das duas rotas");
  for (const routeReceipt of Object.values(committed.route_receipts)) {
    assert.equal(routeReceipt.status, "COMMITTED");
  }
});

test("v2 recover of a second level journal conflict carries guidance (issue #10 F7)", async (t) => {
  const roots = await disposableRoots(t);
  const globalL1 = join(roots.memoryHome, "global", "LEMBRANCA.md");
  const globalMemorias = join(roots.memoryHome, "global", "memorias");

  const failed = await rememberMemory(dualRequest({ scope: "global", title: "Journal de outra operacao" }), {
    cwd: roots.workspace,
    memory_home: roots.memoryHome,
    execute_route: (route, candidate) => executeMemoryRoute(route, candidate, {
      producer_provenance: TEST_PROVENANCE,
      file_system: nonTerminalRollbackFileSystem(globalL1, globalMemorias)
    })
  });
  assert.equal(failed.status, "FAILED");
  const action = failed.recovery?.actions?.find((entry) => entry.scope === "global");
  assert.equal(action?.failure_code, "ROLLBACK_REQUIRED");
  assert.ok(action?.command_input, "action de recover deve trazer command_input");

  // 2º nível: o journal gravado no disco passa a pertencer a outra operação
  // (mutação de concorrência/terceiro) — o recover com command_input íntegro
  // re-falha JOURNAL_CONFLICT e o receipt precisa carregar guidance própria.
  const journalPath = await findJournalFile(roots.memoryHome);
  assert.ok(journalPath, "journal da transação deve existir no memory home");
  const journal = JSON.parse(await fsPromises.readFile(journalPath, "utf8"));
  journal.route.operation_id = "remember-second-level-mutated";
  await fsPromises.writeFile(journalPath, JSON.stringify(journal));

  const secondLevel = await runCli(["v2", "recover"], roots.memoryHome, action.command_input);
  assert.equal(secondLevel.exitCode, 5, "recover contra journal alheio deve falhar com exit 5");
  const receipt = JSON.parse(secondLevel.stdout);
  assert.equal(receipt.code, "JOURNAL_CONFLICT");
  assert.ok(
    receipt.guidance && receipt.guidance.mode === "manual_resolution",
    "receipt FAILED do recover de 2º nível deve carregar guidance com mode manual (issue #10 F7 — sem resolução manual muda)"
  );
  assert.ok(
    typeof receipt.guidance.message === "string" && receipt.guidance.message.includes("reissue"),
    "guidance deve documentar a rota manual (restaurar ou reemitir com nova operation_id)"
  );
  assert.ok(receipt.guidance.journal_path, "guidance deve referenciar o journal divergente");
});
