#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

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

function main() {
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

  fail(`Comando desconhecido: ${command}`);
}

function printHelp() {
  console.log(`dex-memoria ${readVersion()}

Uso:
  dex-memoria doctor
  dex-memoria memory-home
  dex-memoria install [--target <path>] [--registry-target <path>] [--force] [--dry-run]
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

main();
