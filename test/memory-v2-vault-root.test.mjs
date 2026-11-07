import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { validateMemoryCapabilityRoot } = require("../bin/memory-v2-capabilities.js");

async function writeFixtureFile(root, relativePath, content) {
  const filePath = join(root, ...relativePath.split("/"));
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
}

async function createComposedVaultFixture(t, { deadLink = false } = {}) {
  const vault = await mkdtemp(join(tmpdir(), "dex-memory-vault-root-"));
  t.after(() => rm(vault, { recursive: true, force: true }));
  const ponteLines = deadLink
    ? ["ponte viva: [[temas/jev/nota#^ancora-jev]]", "ponte morta: [[temas/jev/inexistente#^nunca]]", ""]
    : ["ponte viva: [[temas/jev/nota#^ancora-jev]]", ""];
  const files = {
    "global/lembranca.md": [
      "# Lembranca global",
      "",
      "- alpha -> [alpha](memorias/alpha.md) [[memorias/alpha|alpha]] #memoria/teste ^alpha",
      ""
    ].join("\n"),
    "global/memorias/alpha.md": [
      "# Alpha",
      "",
      "corpo de teste do sub-root global.",
      "",
      "#memoria/teste",
      "",
      "[Voltar](../lembranca.md#^alpha) [[lembranca#^alpha|L1]]",
      "",
      ...ponteLines,
      "^alpha-content",
      ""
    ].join("\n"),
    "temas/jev/nota.md": [
      "# Nota jev",
      "",
      "conteudo vivo do tema (alvo cross-vault NAO-legacy: nunca MEMORIA.md/lembranca.md).",
      "",
      "^ancora-jev",
      ""
    ].join("\n")
  };
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(vault, relativePath, content);
  }
  return { vault, root: join(vault, "global") };
}

test("cross vault resolves via optional vault_root and is audited in cross_vault_links", async (t) => {
  const { root, vault } = await createComposedVaultFixture(t);

  const receipt = await validateMemoryCapabilityRoot({
    capability: "v2-obsidian",
    require_obsidian: true,
    root,
    vault_root: vault
  });

  assert.equal(receipt.ok, true, "link cross-vault vivo com vault_root nao deve reprovar o root (issue #5)");
  assert.ok(
    Array.isArray(receipt.evidence.cross_vault_links) && receipt.evidence.cross_vault_links.length === 1,
    "evidence.cross_vault_links deve auditar o link vivo com exatamente 1 entrada"
  );
  assert.match(
    receipt.evidence.cross_vault_links[0],
    /temas\/jev\/nota/,
    "a entrada cross_vault deve citar o destino no vault"
  );
  assert.equal(
    (receipt.errors || []).filter((error) => error.code === "UNRESOLVED_WIKILINK").length,
    0,
    "nenhum UNRESOLVED_WIKILINK para o link resolvido via vault_root"
  );
});

test("dead outside root still fails unresolved even with vault_root", async (t) => {
  const { root, vault } = await createComposedVaultFixture(t, { deadLink: true });

  const receipt = await validateMemoryCapabilityRoot({
    capability: "v2-obsidian",
    require_obsidian: true,
    root,
    vault_root: vault
  });

  assert.equal(receipt.ok, false, "link morto fora da raiz continua reprovando mesmo com vault_root");
  assert.ok(
    (receipt.errors || []).some((error) => error.code === "UNRESOLVED_WIKILINK"),
    "deve existir UNRESOLVED_WIKILINK para o destino inexistente"
  );
  assert.ok(
    (receipt.evidence.unresolved_wikilinks || []).some((label) => label.includes("temas/jev/inexistente")),
    "o label unresolved deve citar o destino morto"
  );
  assert.ok(
    (receipt.evidence.cross_vault_links || []).every((label) => !label.includes("inexistente")),
    "o link morto nao pode entrar em cross_vault_links"
  );
});

test("without vault root the validator stays fail-closed on cross-vault links", async (t) => {
  const { root } = await createComposedVaultFixture(t);

  const receipt = await validateMemoryCapabilityRoot({
    capability: "v2-obsidian",
    require_obsidian: true,
    root
  });

  assert.equal(receipt.ok, false, "sem vault_root o link cross-vault vivo continua UNRESOLVED (fail-closed preservado)");
  assert.ok(
    (receipt.errors || []).some((error) => error.code === "UNRESOLVED_WIKILINK"),
    "fail-closed root-relative e o comportamento sem o campo"
  );
  assert.ok(
    Array.isArray(receipt.evidence.cross_vault_links) && receipt.evidence.cross_vault_links.length === 0,
    "sem vault_root nenhuma entrada cross_vault e registrada"
  );
});

test("empty root returns ok false with EMPTY_ROOT instead of a vacuous green", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-empty-root-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  const receipt = await validateMemoryCapabilityRoot({
    capability: "v2-markdown",
    require_obsidian: false,
    root
  });

  assert.equal(receipt.ok, false, "raiz com 0 arquivos lidos nao pode devolver ok:true vazio (verde vazio do issue #5)");
  const emptyRoot = (receipt.errors || []).find((error) => error.code === "EMPTY_ROOT");
  assert.ok(emptyRoot, "deve existir erro com codigo estavel EMPTY_ROOT");
  assert.match(emptyRoot.message, /no V2 markdown surface|vault composto|vault_root/i, "a mensagem deve orientar o caso do vault composto");
});
