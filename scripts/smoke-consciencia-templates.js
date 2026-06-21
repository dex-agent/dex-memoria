#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const userProfile = process.env.USERPROFILE || process.env.HOME || "";
const defaultMemoryHome = userProfile ? path.join(userProfile, ".agents", "memories") : "";
const memoryHome = process.env.DEX_MEMORIA_HOME || defaultMemoryHome;
const keepTemp = process.argv.includes("--keep-temp");

function main() {
  const tools = resolveTools();
  const themePath = fs.mkdtempSync(path.join(os.tmpdir(), "dex-memoria-consciencia-"));

  try {
    writeSmokeTheme(themePath);
    const tags = runValidator("tags", tools.tags, [
      "-ThemePath",
      themePath,
      "-AsJson"
    ]);
    const links = runValidator("links", tools.links, [
      "-ThemePath",
      themePath,
      "-RequireObsidian",
      "-AsJson",
      "-MaxElapsedSeconds",
      "10",
      "-MaxFileBytes",
      "200000",
      "-MaxLines",
      "5000",
      "-MaxRefs",
      "500",
      "-MaxL3Files",
      "50"
    ]);

    assertOk("tags", tags);
    assertOk("links", links);
    assertEqual(tags.counts.errors, 0, "tag errors");
    assertEqual(tags.counts.warnings, 0, "tag warnings");
    assertEqual(links.errors.length, 0, "link errors");
    assertEqual(links.warnings.length, 0, "link warnings");
    assertEqual(links.counts.l1_refs, 1, "L1 refs");
    assertEqual(links.counts.l1_block_ids, 1, "L1 block ids");
    assertEqual(links.counts.l2_anchors, 1, "L2 anchors");
    assertEqual(links.counts.l2_block_ids, 1, "L2 block ids");
    assertEqual(links.counts.l3_files_excluding_index, 1, "L3 files");

    console.log("consciencia template smoke ok");
    console.log(keepTemp ? `theme_path=${themePath}` : "theme_path=<removed>");
  } finally {
    if (!keepTemp) {
      fs.rmSync(themePath, { recursive: true, force: true });
    }
  }
}

function resolveTools() {
  if (!memoryHome) {
    fail("Cannot resolve DEX_MEMORIA_HOME or user profile for consciencia validators");
  }

  const tools = {
    tags: path.join(memoryHome, ".agents", "tools", "validate-memory-tags.ps1"),
    links: path.join(memoryHome, ".agents", "tools", "validate-memory-links.ps1")
  };

  for (const [name, file] of Object.entries(tools)) {
    if (!fs.existsSync(file)) {
      fail(`Missing ${name} validator: ${file}`);
    }
  }

  return tools;
}

function writeSmokeTheme(themePath) {
  const knowledgePath = path.join(themePath, "conhecimento");
  fs.mkdirSync(knowledgePath, { recursive: true });

  writeFile(path.join(themePath, "lembranca.md"), `---
tags:
  - ppirtv/memoria-testavel
aliases:
  - memoria testavel
status: ativa
layer: l1
theme: ppirtv
---

# L1 - Lembranca

- [PPIRTV-MEMORIA-TESTAVEL] memoria nova precisa nascer validavel #ppirtv/memoria-testavel -> validar L1/L2/L3 antes de declarar pronta -> [memoria.md#ppirtv-memoria-testavel](memoria.md#ppirtv-memoria-testavel) | [[memoria#^ppirtv-memoria-testavel|memoria]] ^ppirtv-memoria-testavel
`);

  writeFile(path.join(themePath, "memoria.md"), `---
tags:
  - ppirtv/memoria-testavel
aliases:
  - memoria testavel
status: ativa
layer: l2
theme: ppirtv
---

# L2 - Memoria

## PPIRTV Memoria Testavel {#ppirtv-memoria-testavel}
^ppirtv-memoria-testavel

Localizador: \`PPIRTV-MEMORIA-TESTAVEL\`
Tags: \`#ppirtv/memoria-testavel\`
Aliases: \`memoria testavel; memoria validavel\`
Anti-aliases/confusoes: \`nota solta; ledger sem gatilho\`
Obsidian: L1 [[lembranca#^ppirtv-memoria-testavel|PPIRTV-MEMORIA-TESTAVEL]]
Obsidian: L3 [[conhecimento/ppirtv-memoria-testavel.md|ppirtv-memoria-testavel.md]]

### Problema

Memoria nova pode parecer organizada, mas nao ser recuperavel.

### Mecanismo

L1 precisa acionar L2 e L3 precisa voltar para L2.

### Verificacao

\`\`\`text
validar tags, links, anchors e block ids no corte
\`\`\`

### Quando Lembrar

- Ao criar memoria operacional nova.

### Quando Nao Lembrar

- Quando for apenas ledger resolvido.

### Conhecimento Sob Demanda

- L3: [conhecimento/ppirtv-memoria-testavel.md](conhecimento/ppirtv-memoria-testavel.md)
`);

  writeFile(path.join(knowledgePath, "INDEX.md"), `# L3 - Conhecimento

- [ppirtv-memoria-testavel.md](ppirtv-memoria-testavel.md) -> [../memoria.md#ppirtv-memoria-testavel](../memoria.md#ppirtv-memoria-testavel) | [[../memoria#^ppirtv-memoria-testavel|ppirtv-memoria-testavel]]
`);

  writeFile(path.join(knowledgePath, "ppirtv-memoria-testavel.md"), `# PPIRTV Memoria Testavel

Localizador: \`PPIRTV-MEMORIA-TESTAVEL\`
Tags: \`#ppirtv/memoria-testavel\`
Aliases: \`memoria testavel; memoria validavel\`
L2 relacionada: [../memoria.md#ppirtv-memoria-testavel](../memoria.md#ppirtv-memoria-testavel)
Obsidian: L2 [[../memoria#^ppirtv-memoria-testavel|ppirtv-memoria-testavel]]

## Objetivo

Provar que a memoria nasce recuperavel.

## Validacao

Rodar validadores de tags e links com RequireObsidian.
`);
}

function writeFile(file, text) {
  fs.writeFileSync(file, text.replace(/\n/g, os.EOL), "utf8");
}

function runValidator(label, scriptPath, args) {
  const result = spawnSync("powershell", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    ...args
  ], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    fail([
      `${label} validator failed with exit code ${result.status}`,
      result.stdout.trim(),
      result.stderr.trim()
    ].filter(Boolean).join("\n"));
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(`${label} validator did not return JSON: ${error.message}\n${result.stdout}`);
  }
}

function assertOk(label, payload) {
  if (!payload || payload.ok !== true) {
    fail(`${label} validator returned ok=false\n${JSON.stringify(payload, null, 2)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} expected ${expected}, got ${actual}`);
  }
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

main();
