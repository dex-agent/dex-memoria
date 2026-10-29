import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const cli = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "bin", "dex-memoria.js");

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], { encoding: "utf8" });
}

function docTable() {
  return require("../bin/cli-doc.js").COMMAND_DOC;
}

test("C-01: v2 remember --help termina exit 0 com usage de mais de 1 linha", () => {
  const proc = run("v2", "remember", "--help");
  assert.equal(proc.status, 0, `stdout=${proc.stdout}\nstderr=${proc.stderr}`);
  const lines = proc.stdout.trim().split(/\r?\n/);
  assert.ok(lines.length > 1, "usage deve ter mais de 1 linha");
  assert.match(proc.stdout, /v2 remember/);
});

test("C-04: v2 remember -h e alias de --help com exit 0", () => {
  const proc = run("v2", "remember", "-h");
  assert.equal(proc.status, 0, `stdout=${proc.stdout}\nstderr=${proc.stderr}`);
  assert.match(proc.stdout, /v2 remember/);
});

test("C-02: v2 remember --schema termina exit 0 e emite JSON valido", () => {
  const proc = run("v2", "remember", "--schema");
  assert.equal(proc.status, 0, `stdout=${proc.stdout}\nstderr=${proc.stderr}`);
  const parsed = JSON.parse(proc.stdout);
  assert.ok(parsed.fields && parsed.fields.scope, "schema deve descrever o contrato do payload stdin");
});

test("C-03: v2 remember --usage termina exit 0 com exemplos", () => {
  const proc = run("v2", "remember", "--usage");
  assert.equal(proc.status, 0, `stdout=${proc.stdout}\nstderr=${proc.stderr}`);
  assert.match(proc.stdout, /v2 remember/);
});

test("C-07: doctor --help mostra help e NAO executa o doctor", () => {
  const proc = run("doctor", "--help");
  assert.equal(proc.status, 0, `stdout=${proc.stdout}\nstderr=${proc.stderr}`);
  assert.match(proc.stdout, /doctor/);
  assert.ok(!proc.stdout.includes("Pacote:"), "doctor --help nao pode rodar o diagnostico");
});

test("C-05: o usage e o schema exibidos derivam da tabela COMMAND_DOC", () => {
  const table = docTable();
  const entry = table["v2 remember"];
  assert.ok(entry, "COMMAND_DOC deve ter entrada v2 remember");

  const help = run("v2", "remember", "--help");
  assert.equal(help.status, 0);
  for (const line of entry.usage) {
    assert.ok(help.stdout.includes(line), `usage deve derivar da tabela: ${line}`);
  }

  const schema = run("v2", "remember", "--schema");
  assert.equal(schema.status, 0);
  assert.deepEqual(JSON.parse(schema.stdout), entry.schema);
});

test("C-08: parametro inexistente aponta a rota de descoberta (--help) no erro", () => {
  const root = run("comando-inexistente");
  assert.notEqual(root.status, 0);
  assert.match(root.stderr + root.stdout, /--help/, "erro de comando desconhecido deve indicar --help");

  const sub = run("v2", "subcomando-inexistente");
  assert.notEqual(sub.status, 0);
  assert.match(sub.stderr + sub.stdout, /--help/, "erro de subcomando deve indicar --help");

  const flag = run("--parametro-inexistente");
  assert.notEqual(flag.status, 0);
  assert.match(flag.stderr + flag.stdout, /--help/, "erro de flag desconhecida deve indicar --help");
});

test("grupos e raiz: v2 --help, create plan --help e --help raiz respondem exit 0", () => {
  const group = run("v2", "--help");
  assert.equal(group.status, 0, `stdout=${group.stdout}\nstderr=${group.stderr}`);
  assert.match(group.stdout, /v2 remember/);

  const sub = run("create", "plan", "--help");
  assert.equal(sub.status, 0, `stdout=${sub.stdout}\nstderr=${sub.stderr}`);
  assert.match(sub.stdout, /create plan/);

  const root = run("--help");
  assert.equal(root.status, 0);
  assert.match(root.stdout, /dex-memoria/);
});
