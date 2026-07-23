# Dex Memoria V2 consolidation and SHADOW map

> Historical snapshot, superseded for operational authority. This document
> records the fixture/SHADOW state observed on 2026-07-16. The current writer
> and selector are V2; `legacy-v1` is reader/restore only. Use
> `docs/memory-architecture-profiles.md`, `SKILL.md` and `docs/usage.md` for the
> living contract.

This document is the portable product map for the V2 experimental surfaces
consolidated and exercised in SHADOW on 2026-07-16. It does not activate V2,
change the active write profile, install a global skill, or authorize a
live-vault test.

## Authority states

| State | Meaning |
| --- | --- |
| `ACTIVE` | The current operational authority. For writes this remains `legacy-v1`. |
| `FIXTURE_ONLY` | Executable only inside an explicitly marked disposable fixture. |
| `CANDIDATE_SHADOW` | Calculates or compares out of band and never decides the operational result. |
| `EXTERNAL_CONSUMER` | Lives outside this package and is accepted only through an explicit path and an independent receipt. |
| `APPROVED_NOT_ACTIVE` | Approved target architecture without live activation. |

`governed-theme-v2` remains `APPROVED_NOT_ACTIVE`. The highest verdict this
consolidation and SHADOW can support is `shadow-ready`, never `live-ready`.
The earlier consolidation-only milestone remains recorded as `fixture-ready`.

## Product map

| Role | Owner and surface | State | Input | Output or receipt |
| --- | --- | --- | --- | --- |
| V2 planner/writer/recovery | `bin/dex-memoria.js` and `bin/create-theme-v2-transaction.js` | `FIXTURE_ONLY` | Marked create fixture plus explicit JSON request | Plan or `dex.memory.create.theme-v2.receipt.v0` |
| Independent route reader | `bin/inspect-theme-v2-routes.js` | `FIXTURE_ONLY` | Marked transaction fixture | `dex.memory.routes.inspect.v0` |
| Read-only invariance fingerprint | `test/support/vault-fingerprint.js` | `FIXTURE_ONLY` test support | Explicit allowlisted root | Deterministic tree/file fingerprint |
| Integrated create/recall adapter | `scripts/run-memory-v2-create-recall-fixture.js` | `FIXTURE_ONLY` | Four disjoint fixtures and explicit validator/Finder paths | `dex.memory.create-recall.fixture-receipt.v0` |
| Resource-limit bundle | `contracts/policies/dex.memory.resource-limits.v1.json` | `CANDIDATE_SHADOW` | Explicit bundle path | Candidate values only |
| Resource-limit loaders | `scripts/read-memory-resource-limits-shadow.js` and `.ps1` | `CANDIDATE_SHADOW` | Explicit bundle plus provenance | Parsed candidate or fail-closed diagnostic |
| Resource-limit comparator | `scripts/compare-memory-resource-limits-shadow.js` | `CANDIDATE_SHADOW` | Current observation plus candidate | Separate match/mismatch receipt |
| Node SHADOW runners | `scripts/run-memory-*-shadow-fixture.js` | `FIXTURE_ONLY` + `CANDIDATE_SHADOW` | Marked fixture; optional explicit bundle and receipt | Unchanged operational result plus optional comparison receipt |
| Manual pilot skill | `skills/dex-memoria-v2-pilot/` | `FIXTURE_ONLY`, repository-only | Governed laboratory and explicit external tools | Preserved pilot directory, `receipt.json`, `PILOT-MANIFEST.json` |

The pilot skill is intentionally not installed and is not listed in
`package.json#files`. A future packaging decision must be explicit and must not
be inferred from its presence in the repository.

## External consumers

These consumers remain physically outside `dex-memoria`. They are not copied
into this package and must not be discovered implicitly:

| Consumer | Owner | Current role | V2 condition |
| --- | --- | --- | --- |
| Finder (`obsidian-memoria-cli`) | Global skill registry | Recall engine; `legacy-v1` default | Explicit `governed-theme-v2`, disposable fixture and fresh routes receipt |
| Memory policy | Memory vault tools | Current file classification and byte limits | V2 classification only through explicit fixture profile |
| Link validator | Memory vault tools | Independent graph validation | Explicit profile, fixture root and routes receipt |
| Tag validator | Memory vault tools | Current tag/file boundary | Candidate limit compared out of band |
| Safety smoke | Memory vault tools | Legacy safety baseline | V2 only through explicit opt-in delegated to the canonical fixture test |
| Installed `dex-memoria` skill | Dex Agent skill installation | Operational fallback for the published V1 line | No automatic sync from this working tree |

