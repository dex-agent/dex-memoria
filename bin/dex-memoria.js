#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { planCreate, planThemeV2 } = require("./create-plan");
const { ApplyError, applyCreate } = require("./create-apply");
const { RecoverError, recoverCreate } = require("./create-recover");
const {
  ThemeV2TransactionError,
  applyThemeV2,
  recoverThemeV2,
  validateDirectoryBaselineShape
} = require("./create-theme-v2-transaction");
const { RouteInspectionError, inspectThemeV2Routes } = require("./inspect-theme-v2-routes");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const REDIRECTOR_ENTRY = path.join("registry", "agents-skills", "dex-memoria", "SKILL.md");
const CANONICAL_SKILL_PATH = "C:\\CodexProjetos\\dex-memoria\\SKILL.md";
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

  if (command === "routes") {
    try {
      if (args[1] !== "inspect") {
        throw new CliError(2, "INVALID_USAGE", "usage: dex-memoria routes inspect --fixture <fixture-root>");
      }
      await routesInspect(args.slice(2));
    } catch (error) {
      if (error instanceof CliError || error instanceof RouteInspectionError) throw error;
      throw new CliError(6, "IO_FAILURE", "routes inspect failed");
    }
    return;
  }

  if (command === "create") {
    try {
      if (args[1] === "plan") {
        await createPlan(args.slice(2));
      } else if (args[1] === "apply") {
        await createApply(args.slice(2));
      } else if (args[1] === "recover") {
        await createRecover(args.slice(2));
      } else {
        throw new CliError(2, "INVALID_USAGE", "usage: dex-memoria create plan|apply|recover --fixture <fixture-root>");
      }
    } catch (error) {
      if (error instanceof CliError || error instanceof ApplyError || error instanceof RecoverError || error instanceof ThemeV2TransactionError) {
        throw error;
      }
      throw new CliError(6, "IO_FAILURE", `create ${args[1] || "command"} failed`);
    }
    return;
  }

  fail(`Comando desconhecido: ${command}`);
}

