import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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

function runRemember(cwd, memoryHome, request) {
  return runCli(cwd, memoryHome, ["v2", "remember"], request);
}

async function disposableRoots(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-charset-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "consumer");
  const memoryHome = join(root, "memory-home");
  await mkdir(workspace, { recursive: true });
  await mkdir(memoryHome, { recursive: true });
  return { workspace, memoryHome };
}

function dailyRequest(overrides = {}) {
  return {
    scope: "project",
    title: "Titulo neutro do charset",
    trigger: "Quando testar charset de title e trigger",
    body: "Corpo neutro do charset.",
    tags: ["#dex-memoria/charset"],
    ...overrides
  };
}

const FORBIDDEN = [
  { label: "colchete abre", char: "[" },
  { label: "colchete fecha", char: "]" },
  { label: "circunflexo", char: "^" },
  { label: "quebra de linha", char: "\n" },
  { label: "retorno de carro", char: "\r" }
];

test("guard rejeita title/trigger com metacaracteres que o formato L1 nao representa, citando o caractere", async (t) => {
  const roots = await disposableRoots(t);
  for (const field of ["title", "trigger"]) {
    for (const { label, char } of FORBIDDEN) {
      const value = `Valor com ${char} inline`;
      const result = await runRemember(roots.workspace, roots.memoryHome, dailyRequest({ [field]: value }));
      assert.notEqual(result.exitCode, 0, `${field}/${label}: deve falhar (stdout: ${result.stdout.slice(0, 200)})`);
      assert.match(result.stderr, /cannot represent/i, `${field}/${label}: mensagem deve explicar o motivo`);
      assert.ok(result.stderr.includes(char.trim()) || (char === "\n" && result.stderr.includes("quebra")),
        `${field}/${label}: mensagem deve citar o caractere ofensivo (stderr: ${result.stderr.slice(0, 200)})`);
      assert.match(result.stderr, /docs\/usage|charset/i, `${field}/${label}: mensagem deve apontar o contrato documentado`);
      const transactions = join(roots.workspace, ".agents", ".dex-memoria", "transactions");
      assert.equal(existsSync(transactions), false, `${field}/${label}: rejeicao em estagio de request nao cria journal`);
    }
  }
});

test("controles: pipe e angle brackets no title, e colchete no BODY, commitam normal (anti-exemplo da hipotese refutada)", async (t) => {
  const roots = await disposableRoots(t);
  const cases = [
    { title: "Titulo com | pipe sobrevive" },
    { title: "Titulo com <trilho> sobrevive" },
    { title: "Titulo com (parenteses) sobrevive" },
    { body: "Corpo com ] colchete e <trilho> sobrevive" }
  ];
  for (const overrides of cases) {
    const result = await runRemember(roots.workspace, roots.memoryHome, dailyRequest(overrides));
    assert.equal(result.exitCode, 0, result.stderr);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.status, "COMMITTED", `esperado COMMITTED para ${JSON.stringify(overrides).slice(0, 60)}`);
  }
});

test("MISSING_BACKLINK denuncia a causa com unitSlug e linha L1 esperada (Provide Context)", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-ctx-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const slug = "probe-bug-colchete";
  await mkdir(join(root, "memorias"), { recursive: true });
  await writeFile(join(root, "lembranca.md"), [
    "# Lembranças",
    "",
    `- gatilho -> [Titulo com ] colchete](memorias/${slug}.md) [[memorias/${slug}|Titulo com ] colchete]] #dex-memoria/charset ^${slug}`,
    ""
  ].join("\n"), "utf8");
  await writeFile(join(root, "memorias", `${slug}.md`), [
    "---",
    "implementation_version: v2",
    "layer: L2",
    `slug: ${slug}`,
    "tags:",
    "  - \"#dex-memoria/charset\"",
    "---",
    "",
    "# Titulo com ] colchete",
    "",
    "Corpo neutro.",
    "",
    "#dex-memoria/charset",
    "",
    "[Voltar às lembranças](../lembranca.md) [[lembranca|Lembranças]]",
    "",
    `^${slug}-content`,
    ""
  ].join("\n"), "utf8");

  const result = await runCli(root, root, ["v2", "validate"], {
    capability: "v2-obsidian",
    require_obsidian: true,
    root,
    touched_paths: ["lembranca.md", `memorias/${slug}.md`]
  });
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.ok, false, "par com ] no title deve reprovar");
  const missing = receipt.errors.find((e) => e.code === "MISSING_BACKLINK");
  assert.ok(missing, `esperado MISSING_BACKLINK (erros: ${JSON.stringify(receipt.errors).slice(0, 200)})`);
  assert.ok(missing.message.includes(`unit: ${slug}`), `mensagem deve citar a unidade (atual: ${missing.message})`);
  assert.ok(missing.message.includes(`^${slug}`), `mensagem deve citar o sufixo esperado da linha L1 (atual: ${missing.message})`);
});
