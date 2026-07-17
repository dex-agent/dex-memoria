# CLI `routes inspect` V2 fixture-only

Status: `fixture_only_experimental`
Perfil alvo: `governed-theme-v2` (`approved_not_active`)
Perfil vivo: `legacy-v1`

`routes inspect` e um leitor-validador read-only para fixtures transacionais
descartaveis e explicitamente marcadas. Ele nao aceita o vault vivo, nao ativa
o V2, nao migra memoria e nao substitui Finder, Obsidian ou validadores
instalados.

```text
dex-memoria routes inspect --fixture <fixture-root>
```

O comando nao aceita stdin nem paths livres para tema, L1, INDEX ou destino. O
marker `dex.memory.disposable-run.v1` e o manifest
`dex.memory.fixture.governed-theme-v2-transaction.v0` delimitam a unica raiz
permitida.

## Recibo

Em sucesso, stdout recebe exatamente um documento
`dex.memory.routes.inspect.v0`; stderr permanece vazio. O recibo contem:

- perfil, tema e status `VALID`;
- rotas ordenadas por camada, slug e identidade;
- paths relativos de destino e INDEX;
- metadados de identidade, lifecycle e `owner_skill` para L3;
- SHA-256 dos bytes do destino;
- contagens independentes de L1, INDEX e destinos.

O recibo nunca inclui path absoluto nem corpo humano do destino. O schema
fechado vive em
`contracts/schemas/dex.memory.routes.inspect.v0.schema.json`.

Documentos precisam ser UTF-8 valido e ter no maximo 1 MiB cada. Cada camada
aceita no maximo 1000 rotas nesta bancada; exceder o limite falha fechado sem
recibo parcial.

## Triangulacao

Uma rota e valida somente quando L1, INDEX e destino concordam um-para-um em
identidade, camada e slug. O link L1 precisa apontar diretamente para:

```text
L1 -> memorias/<slug>.md
OU
L1 -> conhecimento/<slug>/README.md
```

O inspector aceita a tag visível canônica opcional entre o link e a metadata
estrutural. Novos writes V2 usam `#<tema>`; a forma sem tag permanece legível
para compatibilidade com fixtures e provas anteriores. Quando presente, a tag
precisa estar em lowercase kebab-case, com segmentos aninhados opcionais.

L3 exige `owner_skill` e nao cria L2 artificial. Orfaos, divergencias,
duplicatas, colisao case-insensitive, backlink incorreto ou destino ausente
retornam exit code `4`, code `ROUTE_INVALID`, sem recibo parcial.

Uso invalido ou perfil diferente retorna exit code `2`. Violacao da fronteira
da fixture continua usando o bloqueio de seguranca existente. Falha inesperada
de I/O retorna exit code `6` com erro sanitizado.

## Shadow e no-shrink

- `shadow`: o teste compara o recibo com um golden independente escrito a
  partir do contrato, sem importar planner ou writer.
- `no-shrink`: antes e depois de um `create`, o conjunto normalizado anterior
  precisa permanecer identico por identidade; exatamente a nova rota pode ser
  adicionada.

Essas provas cobrem somente as fixtures exercitadas. Elas nao provam Finder
instalado, consumers externos, vault real, migracao ou cutover.
