#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  SCHEMA_FILES: createContractSchemaFiles,
  validateCreateContractSchemas: validateCreateContractSchemaMap
} = require("./validate-create-contracts");
const {
  verifyGeneratedArtifacts: validateMemoryResourceLimitBundle
} = require("./generate-memory-resource-limit-artifacts");

const root = path.resolve(__dirname, "..");
const expectedVersion = "0.1.6";

const requiredFiles = [
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "README.md",
  "CHANGELOG.md",
  "DECISIONS.md",
  "SKILL.md",
  "SPEC.md",
  "VERSION",
  "package.json",
  "bin/dex-memoria.js",
  "bin/inspect-theme-v2-routes.js",
  "bin/create-journal.js",
  "bin/create-theme-v2-transaction.js",
  "registry/agents-skills/dex-memoria/SKILL.md",
  "contracts/CONTRATO_OPERACIONAL_CONDICAO_ACAO_EXECUCAO_RETORNO.md",
  "contracts/layouts/governed-theme-v2.json",
  "contracts/policies/dex.memory.resource-limits.v1.json",
  "contracts/policies/dex.memory.resource-limits.v1.schema.json",
  "contracts/policies/generated/dex.memory.resource-limits.bootstrap.node.v1.cjs",
  "contracts/policies/generated/dex.memory.resource-limits.bootstrap.powershell.v1.ps1",
  "contracts/policies/generated/dex.memory.resource-limits.provenance.v1.json",
  "contracts/policies/README.md",
  "contracts/policies/INDEX.md",
  "contracts/schemas/dex.memory.layout.v1.schema.json",
  "contracts/schemas/dex.memory.routes.inspect.v0.schema.json",
  "contracts/schemas/dex.memory.create.theme-v2.request.v0.schema.json",
  "contracts/schemas/dex.memory.create.theme-v2.plan.v0.schema.json",
  "contracts/schemas/dex.memory.fixture.governed-theme-v2-plan.v0.schema.json",
  "contracts/schemas/dex.memory.fixture.governed-theme-v2-transaction.v0.schema.json",
  "contracts/schemas/dex.memory.create.theme-v2.recover.v0.schema.json",
  "contracts/schemas/dex.memory.create.theme-v2.receipt.v0.schema.json",
  "contracts/schemas/dex.memory.create.theme-v2.checkpoint.internal.v0.schema.json",
  "contracts/schemas/dex.memory.create.request.v0.schema.json",
  "contracts/schemas/dex.memory.create.recover.v0.schema.json",
  "contracts/schemas/dex.memory.create.plan.v0.schema.json",
  "contracts/schemas/dex.memory.create.receipt.v0.schema.json",
  "contracts/schemas/dex.memory.error.v0.schema.json",
  "contracts/schemas/dex.memory.disposable-run.v1.schema.json",
  "contracts/schemas/dex.memory.fixture.legacy-create-l1-l2.v1.schema.json",
  "contracts/schemas/dex.memory.precutover.evidence.v0.schema.json",
  "contracts/schemas/dex.memory.create.checkpoint.internal.v0.schema.json",
  "contracts/fixtures/precutover-v1-recall-corpus.v0.json",
  "docs/usage.md",
  "docs/runtime-boundary.md",
  "docs/cli-create-fixture-v0.md",
  "docs/cli-create-theme-v2-plan-v0.md",
  "docs/cli-create-theme-v2-transaction-v0.md",
  "docs/cli-routes-inspect-v2-v0.md",
  "docs/integration-dex-agent.md",
  "docs/memory-home.md",
  "docs/layered-memory-simulations.md",
  "docs/resource-limits-shadow-fixture-v1.md",
  "docs/v2-fixture-consolidation-map.md",
  "scripts/validate-graduated-memory.js",
  "scripts/generate-memory-resource-limit-artifacts.js",
  "scripts/compare-memory-resource-limits-shadow.js",
  "scripts/read-memory-resource-limits-shadow.js",
  "scripts/read-memory-resource-limits-shadow.ps1",
  "scripts/run-memory-resource-limits-shadow-fixture.js",
  "scripts/run-memory-tag-limit-shadow-fixture.js",
  "scripts/run-memory-link-line-limit-shadow-fixture.js",
  "scripts/run-memory-v2-create-recall-fixture.js",
  "scripts/run-memory-v2-precutover-clone.ps1",
  "scripts/validate-memory-v2-precutover-evidence.js",
  "scripts/smoke-consciencia-templates.js",
  "skills/dex-memoria-v2-pilot/SKILL.md",
  "skills/dex-memoria-v2-pilot/agents/openai.yaml",
  "skills/dex-memoria-v2-pilot/scripts/run-v2-memory-pilot.ps1",
  "templates/memory-contract.md",
  "templates/memory-resolution-checklist.md",
  "templates/child-usage-prompt.md",
  "templates/l1-lembranca.md",
  "templates/l2-memoria.md",
  "templates/l3-conhecimento-index.md",
  "templates/l3-conhecimento-file.md",
  "templates/layered-memory-checklist.md",
  "examples/active-operational-memory.md",
  "examples/child-to-child-handoff.md",
  "examples/ledger-only-memory.md",
  "examples/resolved-operational-finding.md",
  "examples/graduated-memory-simple.md",
  "examples/graduated-memory-robust-graphify.md",
  "examples/graduated-memory-test-cases.json",
  "examples/layered-memory/lembranca.md",
  "examples/layered-memory/memoria.md",
  "examples/layered-memory/conhecimento/INDEX.md",
  "examples/layered-memory/conhecimento/detalhe-sob-demanda.md",
  "examples/layered-memory/conhecimento/documentacao/INDEX.md",
  "examples/layered-memory/conhecimento/modelos/INDEX.md",
  "examples/layered-memory/conhecimento/tutoriais/INDEX.md",
  ".github/ISSUE_TEMPLATE/bug_report.md",
  ".github/ISSUE_TEMPLATE/docs_change.md",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/pull_request_template.md",
  ".github/workflows/ci.yml"
];

