import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const contractFiles = [
  "SPEC.md",
  "SKILL.md",
  "docs/memory-home.md",
  "docs/memory-architecture-profiles.md"
];

test("Dex Memória V2 preserves public scopes independently from implementation version", async () => {
  const documents = await Promise.all(
    contractFiles.map(async (relativePath) => ({
      relativePath,
      text: await readFile(join(repoRoot, relativePath), "utf8")
    }))
  );

  for (const { relativePath, text } of documents) {
    assert.match(text, /Dex Mem[oó]ria V2/, `${relativePath}: missing public V2 identity`);
    assert.match(text, /Implementation-Version:\s*v2/i, `${relativePath}: missing implementation version`);
    assert.match(text, /Scope:\s*project\s*\|\s*global\s*\|\s*theme/i, `${relativePath}: missing scope dimension`);
    assert.match(text, /project\/local\s*->\s*<WORKSPACE>[\\\/]\.agents/i, `${relativePath}: project route drifted`);
    assert.match(text, /global\s*->\s*<DEX_MEMORIA_HOME>[\\\/]global/i, `${relativePath}: global route drifted`);
    assert.match(text, /theme\s*->\s*<DEX_MEMORIA_HOME>[\\\/]temas[\\\/]<tema>/i, `${relativePath}: theme route drifted`);
    assert.match(text, /dual-scope[^\n]*dois destinos[^\n]*dois recibos/i, `${relativePath}: dual-scope receipt contract missing`);
    assert.match(text, /implementation[\s\S]{0,80}scope[\s\S]{0,80}root[\s\S]{0,80}independentes/i, `${relativePath}: implementation is coupled to routing`);
    assert.match(text, /root[\s\S]{0,100}n[aã]o[\s\S]{0,60}(define|congela)[\s\S]{0,80}layout interno/i,
      `${relativePath}: root routing is confused with the internal layout`);
    assert.match(text, /V1 hist[oó]rico[\s\S]{0,120}(continua|permanece)[\s\S]{0,120}(recuper[aá]vel|recallable)/i,
      `${relativePath}: mixed V1/V2 recall is not required`);
    assert.match(text, /governed-theme-v2[\s\S]{0,200}(hist[oó]ric|fixture)[\s\S]{0,200}n[aã]o[\s\S]{0,100}(produto|umbrella|perfil ativo)/i,
      `${relativePath}: historical fixture is still presented as product identity`);
    assert.match(text, /(writer\/selector\s+ativo|Active-Write-Profile:\s*v2|writer\/selector:\s*`v2`|writer\/selector\s+live)/i,
      `${relativePath}: V2 is not declared as the active writer/selector`);
    assert.match(text, /legacy-v1[\s\S]{0,160}(reader\/restore|leitura|read-only|recuper[aá]vel)/i,
      `${relativePath}: V1 is not constrained to historical read/restore compatibility`);
  }
});

test("V2 internal paths are relative to resolved_root instead of theme-only", async () => {
  const profileMap = await readFile(
    join(repoRoot, "docs", "memory-architecture-profiles.md"),
    "utf8"
  );

  assert.match(profileMap, /<resolved_root>[\\/]lembranca\.md/i);
  assert.match(profileMap, /<resolved_root>[\\/]memorias[\\/]<slug>\.md/i);
  assert.match(profileMap, /<resolved_root>[\\/]conhecimento[\\/]<slug>[\\/]README\.md/i);
  assert.match(profileMap, /mesmo[\s\S]{0,40}`resolved_root`/i);
  assert.doesNotMatch(profileMap, /mesmo tema/i);
});

test("living documentation cannot demote the active V2 writer to historical fixtures", async () => {
  const [readme, spec, skill, profiles] = await Promise.all([
    readFile(join(repoRoot, "README.md"), "utf8"),
    readFile(join(repoRoot, "SPEC.md"), "utf8"),
    readFile(join(repoRoot, "SKILL.md"), "utf8"),
    readFile(join(repoRoot, "docs", "memory-architecture-profiles.md"), "utf8")
  ]);
  const readmeLive = readme.slice(0, readme.indexOf("## CLI V0 fixture-only"));
  const specActiveStart = spec.indexOf("### Contrato ativo do Dex Memoria V2");
  assert.notEqual(specActiveStart, -1);
  const specActiveEnd = spec.indexOf("\n## ", specActiveStart);
  const specActive = spec.slice(specActiveStart, specActiveEnd === -1 ? undefined : specActiveEnd);

  assert.doesNotMatch(readmeLive, /excecoes executaveis deste corte sao as bancadas fixture-only/i);
  assert.doesNotMatch(readme, /nao grava vault ou ledger vivo[\s\S]{0,100}excecoes executaveis sao as CLIs fixture-only/i);
  assert.match(specActive, /L1 -> L2` OU `L1 -> L3/i);
  assert.match(spec, /Cada lembranca V2[\s\S]{0,180}exatamente um destino ativo[\s\S]{0,180}L3/i);
  assert.doesNotMatch(profiles, /campos operacionais continuam V1/i);
  assert.doesNotMatch(skill, /verdade operacional em L1 -> L2 -> L3/i);
});

test("capability schema exposes both bidirectional V2 routes", async () => {
  const schema = JSON.parse(await readFile(
    join(repoRoot, "contracts", "schemas", "dex.memory.capability.v2.schema.json"),
    "utf8"
  ));
  const backlinkEdges = schema.properties.backlinks.items.enum;

  assert.deepEqual(backlinkEdges, [
    "L1->L2",
    "L2->L1",
    "L1->L3",
    "L3->L1",
    "L2->L3",
    "L3->L2"
  ]);
});

test("legacy examples are historical while the migrated L3 template is explicitly V2", async () => {
  const legacyArtifacts = [
    "examples/README.md",
    "docs/layered-memory-simulations.md"
  ];
  for (const relativePath of legacyArtifacts) {
    const text = await readFile(join(repoRoot, relativePath), "utf8");
    assert.match(text, /hist[oó]ric/i, `${relativePath}: legacy scope must be explicit`);
    assert.doesNotMatch(text, /approved_not_active/i, `${relativePath}: active V2 cannot be demoted`);
    assert.doesNotMatch(text, /cadeia vigente `L1 -> L2 -> L3`/i, `${relativePath}: V1-only chain cannot be called current`);
  }

  const [templateIndex, usage, changelog] = await Promise.all([
    readFile(join(repoRoot, "templates", "README.md"), "utf8"),
    readFile(join(repoRoot, "docs", "usage.md"), "utf8"),
    readFile(join(repoRoot, "CHANGELOG.md"), "utf8")
  ]);
  const currentSection = changelog.indexOf("## ");
  const currentSectionEnd = changelog.indexOf("\n## ", currentSection + 3);
  const unreleased = changelog.slice(0, currentSectionEnd === -1 ? undefined : currentSectionEnd);

  assert.match(templateIndex, /l3-conhecimento-file\.md[\s\S]{0,160}V2/i);
  assert.match(templateIndex, /demais templates[\s\S]{0,160}hist[oó]ric/i);
  assert.match(usage, /L1\s*<->\s*L2`\s*OU\s*`L1\s*<->\s*L3/i);
  assert.match(unreleased, /V2[\s\S]{0,120}writer[\s\S]{0,80}ativo/i);
  assert.doesNotMatch(unreleased, /V2 como `approved_not_active`/i);
});