The Finder, policy, validators and smoke remain external dependencies. Their
SHADOW receipts prove compatibility only against synthetic disposable
fixtures, not against the live vault.

## SHADOW result

The consumer SHADOW completed with the current `legacy-v1` path executing
first and retaining authority. The V2 candidate ran only afterward and outside
the decision path.

- 24 independent consumer receipts: writer, rollback, routes, Finder current
  versus preserved baseline, policy, links, tags, smoke, resource limits and
  non-vacuous V1 no-shrink;
- six Finder comparisons: trigger, slug and natural phrase for direct L2 and
  direct L3;
- five isolated distribution receipts: dry-run, fresh install, upgrade,
  rollback and aggregate;
- one final protected-boundary receipt comparing the live vault and installed
  fallback against their pre-V2 ZIP backups by path, size and SHA-256;
- consumer aggregate: `PASS`, zero open mismatch, `current_precedence=true`;
- distribution aggregate: `PASS`, global installed surfaces unchanged;
- final boundary: 2,830/2,830 vault files and 50/50 installed-skill files,
  with zero missing, extra, length mismatch or hash mismatch.

The installed fallback and registry were never overwritten. Fresh install and
upgrade were executed only against copies in the governed laboratory, followed
by an exact rollback to the copied baseline.

## Fixture-only commands

### Public V2 create and route inspection

```powershell
node .\bin\dex-memoria.js create plan --fixture <fixture-root>
node .\bin\dex-memoria.js create apply --fixture <fixture-root>
node .\bin\dex-memoria.js create recover --fixture <fixture-root>
node .\bin\dex-memoria.js routes inspect --fixture <fixture-root>
```

Every fixture must be disposable, marked and outside the repository and live
memory vault.

### Resource-limit SHADOW

```powershell
node .\scripts\run-memory-resource-limits-shadow-fixture.js --consumer dex-memoria.cli --fixture <fixture-root>
node .\scripts\run-memory-resource-limits-shadow-fixture.js --consumer dex-memoria.cli --fixture <fixture-root> --bundle .\contracts\policies --receipt <fixture-root>\receipts\cli.json

node .\scripts\run-memory-tag-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-tags.ps1>
node .\scripts\run-memory-tag-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-tags.ps1> --bundle .\contracts\policies --receipt <fixture-root>\receipts\tags.json

node .\scripts\run-memory-link-line-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-links.ps1>
node .\scripts\run-memory-link-line-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-links.ps1> --bundle .\contracts\policies --receipt <fixture-root>\receipts\links.json
```

Without both candidate arguments, only the current operation runs. A mismatch
receipt never changes the operational result.

### Integrated automated test

```powershell
$env:DEX_MEMORY_V2_INTEGRATION = '1'
$env:DEX_MEMORY_V2_LINK_VALIDATOR = '<absolute-validate-memory-links.ps1>'
$env:DEX_MEMORY_V2_FINDER = '<absolute-current-find-memory.ps1>'
$env:DEX_MEMORY_V2_BASELINE_FINDER = '<absolute-baseline-find-memory.ps1>'
node --test .\test\create-recall-v2-integrated.test.mjs
```

The test creates new temporary fixtures only under the governed laboratory. It
does not use the live vault as fixture or destination.

### Assisted pre-cutover rehearsal in an isolated clone

This route remains fixture-only and never activates V2. Its owner is the
`dex-memoria` maintainer operating an approved PPIRTV Trilho. Trigger it only
after a complete backup has a verified listing, size and SHA-256 and a human
checkpoint names the final SPT fingerprint, laboratory root and sealed ZIP.