const requiredPackageFiles = [
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "bin/",
  "contracts/",
  "docs/",
  "examples/",
  "registry/",
  "scripts/",
  "templates/",
  "CHANGELOG.md",
  "DECISIONS.md",
  "README.md",
  "SKILL.md",
  "SPEC.md",
  "VERSION"
];

const forbiddenTrackedPrefixes = [
  ".agents/",
  ".claude/",
  ".codex/",
  ".continue/",
  ".cursor/",
  ".harness/",
  ".mcp/",
  ".ppirtv/",
  ".windsurf/",
  "graphify-out/"
];

const forbiddenTrackedFiles = new Set([
  ".env",
  ".graphifyignore"
]);

function main() {
  const errors = [];

  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(root, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  const packageJson = readJson("package.json", errors);
  if (packageJson) {
    assertEqual(errors, "package.json name", packageJson.name, "dex-memoria");
    assertEqual(errors, "package.json version", packageJson.version, expectedVersion);
    assertEqual(errors, "package.json license", packageJson.license, "MIT");
    assertEqual(errors, "package.json repository.url", packageJson.repository && packageJson.repository.url, "git+https://github.com/dex-agent/dex-memoria.git");
    assertEqual(errors, "package.json bugs.url", packageJson.bugs && packageJson.bugs.url, "https://github.com/dex-agent/dex-memoria/issues");

    for (const file of requiredPackageFiles) {
      if (!Array.isArray(packageJson.files) || !packageJson.files.includes(file)) {
        errors.push(`package.json files must include: ${file}`);
      }
    }
  }

  const version = readText("VERSION", errors).trim();
  if (version && version !== expectedVersion) {
    errors.push(`VERSION must be ${expectedVersion}, got ${version}`);
  }

  requireText(errors, "README.md", ["Versao atual: `0.1.6`", "dex-agent", "nao e um writer geral", "DEX_MEMORIA_HOME", "Taxonomia de temas"]);
  requireText(errors, "SPEC.md", ["L1 - Lembranca", "L2 - Memoria", "L3 - Conhecimento", "Escopos De Caminho", "Raiz Canonica", "Taxonomia De Temas"]);
  requireText(errors, "docs/usage.md", ["Usar L1/L2/L3", "gatilho -> ancora -> detalhe", "Escolher O Caminho Correto", "$HOME/.agents/memories", "tema e dominio reutilizavel"]);
  requireText(errors, "docs/runtime-boundary.md", ["Carregamento De L1/L2/L3", "global roteia", "DEX_MEMORIA_HOME"]);
  requireText(errors, "README.md", ["CLI V0 fixture-only", "docs/cli-create-fixture-v0.md"]);
  requireText(errors, "README.md", ["probe SHADOW fixture-only", "docs/resource-limits-shadow-fixture-v1.md"]);
  requireText(errors, "README.md", ["mapa consolidado V2 fixture-only", "docs/v2-fixture-consolidation-map.md", "fixture-ready"]);
  requireText(errors, "SPEC.md", ["Fronteira Executavel V0 Fixture-Only", "dex.memory.create.plan.v0", "dex.memory.create.receipt.v0"]);
  requireText(errors, "docs/usage.md", ["Usar A CLI V0 Fixture-Only", "create plan", "create apply", "create recover"]);
  requireText(errors, "docs/usage.md", ["probe SHADOW de limites fixture-only", "resource-limits-shadow-fixture-v1.md", "--bundle", "--receipt"]);
  requireText(errors, "docs/usage.md", ["Usar O Piloto V2 Fixture-Only", "run-v2-memory-pilot.ps1", "nao toca o vault vivo"]);
  requireText(errors, "docs/v2-fixture-consolidation-map.md", [
    "ACTIVE",
    "FIXTURE_ONLY",
    "CANDIDATE_SHADOW",
    "EXTERNAL_CONSUMER",
    "fixture-ready",
    "run-memory-v2-create-recall-fixture.js",
    "run-memory-v2-precutover-clone.ps1",
    "validate-memory-v2-precutover-evidence.js",
    "precutover-v1-recall-corpus.v0.json",
    "legacy-v1",
    "explicit human acceptance"
  ]);
  requireText(errors, "docs/resource-limits-shadow-fixture-v1.md", [
    "DEFAULT",
    "operation_child",
    "comparison_child",
    "validate-memory-tags",
    "v2.tags.max_files",
    "100 files",
    "101 files",
    "validate-memory-links",
    "v2.document.max_lines",
    "5000 lines",
    "5001 lines",
    "candidate_invalid",
    "comparison_not_run",
    "cli.stdin.max_bytes",
    "v2.routes.document.max_bytes",
    "v2.routes.max_entries",
    "--help"
  ]);
  requireText(errors, "docs/runtime-boundary.md", ["Excecao V0 Fixture-Only", "nao aceita o vault vivo"]);
  requireText(errors, "docs/cli-create-fixture-v0.md", [
    "dex-memoria create plan",
    "dex-memoria create apply",
    "dex-memoria create recover",
    "dex.memory.create.request.v0",
    "dex.memory.create.recover.v0",
    "dex.memory.create.plan.v0",
    "dex.memory.create.receipt.v0",
    "dex.memory.error.v0",
    "dex.memory.disposable-run.v1",
    "dex.memory.fixture.legacy-create-l1-l2.v1",
    "PREPARED",
    "L1_PUBLISHED",
    "COMMITTED",
    "ROLLED_BACK",
    "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT",
    "FP_AFTER_L1_CHECKPOINT_BEFORE_L2",
    "1 MiB",
    "Riscos nao cobertos"
  ]);
  requireText(errors, "docs/cli-create-theme-v2-plan-v0.md", [
    "governed-theme-v2",
    "approved_not_active",
    "L1 -> L2 OU L1 -> L3",
    "create plan",
    "fixture-only",
    "serialization_order_only",
    "não implementa apply, journal ou recover V2",
    "não aceita o vault vivo"
  ]);
  requireText(errors, "docs/cli-create-theme-v2-transaction-v0.md", [
    "governed-theme-v2",
    "approved_not_active",
    "dex.memory.fixture.governed-theme-v2-transaction.v0",
    "L1 -> L2 OU L1 -> L3",
    "fixture-only",
    "destination -> index -> l1",
    "PREPARED",
    "DESTINATION_PUBLISHED",
    "INDEX_PUBLISHED",
    "L1_PUBLISHED",
    "COMMITTED",
    "ROLLED_BACK",
    "FP_AFTER_DESTINATION_DIRECTORY_CREATE_BEFORE_PUBLISH",
    "FP_AFTER_DESTINATION_PUBLISH_BEFORE_CHECKPOINT",
    "FP_AFTER_DESTINATION_CHECKPOINT_BEFORE_INDEX",
    "FP_AFTER_INDEX_PUBLISH_BEFORE_CHECKPOINT",
    "FP_AFTER_INDEX_CHECKPOINT_BEFORE_L1",
    "FP_AFTER_L1_PUBLISH_BEFORE_CHECKPOINT",
    "FP_AFTER_L1_CHECKPOINT_BEFORE_COMMIT",
    "dex-memoria create plan --fixture",
    "dex-memoria create apply --fixture",
    "dex-memoria create recover --fixture",
    "dex.memory.create.theme-v2.request.v0",
    "dex.memory.create.theme-v2.recover.v0",
    "dex.memory.create.theme-v2.receipt.v0",
    "stdout",
    "stderr",
    "ALREADY_COMMITTED",
    "RECOVERY_REQUIRED",
    "Exit codes",
    "não aceita o vault vivo",
    "não ativa o V2"
  ]);
  requireText(errors, "docs/cli-routes-inspect-v2-v0.md", [
    "routes inspect",
    "fixture_only_experimental",
    "governed-theme-v2",
    "approved_not_active",
    "dex.memory.routes.inspect.v0",
    "ROUTE_INVALID",
    "L1 -> memorias/<slug>.md",
    "L1 -> conhecimento/<slug>/README.md",
    "owner_skill",
    "shadow",
    "no-shrink",
    "nao aceita o vault vivo"
  ]);
  requireText(errors, "README.md", ["fixture_only_experimental", "docs/cli-create-theme-v2-transaction-v0.md"]);
  requireText(errors, "SPEC.md", ["Runtime-Support: fixture_only_experimental", "docs/cli-create-theme-v2-transaction-v0.md"]);
  requireText(errors, "AGENTS.md", ["Runtime support: `fixture_only_experimental`", "docs/cli-create-theme-v2-transaction-v0.md"]);
  requireText(errors, "docs/runtime-boundary.md", ["fixture_only_experimental", "cli-create-theme-v2-transaction-v0.md"]);
  requireText(errors, "docs/usage.md", ["fixture_only_experimental", "cli-create-theme-v2-transaction-v0.md"]);
  requireText(errors, "docs/memory-architecture-profiles.md", ["Runtime-Support: fixture_only_experimental", "cli-create-theme-v2-transaction-v0.md"]);
  requireText(errors, "contracts/layouts/governed-theme-v2.json", [
    '"contract": "dex.memory.layout.v1"',
    '"profile": "governed-theme-v2"',
    '"status": "approved_not_active"',
    '"active_write_profile": "legacy-v1"',
    '"L1->L2"',
    '"L1->L3"'
  ]);
  requireText(errors, "CHANGELOG.md", ["## Unreleased", "CLI JSON fixture-only"]);
  requireText(errors, "CONTRIBUTING.md", ["version `0.1.6`", "fixture-only V0", "docs/cli-create-fixture-v0.md"]);
  requireText(errors, "AGENTS.md", ["V0 fixture-only", "docs/cli-create-fixture-v0.md"]);
  validateCreateContractSchemas(errors);
  requireText(errors, "docs/memory-home.md", ["DEX_MEMORIA_HOME", "$HOME/.agents/memories", "<WORKSPACE>/.agents", "projeto-ferramenta"]);
  requireText(errors, "docs/layered-memory-simulations.md", ["PASS", "FAIL UTIL", "global roteia, tema reutiliza, projeto opera"]);
  requireText(errors, "SKILL.md", [
    "Fonte Publicavel Completa",
    "Regra Central",
    "MEMORIA-GRADUADA-COM-ANTI-GATILHO",
    "Memoria Graduada Com Anti-Gatilho",
    "DESBLOQUEIO-MANUAL-CONTROLADO",
    "Anti-gatilho nao e obrigatorio em toda memoria",
    "Checklist De L3 Robusto",
    "Fonte Única E Perfis Operacionais",
    "Fronteira De Escrita",
    "mecanismo fisico ja autorizado",
    "Fonte Completa",
    "Graphify e mapa, nao prova",
    "Excecao Executavel V0 Fixture-Only",
    "V1 documental preservada",
    "`create plan|apply|recover`",
    "[docs/cli-create-fixture-v0.md](docs/cli-create-fixture-v0.md)"
  ]);
  requireText(errors, "SPEC.md", ["MEMORIA-GRADUADA-COM-ANTI-GATILHO", "DESBLOQUEIO-MANUAL-CONTROLADO", "Forca da evidencia", "source: graphify"]);
  requireText(errors, "docs/usage.md", ["Usar Memoria Graduada Com Anti-Gatilho", "DESBLOQUEIO-MANUAL-CONTROLADO", "Anti-exemplo entra quando evita erro real", "Pontes esperadas", "smoke:consciencia", "integracao local", "memory-policy.ps1", "memory-policy.json", "memory-policy.compat.json"]);
  requireText(errors, "package.json", ["smoke:consciencia", "test:local", "scripts/smoke-consciencia-templates.js"]);
  requireText(errors, "bin/dex-memoria.js", ["REDIRECTOR_ENTRY", "CANONICAL_SKILL_PATH", "defaultRegistryTarget", "--registry-target", "redirecionador global"]);
  requireText(errors, "registry/agents-skills/dex-memoria/SKILL.md", [
    "Destino Único",
    "C:\\CodexProjetos\\dex-memoria\\SKILL.md",
    "bloqueio explicito",
    "Nenhuma rota alternativa"
  ]);
  rejectText(errors, "registry/agents-skills/dex-memoria/SKILL.md", [
    ".dex-agent",
    "<WORKSPACE>",
    "fallback"
  ]);
  requireText(errors, "README.md", [
    "C:\\CodexProjetos\\dex-memoria\\SKILL.md",
    "Nao copie nem adapte `SKILL.md` como skill local autoritativa"
  ]);
  requireText(errors, "docs/usage.md", [
    "C:\\CodexProjetos\\dex-memoria\\SKILL.md",
    "Nao copie nem adapte `SKILL.md` como skill local"
  ]);
  rejectText(errors, "README.md", [
    "Copiar ou adaptar como skill local do projeto",
    "Para usar como skill local"
  ]);
  rejectText(errors, "docs/usage.md", [
    "Copiar Ou Adaptar Como Skill Local",
    "Quando um projeto precisar usar `dex-memoria` como skill local"
  ]);
  validateConscienciaTemplates(errors);
  validateGraduatedMemoryBattery(errors);
  requireText(errors, "CHANGELOG.md", ["## 0.1.6 - 2026-06-19", "## 0.1.5 - 2026-05-17", "## 0.1.4 - 2026-05-16", "## 0.1.3 - 2026-05-15", "## 0.1.2 - 2026-05-09"]);
  requireText(errors, "SECURITY.md", [
    "must not contain secrets",
    "does not provide the Dex Agent runtime",
    "fixture-only CLI",
    "live vault",
    "general-purpose runtime"
  ]);
  requireText(errors, "LICENSE", ["MIT License"]);
  validateLayeredMemoryExample(errors);
  validateNoForbiddenTrackedFiles(errors);
  validateNoHardcodedWindowsUserProfilePath(errors);
  validateResourceLimitPolicy(errors);

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log("dex-memoria public structure ok");
}

function validateResourceLimitPolicy(errors) {
  try {
    validateMemoryResourceLimitBundle(path.join(root, "contracts", "policies"));
  } catch (error) {
    errors.push(`Resource limit SHADOW policy failed: ${error.message}`);
  }
}

function validateNoHardcodedWindowsUserProfilePath(errors) {
  let trackedFiles;
  try {
    trackedFiles = execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    return;
  }

  const offenders = [];

  for (const file of trackedFiles) {
    const fullPath = path.join(root, file);
    let text;
    try {
      text = fs.readFileSync(fullPath, "utf8");
    } catch (error) {
      continue;
    }

    const drive = "C:";
    const userSegment = "Users";
    const tail = String.raw`[^\s` + "`" + String.raw`'"<>)]*`;
    const patterns = [
      new RegExp(escapeRegex(drive) + String.raw`\\` + userSegment + String.raw`\\` + tail, "g"),
      new RegExp(escapeRegex(drive) + String.raw`\\\\` + userSegment + String.raw`\\\\` + tail, "g"),
      new RegExp(escapeRegex(drive) + "/" + userSegment + "/" + tail, "g")
    ];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        offenders.push(`${file}: ${match[0]}`);
      }
    }
  }

  if (offenders.length > 0) {
    errors.push(
      [
        "Hardcoded Windows user profile paths are forbidden; use $env:USERPROFILE or os.homedir():",
        ...offenders.map((offender) => `- ${offender}`)
      ].join("\n")
    );
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateNoForbiddenTrackedFiles(errors) {
  let trackedFiles;
  try {
    trackedFiles = execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.replace(/\\/g, "/"));
  } catch (error) {
    return;
  }

  const forbidden = trackedFiles.filter((file) => {
    if (forbiddenTrackedFiles.has(file)) {
      return true;
    }
    if (/^\.env\./.test(file)) {
      return true;
    }
    return forbiddenTrackedPrefixes.some((prefix) => file.startsWith(prefix));
  });

  if (forbidden.length > 0) {
    errors.push(
      [
        "Forbidden local/dev files are tracked by Git:",
        ...forbidden.map((file) => `- ${file}`)
      ].join("\n")
    );
  }
}

