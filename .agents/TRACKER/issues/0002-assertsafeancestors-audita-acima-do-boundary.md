---
id: ISSUE-LOCAL-0002
titulo: "assertSafeAncestors audita territorio ACIMA do boundary: qualquer workspace sob junction/symlink (C:\\DeepProjetos -> Z:) bloqueia v2 remember no projeto inteiro"
status: aberto
prioridade: P1
tipo: bug
tags:
  - "#tracker/issue"
  - "#tracker/dex-memoria"
aberto_por: "sessao:zcode (sess_c5e3bbe2-6b93-4ac5-99c4-89a0e84fcc88)"
criado_em: 2026-11-11
atualizado_em: 2026-11-11
responsavel: sessao:zcode
vinculos:
  - "sess_c5e3bbe2-6b93-4ac5-99c4-89a0e84fcc88"
---

# ISSUE-LOCAL-0002 — `assertSafeAncestors` audita acima do boundary (falso `SAFETY_BOUNDARY`)

## Problema/objetivo

- **Observado**: `dex-memoria v2 remember` com `scope=project` falha com
  `SAFETY_BOUNDARY: reparse ancestor is not allowed: C:\DeepProjetos` para
  **qualquer** workspace sob `C:\DeepProjetos` (que é `SymbolicLink` →
  `Z:\DeepProjetos`, medido com `fsutil reparsepoint query`: tag `0xa000000c`).