| Artifact | Purpose | Input | Output | Principal risk | Validation |
| --- | --- | --- | --- | --- | --- |
| `scripts/run-memory-v2-precutover-clone.ps1` | Seal, extract, compare and restore a disposable clone | verified ZIP, new laboratory root, declared live-vault deny path | one sanitized aggregate receipt; private manifest stays in the laboratory | path escape or treating cleanup as candidate recovery | `test/precutover-clone-v2.test.mjs` |
| `contracts/fixtures/precutover-v1-recall-corpus.v0.json` | Freeze the synthetic V1 localizer, tag and natural-phrase oracle | no runtime input | three deterministic query forms and opaque result identities | global ranking used as oracle | `test/precutover-evidence-gate.test.mjs` |
| `scripts/validate-memory-v2-precutover-evidence.js` | Enforce a closed evidence allowlist and fail-closed redaction | one JSON document on stdin | one aggregate `dex.memory.precutover.evidence-gate.v0` line | private path, heading, snippet or payload promotion | `test/precutover-evidence-gate.test.mjs` |
| `scripts/run-memory-v2-create-recall-fixture.js` | Exercise L2/L3 create, retry, recovery, recall and V1 no-shrink | four disjoint V2 fixtures, a new V1 fixture root and explicit external tools | private integrated receipt for subsequent sanitized projection | implicit live path or self-validating oracle | `test/create-recall-v2-integrated.test.mjs` |

Preparation and full-clone verification:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  ".\scripts\run-memory-v2-precutover-clone.ps1" `
  -Command prepare `
  -SourceZip "<absolute-verified-backup.zip>" `
  -LaboratoryRoot "<absolute-new-timestamped-laboratory>" `
  -ExpectedSourceSha256 "<64-hex-sha256>" `
  -LiveVaultPath "<absolute-live-vault-deny-path>"
```

Set `DEX_MEMORY_V2_LAB_ROOT` to the timestamped laboratory root,
`DEX_MEMORY_V2_CLONE_BASELINE_ROOT` to its exact `baseline` child,
`DEX_MEMORY_V2_LIVE_VAULT_PATH` to the explicit deny path and
`DEX_MEMORY_V2_PRIVATE_RECEIPT_PATH` to a new file directly under the same
laboratory's `private` directory before running the integrated test. The raw
receipt is private input, never evidence. Project only aggregate fields through
`validate-memory-v2-precutover-evidence.js` before promotion.

Rollback has two distinct meanings: candidate recovery must be proved by the
writer plus an independent tree hash; `restore-cleanup` only restores the whole
working clone to its immutable baseline after those proofs and must never be
reported as candidate recovery.

### Preserved manual pilot

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  ".\skills\dex-memoria-v2-pilot\scripts\run-v2-memory-pilot.ps1" `
  -LinkValidator "<absolute-validate-memory-links.ps1>" `
  -Finder "<absolute-current-find-memory.ps1>" `
  -BaselineFinder "<absolute-baseline-find-memory.ps1>"
```

Use `-OutputRoot` only for a new child of
`%USERPROFILE%\.agents\laboratorio-memories`. The output is retained for manual
inspection and is never removed automatically. All three external tool paths
are mandatory; the pilot performs no implicit discovery.

## Backup and rollback

Rollback is layered and must preserve unrelated working-tree changes:

1. Repository code: reconstruct only the allowlisted imported paths from their
   local source commits/worktrees. Do not use a destructive reset over a dirty
   working tree.
2. Pilot files: restore the five source-worktree files by their recorded
   SHA-256 manifest.
3. Fingerprint: restore the two files from the dedicated local commit.
4. Live vault: it remained byte-identical to the independently verified pre-V2
   ZIP. A future authorized rollback must use that backup, never this
   repository.
5. Installed skill: it was not synchronized. Dry-run, fresh install, upgrade
   and rollback passed only in an isolated laboratory copy; the global
   installation remained byte-identical to its pre-V2 ZIP.
6. Pilot evidence: retain the laboratory directory until human review is
   complete; it is evidence, not temporary cleanup residue.

Exact local paths, archive hashes, source hashes and the file-by-file import
manifest are recorded in the machine-local consolidation receipt under
`.agents/`.

## Gates before cutover

The separate cutover trail may start only when it preserves these gates:

- writer receipt independent from Finder receipt;
- Finder receipt independent from link and tag validator receipts;
- installed skill provenance and rollback receipt;
- `legacy-v1` no-shrink by identities, paths, layers, results and exit codes;
- current authority remains the decision maker during SHADOW;
- all candidate discovery is explicit and reversible;
- no test uses the live vault as fixture or destination;
- decide explicitly whether the profile-agnostic tag validator remains the
  intended contract or must gain an explicit V2 profile before live use;
- back up the global registry redirector as a separate cutover artifact;
- explicit human acceptance before any cutover.

The current verdict is `shadow-ready`. Live V2 writes, migration, fallback
removal and `live-ready` remain blocked.
