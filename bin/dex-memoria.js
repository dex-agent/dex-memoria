#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { planCreate } = require("./create-plan");
const { ApplyError, applyCreate } = require("./create-apply");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const REDIRECTOR_ENTRY = path.join("registry", "agents-skills", "dex-memoria", "SKILL.md");
const COPY_ENTRIES = [
  "SKILL.md",
  "SPEC.md",
  "README.md",
  "CHANGELOG.md",
  "DECISIONS.md",
  "VERSION",
  "package.json",
  "bin",
  "contracts",
  "docs",
  "registry",
  "templates",
  "examples"
];
const MAX_STDIN_BYTES = 1024 * 1024;
const FIXTURE_TARGETS = ["work/LEMBRANCA.md", "work/MEMORIA.md"];

class CliError extends Error {
  constructor(exitCode, code, message) {
    super(message);
    this.exitCode = exitCode;
    this.code = code;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "version" || command === "--version" || command === "-v") {
    console.log(readVersion());
    return;
  }

  if (command === "doctor") {
    doctor();
    return;
  }

  if (command === "memory-home") {
    printMemoryHome();
    return;
  }

  if (command === "install") {
    install(args.slice(1));
    return;
  }

  if (command === "create") {
    try {
      if (args[1] === "plan") {
        await createPlan(args.slice(2));
      } else if (args[1] === "apply") {
        await createApply(args.slice(2));
      } else {
        throw new CliError(2, "INVALID_USAGE", "usage: dex-memoria create plan|apply --fixture <fixture-root>");
      }
    } catch (error) {
      if (error instanceof CliError || error instanceof ApplyError) {
        throw error;
      }
      throw new CliError(6, "IO_FAILURE", `create ${args[1] || "command"} failed`);
    }
    return;
  }

  fail(`Comando desconhecido: ${command}`);
}

async function createApply(args) {
  const fixtureRoot = parseFixtureArg(args);
  const { targetPaths } = validateFixture(fixtureRoot);
  const input = await readStdin();
  let plan;
  try {
    plan = JSON.parse(input);
  } catch (error) {
    throw new CliError(2, "INVALID_JSON", "stdin must contain exactly one valid JSON document");
  }
  const receipt = await applyCreate(plan, fixtureRoot, targetPaths);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function createPlan(args) {
  const fixtureRoot = parseFixtureArg(args);
  const { marker, targetPaths } = validateFixture(fixtureRoot);
  const input = await readStdin();
  let request;
  try {
    request = JSON.parse(input);
  } catch (error) {
    throw new CliError(2, "INVALID_JSON", "stdin must contain exactly one valid JSON document");
  }
  validateCreateRequest(request);
  const targets = marker.targets;
  const snapshot = {
    l1: snapshotTarget(targetPaths[0]),
    l2: snapshotTarget(targetPaths[1])
  };
  process.stdout.write(`${JSON.stringify(planCreate(request, snapshot, targets))}\n`);
}

function parseFixtureArg(args) {
  let value;
  if (args.length === 2 && args[0] === "--fixture") {
    value = args[1];
  } else if (args.length === 1 && args[0].startsWith("--fixture=")) {
    value = args[0].slice("--fixture=".length);
  }
  if (!value) {
    throw new CliError(2, "INVALID_USAGE", "usage: dex-memoria create plan --fixture <fixture-root>");
  }
  return path.resolve(value);
}

function validateFixture(fixtureRoot) {
  try {
    requirePlainDirectory(fixtureRoot);
    const realRoot = fs.realpathSync(fixtureRoot);
    if (!samePath(realRoot, fixtureRoot)) {
      safetyBlocked("fixture root must not traverse a symlink or reparse point");
    }
    const markerPath = path.join(fixtureRoot, ".dex-memory-fixture.json");
    const manifestPath = path.join(fixtureRoot, "manifest.json");
    requirePlainFile(markerPath);
    requirePlainFile(manifestPath);
    const marker = readFixtureJson(markerPath, "marker");
    const manifest = readFixtureJson(manifestPath, "manifest");
    requireExactFixtureArray(marker.targets);
    requireExactFixtureArray(manifest.targets);
    if (
      marker.contract !== "dex.memory.disposable-run.v1" ||
      marker.operation !== "create" ||
      marker.disposable !== true ||
      manifest.contract !== "dex.memory.fixture.legacy-create-l1-l2.v1" ||
      manifest.operation !== "create" ||
      manifest.disposable_runs_only !== true
    ) {
      safetyBlocked("fixture marker or manifest contract is invalid");
    }
    const targetPaths = FIXTURE_TARGETS.map((relativePath) => validateTargetPath(fixtureRoot, realRoot, relativePath));
    return { marker, manifest, targetPaths };
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    safetyBlocked("fixture marker, manifest or path is invalid");
  }
}

function readFixtureJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    safetyBlocked(`fixture ${label} is invalid`);
  }
}

