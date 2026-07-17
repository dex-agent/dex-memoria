import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = join(repoRoot, "scripts", "run-memory-v2-create-recall-fixture.js");

test("integrated runner blocks fixture roots outside its governed laboratory", async (t) => {
  const fixture = await createBoundaryFixture(t, { rootsOutsideLaboratory: true });
  const result = await runRunner(fixture.args, fixture.env);
  assert.equal(result.exitCode, 3);
  assert.equal(JSON.parse(result.stderr).code, "SAFETY_BLOCKED");
  assert.equal(result.stdout, "");
});

test("integrated runner blocks identical current and baseline Finder files", async (t) => {
  const fixture = await createBoundaryFixture(t, { sameFinder: true });
  const result = await runRunner(fixture.args, fixture.env);
  assert.equal(result.exitCode, 3);
  assert.equal(JSON.parse(result.stderr).code, "SAFETY_BLOCKED");
  assert.equal(result.stdout, "");
});

test("integrated runner blocks a laboratory overlapping DEX_MEMORIA_HOME", async (t) => {
  const fixture = await createBoundaryFixture(t, { environmentVaultIsLaboratory: true });
  const result = await runRunner(fixture.args, fixture.env);
  assert.equal(result.exitCode, 3);
  assert.equal(JSON.parse(result.stderr).code, "SAFETY_BLOCKED");
  assert.equal(result.stdout, "");
});

async function createBoundaryFixture(t, options) {
  const root = await mkdtemp(join(tmpdir(), "dex-memory-precutover-boundary-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const laboratoryRoot = join(root, "laboratory");
  const outsideRoot = join(root, "outside");
  const liveVaultPath = join(root, "declared-live-vault");
  const runsRoot = options.rootsOutsideLaboratory ? outsideRoot : join(laboratoryRoot, "runs");
  await Promise.all([
    mkdir(laboratoryRoot, { recursive: true }),
    mkdir(runsRoot, { recursive: true }),
    mkdir(liveVaultPath, { recursive: true })
  ]);
  await writeFile(join(laboratoryRoot, "lab-marker.json"), `${JSON.stringify({
    contract: "dex.memory.precutover.clone.v0",
    disposable: true,
    live_vault_touched: false
  })}\n`);

  const names = ["l2-commit", "l2-recovery", "l3-commit", "l3-recovery"];
  const fixtureRoots = Object.fromEntries(await Promise.all(names.map(async (name) => {
    const fixtureRoot = join(runsRoot, name);
    await mkdir(fixtureRoot, { recursive: true });
    return [name, fixtureRoot];
  })));
  const requestL2 = join(fixtureRoots["l2-commit"], "request.json");
  const requestL3 = join(fixtureRoots["l3-commit"], "request.json");
  await Promise.all([writeFile(requestL2, "{}\n"), writeFile(requestL3, "{}\n")]);

  const toolsRoot = join(root, "tools-home", ".agents", "tools");
  const policiesRoot = join(root, "tools-home", ".agents", "policies");
  await Promise.all([mkdir(toolsRoot, { recursive: true }), mkdir(policiesRoot, { recursive: true })]);
  const linkValidator = join(toolsRoot, "link.ps1");
  const finder = join(root, "finder-current.ps1");
  const baselineFinder = options.sameFinder ? finder : join(root, "finder-baseline.ps1");
  await Promise.all([
    writeFile(linkValidator, "# synthetic tool\n"),
    writeFile(finder, "# synthetic tool\n"),
    writeFile(join(policiesRoot, "memory-policy.json"), "{}\n"),
    ...(options.sameFinder ? [] : [writeFile(baselineFinder, "# synthetic tool\n")])
  ]);

  return {
    args: [
      "--commit-fixture-l2", fixtureRoots["l2-commit"],
      "--recovery-fixture-l2", fixtureRoots["l2-recovery"],
      "--request-l2", requestL2,
      "--commit-fixture-l3", fixtureRoots["l3-commit"],
      "--recovery-fixture-l3", fixtureRoots["l3-recovery"],
      "--request-l3", requestL3,
      "--link-validator", linkValidator,
      "--finder", finder,
      "--baseline-finder", baselineFinder,
      "--legacy-fixture-root", join(runsRoot, "legacy"),
      "--laboratory-root", laboratoryRoot,
      "--live-vault-path", liveVaultPath
    ],
    env: options.environmentVaultIsLaboratory ? { ...process.env, DEX_MEMORIA_HOME: laboratoryRoot } : process.env
  };
}

function runRunner(args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [runnerPath, ...args], { cwd: repoRoot, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectRun);
    child.on("close", (exitCode) => resolveRun({
      exitCode,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8")
    }));
  });
}
