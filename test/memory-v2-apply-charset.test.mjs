import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { planMemoryOperation } = require("../bin/memory-v2-runtime-core.js");
const cliPath = join(process.cwd(), "bin", "dex-memoria.js");

function runCli(cwd, memoryHome, args, stdinPayload) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
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
    child.stdin.end(stdinPayload === undefined ? "" : JSON.stringify(stdinPayload));
  });
}

async function disposableRoots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memoria-apply-charset-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace_root = join(root, "workspace");
  const memory_home = join(root, "memory-home");
  await mkdir(workspace_root, { recursive: true });
  await mkdir(memory_home, { recursive: true });
  return { root, workspace_root, memory_home };
}

function operationRequestFor(testRoots, overrides = {}) {
  return {
    contract: "dex.memory.operation.request.v2",
    implementation_version: "v2",
    scope: "project",
    workspace_root: testRoots.workspace_root,
    memory_home: testRoots.memory_home,
    operation_id: "op-apply-charset-001",
    ...overrides
  };
}

function mmCandidate(overrides = {}) {
  return {
    contract: "dex.memory.write.candidate.v2",
    target_layer: "L2",
    slug: "resolver-tema-identifica-a-edicao-pela-raiz",
    trigger: "resolver tema entrega o reconciled da EDICAO DA RAIZ (tema multi-edicao)",
    title: "resolver tema entrega o reconciled da edicao da raiz",
    body: "Corpo neutro do caso shape-MM pago em 2026-11-10.",
    tags: ["#graphify/consumo"],
    ...overrides
  };
}

function applyPayload(testRoots, candidate, operationId) {
  return {
    contract: "dex.memory.apply.request.v2",
    request: operationRequestFor(testRoots, { operation_id: operationId }),
    candidate
  };
}

// Regressao ISSUES: ISSUE-LOCAL-0001 reaberta 2026-11-10 — o guard do PR #21 mora
// apenas em normalizeRememberRequest (porta CLI remember); a rota MM (PPIRTV
// adapter -> dex-memoria v2 apply) cruza executeMemoryRoute/validateCandidate sem
// guard e o trigger cru rolou back com MISSING_BACKLINK em vez de rejeicao limpa.
test("v2 apply rejeita title/trigger com metacaracteres L1 (rota MM), citando o caractere, sem journal", async (t) => {
  const testRoots = await disposableRoots(t);
  const cases = [
    { field: "trigger", value: "resolver tema entrega o reconciled da raiz ^{slug}-[hash8]$ (ISSUE-0003)" },
    { field: "trigger", value: "padrao ^circunflexo inline" },
    { field: "trigger", value: "padrao [colchete] inline" },
    { field: "title", value: "raiz ^{slug}-[hash8]$ documental" }
  ];
  let index = 0;
  for (const { field, value } of cases) {
    index += 1;
    const result = await runCli(
      testRoots.workspace_root,
      testRoots.memory_home,
      ["v2", "apply"],
      applyPayload(testRoots, mmCandidate({ [field]: value }), `op-apply-charset-rej-${index}`)
    );
    assert.notEqual(result.exitCode, 0, `${field}: deve falhar (stdout: ${result.stdout.slice(0, 200)})`);
    assert.match(result.stderr, /cannot represent/i, `${field}: mensagem deve explicar o motivo (stderr: ${result.stderr.slice(0, 300)})`);
    assert.ok(result.stderr.includes("^") || result.stderr.includes("[") || result.stderr.includes("]"),
      `${field}: mensagem deve citar o caractere ofensivo (stderr: ${result.stderr.slice(0, 300)})`);
    assert.match(result.stderr, /docs\/usage|charset/i, `${field}: mensagem deve apontar o contrato documentado`);
    const route = planMemoryOperation(operationRequestFor(testRoots)).routes[0];
    assert.equal(existsSync(join(route.resolved_root, ".dex-memoria", "transactions")), false,
      `${field}: rejeicao em estagio de request nao cria journal`);
  }
});

test("v2 apply controles: $ { } ( ) no trigger/title (nao-breakers do caso pago) commitam normal", async (t) => {
  const testRoots = await disposableRoots(t);
  const result = await runCli(
    testRoots.workspace_root,
    testRoots.memory_home,
    ["v2", "apply"],
    applyPayload(testRoots, mmCandidate({
      trigger: "padrao {slug} custo $0 (verdade) sobrevive",
      title: "edicao da raiz {hash8} $0 (BCS)"
    }), "op-apply-charset-ok")
  );
  assert.equal(result.exitCode, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.status, "COMMITTED", `esperado COMMITTED (receipt: ${result.stdout.slice(0, 300)})`);
});