function validateLayeredMemoryExample(errors) {
  const lembranca = readText("examples/layered-memory/lembranca.md", errors);
  const memoria = readText("examples/layered-memory/memoria.md", errors);
  const anchors = new Set([...memoria.matchAll(/\{#([^}]+)\}/g)].map((match) => match[1]));
  const links = [...lembranca.matchAll(/\]\(memoria\.md#([^)]+)\)/g)].map((match) => match[1]);

  if (links.length === 0) {
    errors.push("examples/layered-memory/lembranca.md must link to memoria.md anchors");
  }

  for (const anchor of links) {
    if (!anchors.has(anchor)) {
      errors.push(`Layered memory link points to missing anchor: ${anchor}`);
    }
  }

  requireText(errors, "examples/layered-memory/lembranca.md", ["#dex-memoria/exemplo-camadas", "[[memoria#^include-duplicacao|memoria]]", "^detalhe-sob-demanda"]);
  requireText(errors, "examples/layered-memory/memoria.md", ["Tags: `#dex-memoria/exemplo-camadas`", "Obsidian: L1", "Obsidian: L3"]);
  requireText(errors, "examples/layered-memory/conhecimento/detalhe-sob-demanda.md", ["L2 relacionada:", "Obsidian: L2 [[../memoria#^detalhe-sob-demanda|detalhe-sob-demanda]]"]);
}

function validateCreateContractSchemas(errors) {
  const schemas = new Map();
  for (const file of createContractSchemaFiles) {
    const schema = readJson(path.join("contracts", "schemas", file), errors);
    if (!schema) continue;
    schemas.set(file, schema);
  }
  errors.push(...validateCreateContractSchemaMap(schemas));
}

function validateGraduatedMemoryBattery(errors) {
  try {
    execFileSync(process.execPath, [path.join(root, "scripts", "validate-graduated-memory.js"), "--self-test"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const stdout = error.stdout ? String(error.stdout).trim() : "";
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    errors.push(["Graduated memory battery failed:", stdout, stderr].filter(Boolean).join("\n"));
  }
}

function validateConscienciaTemplates(errors) {
  requireText(errors, "templates/l1-lembranca.md", [
    "tagname especifica visivel",
    "[memoria.md#<ancora-estavel>](memoria.md#<ancora-estavel>)",
    "[[memoria#^<ancora-estavel>|memoria]]",
    "^<ancora-estavel>"
  ]);
  requireText(errors, "templates/l2-memoria.md", [
    "Tags: `#<dominio/tag-especifica>`",
    "Obsidian: L1 [[lembranca#^<ancora-estavel>|<GATILHO-CURTO>]]",
    "^<ancora-estavel>",
    "Obsidian: L3"
  ]);
  requireText(errors, "templates/l3-conhecimento-index.md", [
    "conhecimento/INDEX.md",
    "[[../memoria#^<ancora-estavel>|<ancora-estavel>]]"
  ]);
  requireText(errors, "templates/l3-conhecimento-file.md", [
    "L2 relacionada: [../memoria.md#<ancora-estavel>](../memoria.md#<ancora-estavel>)",
    "Obsidian: L2 [[../memoria#^<ancora-estavel>|<ancora-estavel>]]",
    "source: graphify -> confirmado"
  ]);
  requireText(errors, "templates/layered-memory-checklist.md", [
    "tagname especifica visivel",
    "[[memoria#^ancora|memoria]] ^ancora",
    "heading com `{#ancora}` e linha de block id `^ancora`",
    "Obsidian com `#^block-id`"
  ]);
}

function readJson(file, errors) {
  try {
    return JSON.parse(readText(file, errors));
  } catch (error) {
    errors.push(`Invalid JSON in ${file}: ${error.message}`);
    return null;
  }
}

function readText(file, errors) {
  try {
    return fs.readFileSync(path.join(root, file), "utf8");
  } catch (error) {
    errors.push(`Cannot read ${file}: ${error.message}`);
    return "";
  }
}

function requireText(errors, file, snippets) {
  const text = readText(file, errors);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      errors.push(`${file} must mention: ${snippet}`);
    }
  }
}

function rejectText(errors, file, snippets) {
  const text = readText(file, errors);
  for (const snippet of snippets) {
    if (text.includes(snippet)) {
      errors.push(`${file} must not mention: ${snippet}`);
    }
  }
}

function assertEqual(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label} must be ${expected}, got ${actual}`);
  }
}

main();
