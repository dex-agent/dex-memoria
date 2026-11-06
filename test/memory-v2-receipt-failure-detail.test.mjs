import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const cliPath = join(process.cwd(), "bin", "dex-memoria.js");

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
  const root = await mkdtemp(join(tmpdir(), "dex-memory-receipt-detail-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "consumer");
  const memoryHome = join(root, "memory-home");
  await mkdir(workspace, { recursive: true });
  return { workspace, memoryHome };
}

test("v2 remember FAILED receipt echoes the real validation errors in failure.detail", async (t) => {
  const roots = await disposableRoots(t);
  const result = await runRemember(roots.workspace, roots.memoryHome, {
    scope: "project",
    title: "Entrada com hashtag de exemplo no corpo",
    trigger: "Quando um corpo de L2 cita uma hashtag de exemplo e a validacao reprova",
    body: "O formato de tags usa #tema/assunto como hashtag de exemplo solta no meio do corpo, e essa hashtag entra no conjunto real de tags do L2 divergindo do L1.",
    tags: ["#dex-memoria/teste-receipt-detail"]
  });

  assert.notEqual(result.exitCode, 0, "write reprovado deve encerrar com exit != 0");
  const raw = result.stdout.trim() || result.stderr.trim();
  assert.ok(raw.length > 0, "CLI deve emitir o receipt de falha");
  const receipt = JSON.parse(raw);
  assert.equal(receipt.status, "FAILED");
  const route = receipt.route_receipts?.project ?? receipt;
  assert.ok(["FAILED", "PENDING"].includes(route.status), `rota deve reportar falha (FAILED/PENDING), veio ${route.status}`);
  assert.equal(route.failure_code, "TRANSACTION_ROLLED_BACK");
  assert.equal(
    Array.isArray(route.failure?.detail?.validation_errors) && route.failure.detail.validation_errors.length > 0,
    true,
    "receipt FAILED deve ecoar failure.detail.validation_errors reais (issue #3)"
  );
  assert.match(
    JSON.stringify(route.failure.detail.validation_errors),
    /DIVERGENT_TAG_SET|MISSING_NESTED_TAG|INVALID_TAG/,
    "os codigos ecoados devem ser os reais do validador, nao o generico"
  );
});
