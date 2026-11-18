import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { gitBlobId, collectProjectionBlobDrifts } = require("../scripts/validate-public.js");

test("gitBlobId computa o git-blob sha1 (âncora bem conhecida: blob vazio)", () => {
  assert.equal(gitBlobId(Buffer.alloc(0)), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
  assert.equal(gitBlobId(Buffer.from("hello\n")), "ce013625030ba8dba906f756967f9e9ca394464a");
});

test("gitBlobId normaliza CRLF->LF igual ao clean filter do git (working tree windows)", () => {
  assert.equal(
    gitBlobId(Buffer.from("hello\r\nworld\r\n")),
    gitBlobId(Buffer.from("hello\nworld\n")),
    "blob citado pelo git hash-object usa o conteudo normalizado"
  );
});

test("collectProjectionBlobDrifts denuncia stale, aceita fresco e acusa arquivo inexistente", () => {
  const mapContents = {
    "CAPACITY.md": [
      "# mapa",
      "- `bin/fresh.js` (blob `abc1234…`) — par fresco;",
      "- `bin/stale.js` (blob `def5678…`)",
      "- `docs/gone.md` blob `9990123…`",
      ""
    ].join("\n")
  };
  const ids = {
    "bin/fresh.js": "abc1234fffffffffffffffffffffffffffffffffff",
    "bin/stale.js": "ffffffffffffffffffffffffffffffffffffffffff"
  };
  const drifts = collectProjectionBlobDrifts(mapContents, (citedPath) => ids[citedPath], (citedPath) => citedPath !== "docs/gone.md");
  assert.equal(drifts.length, 2, `esperava stale + missing (atual: ${JSON.stringify(drifts)})`);
  const stale = drifts.find((drift) => drift.kind === "stale_blob");
  assert.ok(stale, "deve acusar stale_blob");
  assert.equal(stale.path, "bin/stale.js");
  assert.equal(stale.cited, "def5678");
  assert.equal(stale.actual, "fffffff", "actual deve citar o prefixo do mesmo comprimento (7 chars aqui)");
  const missing = drifts.find((drift) => drift.kind === "missing_file");
  assert.ok(missing, "deve acusar missing_file");
  assert.equal(missing.path, "docs/gone.md");
});

test("par com quebra de linha entre path e blob (caso capabilities.js real) é coletado", () => {
  const mapContents = {
    "DECISION-FLOW.md": "- `bin/multi-line.js`\n  (blob `abc1234…`) continua na linha seguinte\n"
  };
  const drifts = collectProjectionBlobDrifts(
    mapContents,
    () => "ffffffffffffffffffffffffffffffffffffffffff",
    () => true
  );
  assert.equal(drifts.length, 1, "par multilinha deve ser validado");
  assert.equal(drifts[0].kind, "stale_blob");
});
