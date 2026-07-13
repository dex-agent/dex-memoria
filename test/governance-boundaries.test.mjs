import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const smokeScript = join(repoRoot, "scripts", "smoke-consciencia-templates.js");

async function readRepoFile(file) {
  return readFile(join(repoRoot, file), "utf8");
}

test("automatic memory governance requires an already-authorized physical mechanism", async () => {
  const skill = await readRepoFile("SKILL.md");
  const trio = skill.match(/### Trio Operacional[\s\S]*?(?=\n## |\n### )/)?.[0] ?? "";
  const boundary = skill.match(/## Fronteira De Escrita[\s\S]*?(?=\n## )/)?.[0] ?? "";

  assert.match(trio, /mecanismo fisico ja autorizado/i);
  assert.match(trio, /sem pedir permissao adicional/i);
  assert.match(boundary, /nao possui runtime proprio/i);
  assert.match(boundary, /mecanismo autorizado do ambiente/i);
});

test("public tests stay self-contained while consciencia remains an explicit local integration", async () => {
  const packageJson = JSON.parse(await readRepoFile("package.json"));
  const usage = await readRepoFile("docs/usage.md");
  const smoke = await readRepoFile("scripts/smoke-consciencia-templates.js");

  assert.doesNotMatch(packageJson.scripts.test, /smoke:consciencia/);
  assert.match(packageJson.scripts["test:local"], /npm test/);
  assert.match(packageJson.scripts["test:local"], /smoke:consciencia/);
  assert.match(usage, /integracao local/i);
  assert.match(usage, /memory-policy\.ps1/);
  assert.match(usage, /memory-policy\.json/);
  assert.match(usage, /memory-policy\.compat\.json/);
  assert.doesNotMatch(smoke, /["']-MaxFileBytes["']/);
});

test("consciencia smoke names each missing canonical policy dependency before validator execution", async () => {
  const files = {
    tags: [".agents", "tools", "validate-memory-tags.ps1"],
    links: [".agents", "tools", "validate-memory-links.ps1"],
    policyResolver: [".agents", "tools", "memory-policy.ps1"],
    policy: [".agents", "policies", "memory-policy.json"],
    compatibilityPolicy: [".agents", "policies", "memory-policy.compat.json"]
  };
  const expected = {
    policyResolver: "Missing policy resolver:",
    policy: "Missing canonical policy:",
    compatibilityPolicy: "Missing compatibility policy:"
  };

  for (const missing of Object.keys(expected)) {
    const memoryHome = await mkdtemp(join(tmpdir(), "dex-memoria-missing-policy-"));
    try {
      for (const [name, segments] of Object.entries(files)) {
        if (name === missing) continue;
        const file = join(memoryHome, ...segments);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, "fixture", "utf8");
      }

      const result = spawnSync(process.execPath, [smokeScript], {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, DEX_MEMORIA_HOME: memoryHome }
      });

      assert.equal(result.status, 1, `missing ${missing} must fail before validators run`);
      assert.match(result.stderr, new RegExp(expected[missing], "i"));
      assert.doesNotMatch(result.stderr, /at main|node:internal/i);
    } finally {
      await rm(memoryHome, { recursive: true, force: true });
    }
  }
});