function requireExactFixtureArray(value) {
  if (!Array.isArray(value) || value.length !== FIXTURE_TARGETS.length || value.some((entry, index) => entry !== FIXTURE_TARGETS[index])) {
    safetyBlocked("fixture targets are invalid");
  }
}

function validateTargetPath(fixtureRoot, realRoot, relativePath) {
  const targetPath = path.resolve(fixtureRoot, relativePath);
  if (!isInside(realRoot, targetPath)) {
    safetyBlocked("fixture target escapes root");
  }
  let current = fixtureRoot;
  for (const segment of relativePath.split("/")) {
    current = path.join(current, segment);
    if (!fs.existsSync(current)) {
      continue;
    }
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) {
      safetyBlocked("fixture target contains a symlink or reparse point");
    }
    const realCurrent = fs.realpathSync(current);
    if (!isInside(realRoot, realCurrent)) {
      safetyBlocked("fixture target escapes root");
    }
  }
  return targetPath;
}

function requirePlainDirectory(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    safetyBlocked("fixture root is invalid");
  }
}

function requirePlainFile(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    safetyBlocked("fixture control file is invalid");
  }
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function samePath(first, second) {
  return process.platform === "win32" ? first.toLowerCase() === second.toLowerCase() : first === second;
}

function safetyBlocked(message) {
  throw new CliError(3, "SAFETY_BLOCKED", message);
}

