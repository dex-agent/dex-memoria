# Resource-limit SHADOW probe — fixture-only V1

This diagnostic surface compares the current Node consumer literals with the
inert `dex.memory.resource-limits.v1` bundle. It does not activate the bundle,
change the active memory profile, write memory, or make a candidate value
authoritative.

## DEFAULT

Without both candidate arguments, the probe starts only the current operation.
It does not discover a bundle through environment variables, configuration
files, default paths, or installed state.

```text
node scripts/run-memory-resource-limits-shadow-fixture.js --consumer dex-memoria.cli --fixture <fixture-root>
```

The request JSON for `dex-memoria.cli` is read from stdin. The operation's
stdout, stderr, exit code, and fixture effects are passed through unchanged.

## Explicit SHADOW comparison

Pass both paths to opt in. The receipt must be a direct JSON child of the
marked fixture's `receipts` directory.

```text
node scripts/run-memory-resource-limits-shadow-fixture.js --consumer dex-memoria.cli --fixture <fixture-root> --bundle <contracts/policies> --receipt <fixture/receipts/cli.json>
node scripts/run-memory-resource-limits-shadow-fixture.js --consumer dex-memoria.route-inspector --fixture <fixture-root> --bundle <contracts/policies> --receipt <fixture/receipts/routes.json>
```

The Windows tag-validator seam has a dedicated fixture-only runner. It accepts
the installed validator path explicitly; it does not discover or edit installed
state:

```text
node scripts/run-memory-tag-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-tags.ps1>
node scripts/run-memory-tag-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-tags.ps1> --bundle <contracts/policies> --receipt <fixture/receipts/tags.json>
```

Its candidate is `v2.tags.max_files`. The current PowerShell parameter default
remains authoritative. A marked fixture with 100 files succeeds; a marked
fixture with 101 files keeps the current `too-many-files` failure even when a
SHADOW candidate proposes 101. The receipt records the mismatch out of band.

The Windows link-validator seam also has a dedicated fixture-only runner. Its
owner is `validate-memory-links`; the input is a marked governed-theme-v2
create fixture inside the governed laboratory, and its output is the unchanged
validator result plus an optional comparison receipt:

```text
node scripts/run-memory-link-line-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-links.ps1>
node scripts/run-memory-link-line-limit-shadow-fixture.js --fixture <fixture-root> --validator <validate-memory-links.ps1> --bundle <contracts/policies> --receipt <fixture/receipts/links.json>
```

Its candidate is `v2.document.max_lines`. The current `MaxLines` PowerShell
parameter remains authoritative. Synthetic UTF-8/LF Markdown with exactly
5000 lines remains inside the current boundary; 5001 lines preserves the
current safety-stop. A SHADOW candidate of 5001 records `mismatch` only after
that operation finishes; it is never passed to the validator as `MaxLines`.
The fixture is disposable and fictional and must not contain secrets or live
vault content. The principal residual risk is that this probe proves the line
guard, not the complete semantics of memory links.

The parent starts the current `operation_child` first. Only after that process
finishes does it start `comparison_child`. The second process writes a separate,
sanitized receipt with `match`, `mismatch`, `candidate_invalid`, or
`comparison_not_run`. None of those statuses changes the operational result.

Compared IDs:

- `dex-memoria.cli`: `cli.stdin.max_bytes`;
- `dex-memoria.route-inspector`: `v2.routes.document.max_bytes` and
  `v2.routes.max_entries`;
- `validate-memory-tags`: `v2.tags.max_files`;
- `validate-memory-links`: `v2.document.max_lines`.

## Help and recovery

```text
node scripts/run-memory-resource-limits-shadow-fixture.js --help
node scripts/run-memory-tag-limit-shadow-fixture.js --help
node scripts/run-memory-link-line-limit-shadow-fixture.js --help
node scripts/compare-memory-resource-limits-shadow.js --help
```

If candidate comparison fails, remove `--bundle` and `--receipt` and repeat the
current operation. That returns to DEFAULT. Do not copy this fixture-only probe
into a live vault or treat its receipt as cutover approval.