- **Causa demonstrada (não hipótese)**: `assertSafeAncestors`
  (`bin/memory-v2-route-executor.js:680-690`) percorre os ancestrais do alvo
  **desde a raiz do drive**, não desde o boundary do vault:

  ```js
  const parsed = path.parse(absoluteTarget);
  let current = parsed.root;                     // <-- comeca em "C:\"
  for (const segment of segments) { current = path.join(current, segment); ... }
  ```

  Medição no workspace `C:\DeepProjetos\gerador-variantes-similares`, alvo
  `<ws>\.agents\memorias\x.md`, boundary `<ws>\.agents`:

  | # | ancestral | território |
  |---|---|---|
  | 1 | `C:\` | acima do boundary |
  | 2 | `C:\DeepProjetos` | **acima** — symlink → aborta aqui |
  | 3 | `C:\DeepProjetos\gerador-variantes-similares` | acima |
  | 4 | `<ws>\.agents` | boundary (responsabilidade do vault) |
  | 5 | `<ws>\.agents\memorias` | dentro |
  | 6 | `<ws>\.agents\memorias\x.md` | dentro |

  **3 de 6 ancestrais auditados são território de terceiros.** O guard morre no
  nº 2 e nunca chega a auditar os 3 que importam.

- **Prova de que a intenção correta já existe no mesmo pacote**:
  `inspectV2CapabilityRoot` (`bin/memory-v2-capabilities.js:221-224`) faz
  `realpath(resolve(rootPath))` **primeiro** e só então `lstat`:
  `v2 validate` no MESMO diretório retorna `ok=true`
  (`resolved_root = \\VBoxSvr\C_DRIVE\DeepProjetos\...\.agents`) enquanto
  `v2 remember` falha. Duas implementações da mesma intenção, uma canonicaliza
  a outra não.

## Impacto e contexto

- **Alcance**: todo projeto cujo caminho tenha qualquer junction/symlink em
  **qualquer** nível acima do `.agents` — não é específico de `C:\DeepProjetos`.
  Na máquina dona, `z:` é share `\\VBoxSvr\C_DRIVE`; `C:\DeepProjetos` é
  symlink NTFS para `Z:\DeepProjetos`. Efeito prático: **`scope=project` fica
  inutilizável** nesses workspaces (o espelho de memória de projeto para de
  funcionar silenciosamente — a janela tende a concluir "dex-memoria bloqueado"
  e desistir, que foi exatamente o que aconteceu antes desta issue).
- **O que NÃO é**: não é falta de permissão, não é `st_ino` (isso é o
  [[dex-memoria-ino-vboxsvr-tropeco|tropeço irmão]]), não é corrupção do vault.
- **Não há flag de override** no código (0.1.17) — confirmei por `rg`. O único
  contorno hoje é rodar o comando a partir do caminho real (`Z:\...`), o que
  funciona: `COMMITTED` comprovado.

## Cura proposta (a causa incendiária)

Escopar o guard ao **boundary do vault** em vez da raiz do drive:

```
auditar: <boundary> -> ... -> <alvo>        (só território do vault)
ignorar: C:\ , C:\DeepProjetos , ...        (layout da máquina, não do vault)
manter : containment LEXICAL (path.relative) contra o boundary
```

Racional: o que o guard protege é a **escrita escapar do vault** — e quem decide
isso é `path.relative(boundary, alvo)` + symlinks **dentro** do boundary. Um
symlink 3 níveis acima do vault não pode fazer a escrita escapar dele; ele só
muda o nome do caminho até chegar lá.

### Prova bidirecional exigida (executada em harness, 2026-11-11)

| cenário | guard atual | guard escopado no boundary |
|---|---|---|
| junction **acima** do workspace (`C:\DeepProjetos` → `Z:`) | ❌ BLOQUEIA (falso positivo) | ✅ passa |
| junction **dentro** do vault (`<ws>\.agents\memorias` → fora) — o TOCTOU do teste l.425 | ✅ bloqueia | ✅ **BLOQUEIA** (proteção preservada) |
| containment real (canonicalizado) | — | destino e boundary resolvem para o mesmo share → **contido** |

Ou seja: a cura remove o falso positivo **sem** abrir o buraco que o teste
`route executor revalidates destination ancestors immediately before publish`
protege. Esse teste deve continuar verde — ele testa junction **dentro** do
vault, que é o que importa.

## Testes que hoje codificam o comportamento errado (devem ser revistos, não apagados)

1. `test/create-recall-v2-integrated.test.mjs:31` —
   `assert.equal(normalizedPath(await realpath(d), normalizedPath(d), "must not cross a reparse point")`
   dentro de `assertPlainDirectory(laboratoryRoot, ...)`: **qualquer** checkout
   sob junction reprova, mesmo com tudo legítimo. Suíte só roda com
   `DEX_MEMORY_V2_INTEGRATION=1`, então o falso positivo fica escondido.
2. `scripts/run-memory-v2-create-recall-fixture.js:264` —
   `if (!samePath(real, filePath)) safety("path must not cross a reparse point")`:
   mesma classe (realpath-igualdade em vez de containment).
3. `test/create-plan-v2.test.mjs:255` ("V2 fixture blocks a theme symlink or
   reparse point") — **está correto** e deve continuar: é symlink *dentro* da
   fixture (`work/tema-exemplo`). Distinguir os dois é o ponto.

## Esperado

- `v2 remember scope=project` funciona em workspace cujo caminho contenha
  junction/symlink **acima** do vault (com containment provado).
- Junction/symlink **dentro** do vault continua bloqueando, com erro que nomeia
  o caminho ofensor.
- A mensagem de falha, quando ocorrer, diz **qual** relação foi violada
  (ancestor do vault vs layout da máquina) — hoje ela diz "reparse ancestor"
  sem distinguir território, o que induz a conclusão errada de "dex-memoria
  bloqueado".

## Evidência

- Guard: `bin/memory-v2-route-executor.js:680-690`; call sites: l.20-27, 48,
  138-152, 169-171, 196, 631-675.
- Irmão correto: `bin/memory-v2-capabilities.js:221-224` (`realpath` primeiro).
- Medições: `fsutil reparsepoint query C:\DeepProjetos` (tag `0xa000000c`);
  `v2 validate` `ok=true` vs `v2 remember` `FAILED` no mesmo diretório;
  harness `%TEMP%\reparse-harness\prova.js` + `prova-toctou.js`.
- Varredura de vizinhos (`dex-barata-scan`, `dex.barata.scan.v1`): 44
  `isSymbolicLink` em `bin/` + `scripts/` + `test/`; `realpath` presente em 51
  pontos (incluindo os 3 `bin/` citados) → a classe é sistêmica no pacote, a
  cura deve ser a função compartilhada, não um `if` local.

---

## Risco colateral medido no mesmo bloco (2026-11-11): o TRACKER local é apagado pelo sync

Este arquivo **desapareceu** ~5 min depois de ser criado (13:27 → 13:32) e foi
recuperado de `%USERPROFILE%\.agents\skills-backups\20261111-132729-pre-sync\extra-dex-memoria\.agents\TRACKER\`.
Fatos medidos:

- `~\.agents\skills\dex-memoria` hoje é um **redirector pequeno** (SKILL.md +
  CAPACITY.md), mas o backup das 13:27 mostra que ali havia uma **cópia
  completa do repo** (`.git`, `AGENTS.md`, `.agents/TRACKER/...`) — classificada
  como **"extra" no destino**.
- `dex-atualizador/runtime/tools/transfer-ecosystem/sync-ecosystem.ps1` faz
  backup do destino e depois `robocopy /MIR` origem→destino (l.538). `/MIR`
  **remove do destino o que não existe na origem** — "extra" no backup é
  exatamente o que será apagado.
- `INDEX.md` voltou ao conteúdo de **2026-11-10 14:55** (a versão anterior à
  minha edição) e meu `.bak-261111-issue2` também desapareceu.
- `.gitignore` do repo tem `.agents/` (l.12): o git **não protege** o TRACKER.

**Incerteza declarada:** não foi possível atribuir com certeza absoluta qual dos
dois agentes executou a remoção — o `sync-ecosystem.ps1` (robocopy `/MIR` de
extras) ou o `dex-atualizador` (restauração do repo a partir de pacote). Ambos
compartilham a mesma classe: **`.agents/` do dex-memoria é tratado como
descartável** por tooling de espelho/restore, e o tracker não está versionado.

**Correção mínima sugerida (decisão do dono):** versionar
`.agents/TRACKER/**` (ou pelo menos os itens abertos) com exceção no
`.gitignore`, OU adicionar `.agents` do dex-memoria ao `/XD` do robocopy.
Sem isso, todo item criado offline neste repo vive até o próximo sync.