function validateCreateRequest(request) {
  requireExactKeys(request, ["candidate", "contract", "idempotency_key", "operation"], "request");
  if (request.contract !== "dex.memory.create.request.v0" || request.operation !== "create") {
    invalidSchema("unsupported request contract or operation");
  }
  requireString(request.idempotency_key, "idempotency_key", 256);
  requireExactKeys(request.candidate, ["anchor", "body", "localizer", "title", "trigger"], "candidate");
  requireString(request.candidate.localizer, "candidate.localizer", 128, /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);
  requireString(request.candidate.trigger, "candidate.trigger", 512);
  requireString(request.candidate.title, "candidate.title", 256);
  requireString(request.candidate.anchor, "candidate.anchor", 128, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  requireString(request.candidate.body, "candidate.body", 65536);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidSchema(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    invalidSchema(`${label} contains missing or unknown fields`);
  }
}

function requireString(value, label, maxLength, pattern) {
  if (typeof value !== "string" || value.trim().length === 0 || [...value].length > maxLength) {
    invalidSchema(`${label} is invalid`);
  }
  if (pattern && !pattern.test(value)) {
    invalidSchema(`${label} has invalid syntax`);
  }
}

function invalidSchema(message) {
  throw new CliError(2, "INVALID_SCHEMA", message);
}

function snapshotTarget(targetPath) {
  const exists = fs.existsSync(targetPath);
  return {
    exists,
    bytes_base64: exists ? fs.readFileSync(targetPath).toString("base64") : ""
  };
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;
    let tooLarge = false;
    process.stdin.on("data", (chunk) => {
      length += chunk.length;
      if (length > MAX_STDIN_BYTES) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    process.stdin.on("end", () => {
      if (tooLarge) {
        reject(new CliError(2, "INVALID_SCHEMA", "stdin exceeds 1 MiB"));
        return;
      }
      try {
        resolve(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
      } catch (error) {
        reject(new CliError(2, "INVALID_JSON", "stdin must be valid UTF-8"));
      }
    });
    process.stdin.on("error", reject);
  });
}

function printHelp() {
  console.log(`dex-memoria ${readVersion()}

Uso:
  dex-memoria doctor
  dex-memoria memory-home
  dex-memoria install [--target <path>] [--registry-target <path>] [--force] [--dry-run]
  dex-memoria create plan --fixture <fixture-root>
  dex-memoria create apply --fixture <fixture-root>
  dex-memoria version

Padrao de instalacao do contrato completo:
  ${defaultTarget()}

Padrao de instalacao do redirecionador global:
  ${defaultRegistryTarget()}

Raiz padrao de memoria cross-project:
  ${memoryHomeInfo().path}

Observacao:
  Este pacote distribui o contrato documental dex-memoria. Ele nao instala
  runtime, hooks, inbox, ledger, tokens ou automacao do Dex Agent.`);
}

function doctor() {
  const required = ["SKILL.md", "SPEC.md", "README.md", "docs/usage.md", REDIRECTOR_ENTRY];
  const missing = required.filter((entry) => !fs.existsSync(path.join(PACKAGE_ROOT, entry)));

  if (missing.length > 0) {
    fail(`Pacote incompleto. Ausentes: ${missing.join(", ")}`);
  }

  console.log(`dex-memoria ${readVersion()} ok`);
  console.log(`Pacote: ${PACKAGE_ROOT}`);
  console.log(`Memoria home: ${memoryHomeInfo().path}`);
  console.log(`Memoria home source: ${memoryHomeInfo().source}`);
  console.log("Modo: contrato documental, sem runtime proprio");
}

function printMemoryHome() {
  const info = memoryHomeInfo();
  console.log(info.path);
  console.log(`source=${info.source}`);
  console.log("global=<DEX_MEMORIA_HOME>/global");
  console.log("temas=<DEX_MEMORIA_HOME>/temas/<tema>");
  console.log("projeto=<WORKSPACE>/.agents");
}

function install(args) {
  const options = parseInstallArgs(args);
  const target = path.resolve(options.target || defaultTarget());
  const registryTarget = path.resolve(options.registryTarget || defaultRegistryTarget());
  const planned = COPY_ENTRIES.map((entry) => ({
    from: path.join(PACKAGE_ROOT, entry),
    to: path.join(target, entry)
  }));
  const redirector = {
    from: path.join(PACKAGE_ROOT, REDIRECTOR_ENTRY),
    to: path.join(registryTarget, "SKILL.md")
  };
  const allPlanned = [...planned, redirector];

  const missing = allPlanned.filter((item) => !fs.existsSync(item.from));
  if (missing.length > 0) {
    fail(`Pacote incompleto. Ausentes: ${missing.map((item) => path.relative(PACKAGE_ROOT, item.from)).join(", ")}`);
  }

  if (options.dryRun) {
    console.log(`Instalaria dex-memoria em: ${target}`);
    if (fs.existsSync(target)) {
      console.log("Destino existente: sim");
    }
    planned.forEach((item) => console.log(`- ${path.relative(PACKAGE_ROOT, item.from)}`));
    console.log(`Instalaria redirecionador global em: ${redirector.to}`);
    if (fs.existsSync(redirector.to)) {
      console.log("Redirecionador existente: sim");
    }
    console.log(`- ${path.relative(PACKAGE_ROOT, redirector.from)}`);
    return;
  }

  const existing = allPlanned.filter((item) => fs.existsSync(item.to));
  if (existing.length > 0 && !options.force) {
    fail(`Destino ja contem arquivos dex-memoria. Use --force para atualizar: ${existing.map((item) => item.to).join(", ")}`);
  }

  fs.mkdirSync(target, { recursive: true });
  for (const item of planned) {
    copyRecursive(item.from, item.to);
  }
  copyRecursive(redirector.from, redirector.to);

  console.log(`dex-memoria ${readVersion()} instalado em: ${target}`);
  console.log(`redirecionador global instalado em: ${redirector.to}`);
}

function parseInstallArgs(args) {
  const options = {
    target: "",
    registryTarget: "",
    force: false,
    dryRun: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--target") {
      const value = args[index + 1];
      if (!value) {
        fail("Opcao --target exige um caminho.");
      }
      options.target = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
      continue;
    }
    if (arg === "--registry-target") {
      const value = args[index + 1];
      if (!value) {
        fail("Opcao --registry-target exige um caminho.");
      }
      options.registryTarget = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--registry-target=")) {
      options.registryTarget = arg.slice("--registry-target=".length);
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    fail(`Opcao desconhecida para install: ${arg}`);
  }

  return options;
}

function copyRecursive(from, to) {
  const stat = fs.statSync(from);
  if (stat.isDirectory()) {
    fs.rmSync(to, { recursive: true, force: true });
    fs.mkdirSync(to, { recursive: true });
    for (const child of fs.readdirSync(from)) {
      copyRecursive(path.join(from, child), path.join(to, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function defaultTarget() {
  return path.join(os.homedir(), ".dex-agent", "skills", "dex-memoria");
}

function defaultRegistryTarget() {
  return path.join(os.homedir(), ".agents", "skills", "dex-memoria");
}

function memoryHomeInfo() {
  if (process.env.DEX_MEMORIA_HOME) {
    return {
      path: path.resolve(expandHome(process.env.DEX_MEMORIA_HOME)),
      source: "DEX_MEMORIA_HOME"
    };
  }

  return {
    path: path.join(os.homedir(), ".agents", "memories"),
    source: "default:$HOME/.agents/memories"
  };
}

function expandHome(value) {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith(`~${path.sep}`) || value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function readVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  return packageJson.version;
}

function fail(message) {
  console.error(`Erro: ${message}`);
  process.exit(1);
}

main().catch((error) => {
  if (error instanceof CliError || error instanceof ApplyError) {
    process.stderr.write(`${JSON.stringify({
      contract: "dex.memory.error.v0",
      code: error.code,
      message: error.message
    })}\n`);
    process.exitCode = error.exitCode;
    return;
  }
  fail(error.message);
});
