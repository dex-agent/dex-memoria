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

async function createCapabilityRootWithOrphanLine(t) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-orphan-l1-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const files = {
    "lembranca.md": [
      "# Lembranca",
      "",
      "- [Memoria](memorias/topic.md#^memory-topic) [[memorias/topic#^memory-topic|Topic]] #memoria/teste ^memory-topic",
      "- [Orfa](memorias/orfa.md#^memory-orfa) [[memorias/orfa#^memory-orfa|Orfa]] #memoria/teste ^memory-orfa",
      ""
    ].join("\n"),
    "memorias/topic.md": [
      "# Memoria",
      "",
      "[L1](../lembranca.md#^memory-topic) [[lembranca#^memory-topic|Trigger]]",
      "^memory-topic",
      ""
    ].join("\n")
  };
  for (const [relativePath, content] of Object.entries(files)) {
    await writeFixtureFile(root, relativePath, content);
  }
  return root;
}

test("validateMemoryCapabilityRoot reports ORPHAN_L1_LINE when an L1 line points to a missing destination", async (t) => {
  const root = await createCapabilityRootWithOrphanLine(t);

  const receipt = await validateMemoryCapabilityRoot({
    capability: "v2-obsidian",
    require_obsidian: true,
    root
  });

  assert.equal(receipt.ok, false, "linha L1 com destino inexistente deve reprovar o root");
  const orphan = (receipt.errors || []).find((error) => error.code === "ORPHAN_L1_LINE");
  assert.ok(orphan, "deve existir erro com codigo estavel ORPHAN_L1_LINE (issue #2)");
  assert.match(orphan.message, /memorias\/orfa\.md/, "a mensagem deve citar o destino inexistente da linha do L1");
  assert.doesNotMatch(
    (receipt.errors || []).map((error) => error.message).join(" "),
    /topic/,
    "a memoria valida (topic) nao deve ser acusada de orfa"
  );
});
