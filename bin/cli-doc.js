"use strict";

// Contrato documental do CLI dex-memoria: tabela unica COMMAND_DOC + guard.
// Este modulo so DESCREVE o contrato (usage/schema/exemplos); nao executa
// operacoes reais. Una fonte para as flags documentais; o slot --describer
// (quarteto) fica reservado e inativo. A entrada raiz espelha printHelp()
// de bin/dex-memoria.js ate a migracao completa: edicoes de comandos devem
// atualizar as duas superficies.

const COMMAND_DOC = {
  "": {
    description: "dex-memoria — contrato documental para ciclo de vida de memoria operacional.",
    usage: [
      "dex-memoria doctor",
      "dex-memoria memory-home",
      "dex-memoria install [--registry-target <path>] [--force] [--dry-run]",
      "dex-memoria create plan --fixture <fixture-root>",
      "dex-memoria create apply --fixture <fixture-root>",
      "dex-memoria create recover --fixture <fixture-root>",
      "dex-memoria routes inspect --fixture <fixture-root>",
      "dex-memoria v2 remember",
      "dex-memoria v2 plan",
      "dex-memoria v2 apply",
      "dex-memoria v2 resume",
      "dex-memoria v2 recover",
      "dex-memoria v2 validate",
      "dex-memoria v2 validate-root",
      "dex-memoria v2 capability",
      "dex-memoria version"
    ],
    schema: {
      contract: "dex.memory.cli.doc.v1",
      commands: {
        doctor: "diagnostico da instalacao",
        "memory-home": "resolvedor do diretorio raiz de memorias",
        install: "instala o redirecionador global no registry de skills",
        "create plan": "planeja transacao de criacao a partir de fixture",
        "create apply": "aplica transacao de criacao a partir de fixture",
        "create recover": "recupera transacao de criacao interrompida",
        "routes inspect": "inspeciona rotas de memoria a partir de fixture",
        "v2 remember": "grava memoria via payload JSON em stdin",
        "v2 plan": "planeja operacao de memoria V2",
        "v2 apply": "aplica operacao de memoria V2",
        "v2 resume": "retoma pendencia de irmao em transacao V2",
        "v2 recover": "recupera transacao V2 interrompida",
        "v2 validate": "valida unidade de capacidade de memoria",
        "v2 validate-root": "valida raiz de memorias",
        "v2 capability": "emite receipt de capacidade",
        version: "versao do pacote"
      }
    },
    examples: [
      "dex-memoria --help",
      "dex-memoria v2 remember --schema",
      "dex-memoria doctor"
    ]
  },
  doctor: {
    description: "Diagnostico da instalacao do dex-memoria.",
    usage: ["dex-memoria doctor"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: null } },
    examples: ["dex-memoria doctor"]
  },
  "memory-home": {
    description: "Imprime o diretorio raiz de memorias resolvido.",
    usage: ["dex-memoria memory-home"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: null } },
    examples: ["dex-memoria memory-home"]
  },
  install: {
    description: "Instala o redirecionador global no registry de skills.",
    usage: ["dex-memoria install [--registry-target <path>] [--force] [--dry-run]"],
    schema: {
      contract: "dex.memory.cli.doc.v1",
      argv: {
        args: [
          { name: "--registry-target <path>", required: false },
          { name: "--force", required: false },
          { name: "--dry-run", required: false }
        ],
        stdin: null
      }
    },
    examples: ["dex-memoria install --dry-run"]
  },
  create: {
    description: "Transacoes de criacao a partir de fixture.",
    usage: [
      "dex-memoria create plan --fixture <fixture-root>",
      "dex-memoria create apply --fixture <fixture-root>",
      "dex-memoria create recover --fixture <fixture-root>"
    ],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { subcommands: ["plan", "apply", "recover"], stdin: null } },
    examples: ["dex-memoria create plan --fixture <fixture-root>"]
  },
  "create plan": {
    description: "Planeja a transacao de criacao a partir de fixture.",
    usage: ["dex-memoria create plan --fixture <fixture-root>"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: [{ name: "--fixture <fixture-root>", required: true }], stdin: null } },
    examples: ["dex-memoria create plan --fixture exemplos/fixture"]
  },
  "create apply": {
    description: "Aplica a transacao de criacao a partir de fixture.",
    usage: ["dex-memoria create apply --fixture <fixture-root>"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: [{ name: "--fixture <fixture-root>", required: true }], stdin: null } },
    examples: ["dex-memoria create apply --fixture exemplos/fixture"]
  },
  "create recover": {
    description: "Recupera transacao de criacao interrompida.",
    usage: ["dex-memoria create recover --fixture <fixture-root>"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: [{ name: "--fixture <fixture-root>", required: true }], stdin: null } },
    examples: ["dex-memoria create recover --fixture exemplos/fixture"]
  },
  routes: {
    description: "Inspecao de rotas de memoria.",
    usage: ["dex-memoria routes inspect --fixture <fixture-root>"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { subcommands: ["inspect"], stdin: null } },
    examples: ["dex-memoria routes inspect --fixture exemplos/fixture"]
  },
  "routes inspect": {
    description: "Inspeciona rotas de memoria a partir de fixture.",
    usage: ["dex-memoria routes inspect --fixture <fixture-root>"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: [{ name: "--fixture <fixture-root>", required: true }], stdin: null } },
    examples: ["dex-memoria routes inspect --fixture exemplos/fixture"]
  },
  v2: {
    description: "Operacoes de memoria V2 (runtime transacional).",
    usage: [
      "dex-memoria v2 remember",
      "dex-memoria v2 plan",
      "dex-memoria v2 apply",
      "dex-memoria v2 resume",
      "dex-memoria v2 recover",
      "dex-memoria v2 validate",
      "dex-memoria v2 validate-root",
      "dex-memoria v2 capability"
    ],
    schema: {
      contract: "dex.memory.cli.doc.v1",
      argv: { subcommands: ["remember", "plan", "apply", "resume", "recover", "validate", "validate-root", "capability"] }
    },
    examples: ["dex-memoria v2 remember --schema"]
  },
  "v2 remember": {
    description: "Grava memoria V2 a partir de exatamente um documento JSON em stdin.",
    usage: ["dex-memoria v2 remember", "echo '<payload.json>' | dex-memoria v2 remember"],
    schema: {
      contract: "dex.memory.remember.request.v2",
      stdin: "exatamente um documento JSON valido",
      fields: {
        scope: { type: "string", required: true, values: ["project", "global", "theme", "dual"] },
        title: { type: "string", required: true, max_chars: 256 },
        trigger: { type: "string", required: true, max_chars: 512 },
        body: { type: "string", required: true, max_chars: 65536 },
        tags: { type: "array<string>", required: true, note: "lista nao vazia; forma #tema/assunto" },
        target_layer: { type: "string", optional: true, default: "L2" },
        theme: { type: "string", required_if: "scope=theme" },
        owner_skill: { type: "string", required_if: "target_layer=L3" },
        slug: { type: "string", optional: true, note: "helper gera valor deterministico" },
        operation_id: { type: "string", optional: true, note: "helper gera valor deterministico" }
      },
      receipt: "dex.memory.remember.receipt.v2"
    },
    examples: [
      'cat payload.json | dex-memoria v2 remember',
      "dex-memoria v2 remember --schema"
    ]
  },
  "v2 plan": {
    description: "Planeja operacao de memoria V2 (payload JSON em stdin).",
    usage: ["dex-memoria v2 plan"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON de planejamento" } },
    examples: ["dex-memoria v2 plan"]
  },
  "v2 apply": {
    description: "Aplica operacao de memoria V2 (payload JSON em stdin).",
    usage: ["dex-memoria v2 apply"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON de aplicacao" } },
    examples: ["dex-memoria v2 apply"]
  },
  "v2 resume": {
    description: "Retoma pendencia de irmao em transacao V2 (payload JSON em stdin).",
    usage: ["dex-memoria v2 resume"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON de retomada" } },
    examples: ["dex-memoria v2 resume"]
  },
  "v2 recover": {
    description: "Recupera transacao V2 interrompida (payload JSON em stdin).",
    usage: ["dex-memoria v2 recover"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON de recuperacao" } },
    examples: ["dex-memoria v2 recover"]
  },
  "v2 validate": {
    description: "Valida unidade de capacidade de memoria (payload JSON em stdin).",
    usage: ["dex-memoria v2 validate"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON da unidade" } },
    examples: ["dex-memoria v2 validate"]
  },
  "v2 validate-root": {
    description: "Valida raiz de memorias (payload JSON em stdin).",
    usage: ["dex-memoria v2 validate-root"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON da raiz" } },
    examples: ["dex-memoria v2 validate-root"]
  },
  "v2 capability": {
    description: "Emite receipt de capacidade (payload JSON em stdin).",
    usage: ["dex-memoria v2 capability"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: "documento JSON de capacidade" } },
    examples: ["dex-memoria v2 capability"]
  },
  version: {
    description: "Imprime a versao do pacote.",
    usage: ["dex-memoria version"],
    schema: { contract: "dex.memory.cli.doc.v1", argv: { args: 0, stdin: null } },
    examples: ["dex-memoria version"]
  }
};

const DOC_FLAG_KINDS = {
  "--help": "help",
  "-h": "help",
  "--schema": "schema",
  "--usage": "usage"
};

const GROUP_COMMANDS = new Set(["v2", "create", "routes"]);

function detectDocKind(args) {
  for (const arg of args) {
    const kind = DOC_FLAG_KINDS[arg];
    if (kind) {
      return kind;
    }
  }
  return null;
}

function commandKey(args) {
  const clean = args.filter((arg) => !DOC_FLAG_KINDS[arg] && arg !== "help");
  if (clean.length === 0) {
    return "";
  }
  const first = clean[0];
  if (GROUP_COMMANDS.has(first)) {
    const second = clean[1];
    if (second && !second.startsWith("-")) {
      return `${first} ${second}`;
    }
    return first;
  }
  return first;
}

function docEntry(key) {
  if (COMMAND_DOC[key]) {
    return COMMAND_DOC[key];
  }
  const group = key.split(" ")[0];
  return COMMAND_DOC[group] || COMMAND_DOC[""];
}

function printLines(lines) {
  for (const line of lines) {
    console.log(line);
  }
}

function emitDoc(kind, args) {
  const entry = docEntry(commandKey(args));
  if (kind === "schema") {
    console.log(JSON.stringify(entry.schema, null, 2));
    return;
  }
  if (kind === "usage") {
    printLines([entry.description, "", "Exemplos:", ...entry.examples]);
    return;
  }
  printLines([entry.description, "", "Uso:", ...entry.usage]);
}

// Guard documental: intercepta --help/-h/--schema/--usage em qualquer nivel
// ANTES do dispatch. Retorna true quando respondeu (caller deve retornar e
// encerrar com exit 0); false quando nenhuma flag documental esta presente.
function handleDocFlags(args) {
  const kind = detectDocKind(args);
  if (!kind) {
    return false;
  }
  emitDoc(kind, args);
  return true;
}

module.exports = {
  COMMAND_DOC,
  detectDocKind,
  commandKey,
  handleDocFlags
};