async function createApply(args) {
  const fixtureRoot = parseFixtureArg(args, "apply");
  const fixture = validateFixture(fixtureRoot);
  const input = await readStdin();
  let plan;
  try {
    plan = JSON.parse(input);
  } catch (error) {
    throw new CliError(2, "INVALID_JSON", "stdin must contain exactly one valid JSON document");
  }

  if (fixture.profile === "governed-theme-v2") {
    if (fixture.capability !== "transaction") invalidSchema("governed-theme-v2 plan-only fixture cannot apply");
    const receipt = await applyThemeV2(plan, fixtureRoot, (validatedPlan) => {
      if (validatedPlan.request.target_layer !== fixture.manifest.target_layer) {
        throw new ThemeV2TransactionError(2, "INVALID_SCHEMA", "plan target layer does not match fixture manifest");
      }
      const targetPaths = resolveThemeV2Targets(fixture, validatedPlan.request);
      const destinationDirectory = path.dirname(targetPaths[2]);
      if (validatedPlan.request.target_layer === "L3" && fs.existsSync(destinationDirectory)) {
        throw new ThemeV2TransactionError(4, "PLAN_CONFLICT", "fixture destination directory appeared after plan");
      }
      const themeState = inspectThemeV2(fixture, validatedPlan.request);
      const snapshot = {
        l1: snapshotTarget(targetPaths[0]),
        index: snapshotTarget(targetPaths[1]),
        destination: snapshotTarget(targetPaths[2]),
        index_entries: themeState.filter((entry) => entry.layer === validatedPlan.request.target_layer)
      };
      return {
        targetPaths,
        expectedPlan: planThemeV2(
          validatedPlan.request,
          snapshot,
          targetPaths.map((targetPath) => relativeFixturePath(fixtureRoot, targetPath))
        ),
        directories: validateDirectoryBaselineShape(validatedPlan)
      };
    }, {
      name: process.env.DEX_MEMORIA_INTERNAL_TEST_FAILPOINT,
      send: typeof process.send === "function" ? process.send.bind(process) : undefined
    });
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return;
  }
  const receipt = await applyCreate(plan, fixtureRoot, fixture.targetPaths, {
    name: process.env.DEX_MEMORIA_INTERNAL_TEST_FAILPOINT,
    send: typeof process.send === "function" ? process.send.bind(process) : undefined
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function createRecover(args) {
  const fixtureRoot = parseFixtureArg(args, "recover");
  const fixture = validateFixture(fixtureRoot);
  const input = await readStdin();
  let request;
  try {
    request = JSON.parse(input);
  } catch (error) {
    throw new CliError(2, "INVALID_JSON", "stdin must contain exactly one valid JSON document");
  }
  if (fixture.profile === "governed-theme-v2") {
    if (fixture.capability !== "transaction") invalidSchema("governed-theme-v2 plan-only fixture cannot recover");
    const receipt = await recoverThemeV2(request, fixtureRoot, fixture.manifest);
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
    return;
  }
  const receipt = await recoverCreate(request, fixtureRoot, fixture.targetPaths);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

async function createPlan(args) {
  const fixtureRoot = parseFixtureArg(args, "plan");
  const fixture = validateFixture(fixtureRoot);
  const input = await readStdin();
  let request;
  try {
    request = JSON.parse(input);
  } catch (error) {
    throw new CliError(2, "INVALID_JSON", "stdin must contain exactly one valid JSON document");
  }
  validateCreateRequest(request, fixture);
  if (fixture.profile === "governed-theme-v2") {
    const themeState = inspectThemeV2(fixture, request);
    const targetPaths = resolveThemeV2Targets(fixture, request);
    const snapshot = {
      l1: snapshotTarget(targetPaths[0]),
      index: snapshotTarget(targetPaths[1]),
      destination: snapshotTarget(targetPaths[2]),
      index_entries: themeState.filter((entry) => entry.layer === request.target_layer)
    };
    const plan = planThemeV2(request, snapshot, targetPaths.map((targetPath) => relativeFixturePath(fixtureRoot, targetPath)));
    if (plan.targets.some((target) => target.changed !== true)) {
      throw new CliError(4, "PLAN_CONFLICT", "fixture contains an orphan or preexisting V2 route");
    }
    const output = JSON.stringify(plan);
    if (Buffer.byteLength(output, "utf8") > MAX_STDIN_BYTES) invalidSchema("plan exceeds 1 MiB");
    process.stdout.write(`${output}\n`);
    return;
  }
  const targets = fixture.marker.targets;
  const snapshot = {
    l1: snapshotTarget(fixture.targetPaths[0]),
    l2: snapshotTarget(fixture.targetPaths[1])
  };
  process.stdout.write(`${JSON.stringify(planCreate(request, snapshot, targets))}\n`);
}

async function routesInspect(args) {
  const fixtureRoot = parseFixtureArg(args, "routes inspect");
  const input = process.stdin.isTTY ? "" : await readStdin();
  if (input.length > 0) throw new CliError(2, "INVALID_USAGE", "routes inspect does not accept stdin");
  const fixture = validateFixture(fixtureRoot);
  if (fixture.profile !== "governed-theme-v2") {
    throw new CliError(2, "INVALID_PROFILE", "routes inspect supports only governed-theme-v2 fixtures");
  }
  if (fixture.capability !== "transaction") {
    throw new CliError(2, "INVALID_PROFILE", "routes inspect requires a governed-theme-v2 transaction fixture");
  }
  process.stdout.write(`${JSON.stringify(inspectThemeV2Routes(fixture))}\n`);
}

function parseFixtureArg(args, subcommand) {
  let value;
  if (args.length === 2 && args[0] === "--fixture") {
    value = args[1];
  } else if (args.length === 1 && args[0].startsWith("--fixture=")) {
    value = args[0].slice("--fixture=".length);
  }
  if (!value) {
    const command = subcommand.startsWith("routes ") ? subcommand : `create ${subcommand}`;
    throw new CliError(2, "INVALID_USAGE", `usage: dex-memoria ${command} --fixture <fixture-root>`);
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
    requireExactFixtureKeys(marker, ["contract", "operation", "disposable", "targets"]);
    if (marker.contract !== "dex.memory.disposable-run.v1" || marker.operation !== "create" || marker.disposable !== true) {
      safetyBlocked("fixture marker or manifest contract is invalid");
    }
    if ([
      "dex.memory.fixture.governed-theme-v2-plan.v0",
      "dex.memory.fixture.governed-theme-v2-transaction.v0"
    ].includes(manifest.contract)) {
      return validateThemeV2Fixture(fixtureRoot, realRoot, marker, manifest);
    }
    requireExactFixtureKeys(manifest, ["contract", "operation", "disposable_runs_only", "targets"]);
    requireExactFixtureArray(marker.targets, FIXTURE_TARGETS);
    requireExactFixtureArray(manifest.targets, FIXTURE_TARGETS);
    if (manifest.contract !== "dex.memory.fixture.legacy-create-l1-l2.v1" || manifest.operation !== "create" || manifest.disposable_runs_only !== true) {
      safetyBlocked("fixture marker or manifest contract is invalid");
    }
    const targetPaths = FIXTURE_TARGETS.map((relativePath) => validateTargetPath(fixtureRoot, realRoot, relativePath));
    return { profile: "legacy-v1", fixtureRoot, realRoot, marker, manifest, targetPaths };
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

function validateThemeV2Fixture(fixtureRoot, realRoot, marker, manifest) {
  requireExactFixtureKeys(manifest, ["contract", "disposable_runs_only", "operation", "profile", "target_layer", "theme"]);
  if (
    manifest.operation !== "create" ||
    manifest.profile !== "governed-theme-v2" ||
    manifest.disposable_runs_only !== true ||
    !isKebabCase(manifest.theme, 63) ||
    isReservedName(manifest.theme) ||
    !["L2", "L3"].includes(manifest.target_layer)
  ) {
    safetyBlocked("fixture marker or manifest contract is invalid");
  }
  const themeRelativeRoot = `work/${manifest.theme}`;
  requireExactFixtureArray(marker.targets, [themeRelativeRoot]);
  const themeRoot = validateTargetPath(fixtureRoot, realRoot, themeRelativeRoot);
  requirePlainDirectory(themeRoot);
  for (const relativePath of [
    `${themeRelativeRoot}/lembranca.md`,
    `${themeRelativeRoot}/memorias/INDEX.md`,
    `${themeRelativeRoot}/conhecimento/INDEX.md`
  ]) {
    requirePlainFile(validateTargetPath(fixtureRoot, realRoot, relativePath));
  }
  return {
    profile: "governed-theme-v2",
    capability: manifest.contract === "dex.memory.fixture.governed-theme-v2-transaction.v0" ? "transaction" : "plan-only",
    fixtureRoot,
    realRoot,
    marker,
    manifest,
    themeRoot,
    themeRelativeRoot,
    targetPaths: []
  };
}

function requireExactFixtureArray(value, expected) {
  if (!Array.isArray(value) || value.length !== expected.length || value.some((entry, index) => entry !== expected[index])) {
    safetyBlocked("fixture targets are invalid");
  }
}

function requireExactFixtureKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    safetyBlocked("fixture control document must be an object");
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    safetyBlocked("fixture control document contains missing or unknown fields");
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

function validateCreateRequest(request, fixture) {
  if (fixture.profile === "governed-theme-v2") {
    validateThemeV2Request(request, fixture.manifest);
    return;
  }
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

function validateThemeV2Request(request, manifest) {
  if (!request || typeof request !== "object" || Array.isArray(request)) invalidSchema("request must be an object");
  const targetLayer = request.target_layer;
  const expectedKeys = [
    "body", "contract", "created_at", "idempotency_key", "identity", "operation", "profile",
    "route_decision", "slug", "target_layer", "title", "trigger"
  ];
  if (targetLayer === "L3") expectedKeys.push("owner_skill");
  requireExactKeys(request, expectedKeys, "request");
  if (
    request.contract !== "dex.memory.create.theme-v2.request.v0" ||
    request.profile !== "governed-theme-v2" ||
    request.operation !== "create" ||
    targetLayer !== manifest.target_layer
  ) {
    invalidSchema("unsupported request contract, profile, operation or target layer");
  }
  requireString(request.idempotency_key, "idempotency_key", 256);
  requireString(request.identity, "identity", 36, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  requireString(request.slug, "slug", 80, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  if (isReservedName(request.slug)) invalidSchema("slug is reserved");
  requireSingleLineString(request.trigger, "trigger", 512);
  requireSingleLineString(request.title, "title", 256);
  requireString(request.body, "body", 65536);
  requireString(request.created_at, "created_at", 24, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  if (new Date(request.created_at).toISOString() !== request.created_at) invalidSchema("created_at is invalid");
  const expectedDecision = targetLayer === "L2" ? "explicit-l2-memory" : "explicit-l3-knowledge";
  if (request.route_decision !== expectedDecision) invalidSchema("route_decision does not match target_layer");
  if (targetLayer === "L3") {
    requireString(request.owner_skill, "owner_skill", 128, /^[a-z0-9]+(?:(?:-|:)[a-z0-9]+)*$/);
  }
}

function requireSingleLineString(value, label, maximum) {
  requireString(value, label, maximum);
  if (/[\r\n\0]/.test(value)) invalidSchema(`${label} must be a single line`);
}

function inspectThemeV2(fixture, request) {
  const entries = [
    ...readThemeV2Layer(fixture, "L2"),
    ...readThemeV2Layer(fixture, "L3")
  ];
  const slugKey = request.slug.toLowerCase();
  if (entries.some((entry) => entry.slug.toLowerCase() === slugKey || entry.identity === request.identity)) {
    throw new CliError(4, "PLAN_CONFLICT", "fixture already contains the requested identity or slug");
  }
  return entries;
}

function readThemeV2Layer(fixture, layer) {
  const directory = path.join(fixture.themeRoot, layer === "L2" ? "memorias" : "conhecimento");
  const entries = [];
  for (const name of fs.readdirSync(directory).sort()) {
    if (name.toLowerCase() === "index.md") continue;
    const candidatePath = path.join(directory, name);
    const stat = fs.lstatSync(candidatePath);
    if (stat.isSymbolicLink()) safetyBlocked("fixture destination contains a symlink or reparse point");
    let documentPath;
    let slugFromPath;
    let link;
    if (layer === "L2") {
      if (!stat.isFile() || path.extname(name).toLowerCase() !== ".md") safetyBlocked("fixture L2 destination is invalid");
      slugFromPath = path.basename(name, path.extname(name));
      documentPath = candidatePath;
      link = `${slugFromPath}.md`;
    } else {
      if (!stat.isDirectory()) safetyBlocked("fixture L3 destination is invalid");
      slugFromPath = name;
      documentPath = path.join(candidatePath, "README.md");
      requirePlainFile(documentPath);
      link = `${slugFromPath}/README.md`;
    }
    const parsed = parseThemeV2Document(fs.readFileSync(documentPath, "utf8"));
    if (!parsed || parsed.layer !== layer || parsed.slug.toLowerCase() !== slugFromPath.toLowerCase()) {
      throw new CliError(4, "PLAN_CONFLICT", "fixture contains an unparseable V2 destination");
    }
    entries.push({ ...parsed, link });
  }
  return entries;
}

function parseThemeV2Document(text) {
  const normalized = text.replace(/\r\n?/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n[\s\S]*?^# (.+)$/m);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator <= 0) return null;
    fields[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  if (!/^[a-f0-9-]{36}$/.test(fields.identity || "") || !["L2", "L3"].includes(fields.layer) || !isKebabCase(fields.slug, 80)) return null;
  return { identity: fields.identity, layer: fields.layer, slug: fields.slug, title: match[2].trim() };
}

function resolveThemeV2Targets(fixture, request) {
  const targetDirectory = request.target_layer === "L2" ? "memorias" : "conhecimento";
  const relativePaths = [
    `${fixture.themeRelativeRoot}/lembranca.md`,
    `${fixture.themeRelativeRoot}/${targetDirectory}/INDEX.md`,
    request.target_layer === "L2"
      ? `${fixture.themeRelativeRoot}/${targetDirectory}/${request.slug}.md`
      : `${fixture.themeRelativeRoot}/${targetDirectory}/${request.slug}/README.md`
  ];
  return relativePaths.map((relativePath) => validateTargetPath(fixture.fixtureRoot, fixture.realRoot, relativePath));
}

function relativeFixturePath(fixtureRoot, targetPath) {
  return path.relative(fixtureRoot, targetPath).split(path.sep).join("/");
}

function isKebabCase(value, maximum) {
  return typeof value === "string" && [...value].length <= maximum && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isReservedName(value) {
  const reserved = new Set(["lembranca", "memoria", "memorias", "conhecimento", "index", "readme", "referencias", "artefatos"]);
  if (reserved.has(value.toLowerCase())) return true;
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(value);
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    invalidSchema(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
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
  dex-memoria install [--registry-target <path>] [--force] [--dry-run]
  dex-memoria create plan --fixture <fixture-root>
  dex-memoria create apply --fixture <fixture-root>
  dex-memoria create recover --fixture <fixture-root>
  dex-memoria routes inspect --fixture <fixture-root>
  dex-memoria version

Padrao de instalacao do redirecionador global:
  ${defaultRegistryTarget()}

Fonte canonica unica:
  ${CANONICAL_SKILL_PATH}

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
  const registryTarget = path.resolve(options.registryTarget || defaultRegistryTarget());
  const redirector = {
    from: path.join(PACKAGE_ROOT, REDIRECTOR_ENTRY),
    to: path.join(registryTarget, "SKILL.md")
  };

  const missing = [redirector].filter((item) => !fs.existsSync(item.from));
  if (missing.length > 0) {
    fail(`Pacote incompleto. Ausentes: ${missing.map((item) => path.relative(PACKAGE_ROOT, item.from)).join(", ")}`);
  }
  let canonicalSkillReady = false;
  try {
    canonicalSkillReady = fs.statSync(CANONICAL_SKILL_PATH).isFile();
    if (canonicalSkillReady) {
      fs.accessSync(CANONICAL_SKILL_PATH, fs.constants.R_OK);
    }
  } catch {
    canonicalSkillReady = false;
  }
  if (!canonicalSkillReady) {
    fail(`Fonte canonica indisponivel: ${CANONICAL_SKILL_PATH}`);
  }

  if (options.dryRun) {
    console.log(`Instalaria redirecionador global em: ${redirector.to}`);
    if (fs.existsSync(redirector.to)) {
      console.log("Redirecionador existente: sim");
    }
    console.log(`Fonte canonica: ${CANONICAL_SKILL_PATH}`);
    console.log(`- ${path.relative(PACKAGE_ROOT, redirector.from)}`);
    return;
  }

  if (fs.existsSync(redirector.to) && !options.force) {
    fail(`Destino ja contem o redirecionador dex-memoria. Use --force para atualizar: ${redirector.to}`);
  }

  fs.mkdirSync(path.dirname(redirector.to), { recursive: true });
  fs.copyFileSync(redirector.from, redirector.to);

  console.log(`redirecionador global instalado em: ${redirector.to}`);
  console.log(`fonte canonica: ${CANONICAL_SKILL_PATH}`);
}

function parseInstallArgs(args) {
  const options = {
    registryTarget: "",
    force: false,
    dryRun: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
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
  if (error instanceof CliError || error instanceof ApplyError || error instanceof RecoverError || error instanceof ThemeV2TransactionError || error instanceof RouteInspectionError) {
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
