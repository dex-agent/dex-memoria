---
name: dex-memoria
description: Use para gravar, recuperar, revisar, mover, arquivar ou superseder memória Dex. A escrita cotidiana usa Dex Memoria V2; o corpus V1 permanece legível e restaurável.
---

# Dex Memoria V2

`Implementation-Version: v2`

`Scope: project | global | theme | dual`

Implementation, scope e root são dimensões independentes.
Selecionar um root não define nem congela o layout interno.
Writer/selector ativo: v2.
`legacy-v1`: reader/restore; o V1 histórico continua recuperável.

Esta é a fonte canônica única da skill:

```text
C:\CodexProjetos\dex-memoria\SKILL.md
```

O arquivo global em `$env:USERPROFILE\.agents\skills\dex-memoria\SKILL.md`
é apenas um redirecionador. Não procure nem escolha cópias locais, `.dex-agent`,
backups ou worktrees como fonte operacional.

## Entrada cotidiana

Quando o usuário disser `Use $dex-memoria para gravar...`, use V2 por padrão.
Não é necessário ele informar `V2`. V1 é somente recall e restauração.

Para gravar, execute uma única operação:

```text
dex-memoria v2 remember
```

A escrita é explícita pela CLI. Esta skill não instala hook automático nem
captura em background.

Quando `garimpeiro` qualificar, durante o bloco atual, um achado como forte,
memorável, não sensível, não duplicado e com escopo e destino canônicos claros,
isso já autoriza a operação explícita `v2 remember`: não peça uma segunda
permissão ao usuário. Grave durante o bloco e deixe o aviso para o fechamento.
Se escopo, destino ou segurança permanecerem ambíguos, não invente a rota nem
grave; mantenha o item no `estacionamento` com owner e `quando` recuperáveis.
Depois de cada gravação automática, use `consciencia-memorias` para validar a
conexão bidirecional efetivamente escolhida, `L1↔L2` ou `L1↔L3`.

```powershell
@'
{
  "scope": "project",
  "title": "Título curto",
  "trigger": "Quando esta memória deve ser recuperada",
  "body": "Conteúdo estável e operacional",
  "tags": ["#dominio/assunto"]
}
'@ | node "C:\CodexProjetos\dex-memoria\bin\dex-memoria.js" v2 remember
```

O payload cotidiano é fechado:

- `scope`: obrigatório; `project`, `global`, `theme` ou `dual`;
- `title` (até 256) e `trigger` (até 512): obrigatórios e sem quebra de linha/NUL;
- `body`: obrigatório, até 65536 caracteres; `tags`: lista não vazia;
- `target_layer`: opcional; default seguro `L2`;
- `theme`: obrigatório somente quando `scope=theme`;
- `owner_skill`: obrigatório somente quando `target_layer=L3`;
- `slug` e `operation_id`: opcionais; o helper gera valores determinísticos.

Não invente o escopo. Se o pedido não distingue projeto, global, tema ou ambos,
pergunte somente essa decisão humana. O classificador de intenção pertence ao
consumidor; esta skill governa e executa a memória já roteada.

Roots são portáveis:

- projeto: diretório de trabalho atual + `.agents`;
- global: `DEX_MEMORIA_HOME\global`;
- tema: `DEX_MEMORIA_HOME\temas\<tema>`;
- `DEX_MEMORIA_HOME`: variável de ambiente ou fallback
  `$env:USERPROFILE\.agents\memories`.

```text
project/local -> <WORKSPACE>/.agents
global -> <DEX_MEMORIA_HOME>/global
theme -> <DEX_MEMORIA_HOME>/temas/<tema>
dual-scope -> dois destinos e dois recibos
```

Para `dual`, são duas operações físicas independentes: projeto e global. Exija
dois route receipts e duas validações; nunca aceite um único recibo compartilhado.

## Como comprovar a gravação

Aceite sucesso somente quando o JSON retornar:

- `contract=dex.memory.remember.receipt.v2`;
- `implementation_version=v2`;
- `status=COMMITTED`;
- uma rota por destino solicitado;
- cada `route_receipts.<scope>.status=COMMITTED`;
- cada `validations.<scope>.ok=true`;
- `request_fingerprint` SHA-256;
- `candidate_id` e `content_hash` SHA-256 quando ao menos uma rota comprometeu;
- em `FAILED` sem commit, `candidate_id=null` e `content_hash=null`;
- arquivos e validation receipts distintos em `dual`.

O receipt público não deve ecoar `body`, `title`, `trigger` ou payload privado.
Ele prova o vínculo por hashes, rotas e recibos independentes. Depois abra os
arquivos gravados e faça recall por gatilho, tag e frase. Auto-relato do writer
não é o único oracle.

Retry do mesmo pedido comprometido deve manter `operation_id` e retornar
`deduplicated=true`, sem duplicar L1 ou destino. Sempre que `recovery` não for
`null` — inclusive em `FAILED` — siga-o: journal não terminal exige `recover`
(com o `command_input` de cada action, JSON pronto para o stdin — não componha
à mão); journal já `ROLLED_BACK` ou `IDEMPOTENCY_CONFLICT` exige repetir
`remember` com o `next_operation_id` fornecido.
Execute todas as entradas de `recovery.actions`, uma por rota pendente, antes
do `then_command`. Não reutilize silenciosamente uma transação terminal.
Cada action carrega `cure` com a classificação da fonte única
(`MANUAL`/`RECOVER`/`RETRY_NEW`/`RETRY_SAME`); `cure: "UNCLASSIFIED"` denota
código de falha fora da tabela — trate como manual e reporte a lacuna ao
mantenedor.

## Camadas

- L1 `lembranca.md`: gatilho curto e recuperável;
- L2 `memorias/<slug>.md`: regra operacional estável;
- L3 `conhecimento/<slug>/README.md`: conhecimento profundo sob demanda.

V2 grava `L1↔L2` ou `L1↔L3`; não cria L2 artificial para uma memória L3.
L3 exige `owner_skill`. Não grave L2 sem L1 nem L3 sem L1.

## Escolha do escopo

- `project`: aprendizado específico do repositório atual;
- `global`: regra reutilizável entre projetos;
- `theme`: conhecimento pertencente a um tema governado;
- `dual`: o mesmo aprendizado tem valor independente local e global.

Dual não é atalho para “talvez global”. Cada destino precisa justificar valor e
produzir recibo próprio. Conteúdo fraco, sensível, duplicado, ambíguo, stale ou
sem gatilho recuperável não deve ser promovido.

## Recall V1 e V2

Ao ouvir `recarregue as memórias locais e globais`, recupere V1 histórico e V2
novo sem pedir versão. Use Finder por pelo menos duas formas — gatilho/tag,
frase, filename, anchor ou block id — e confirme abrindo a fonte viva ou com
`rg`. Graphify acelera relações, mas não substitui a fonte.

Escala de recall:

1. Abra o L1/L2/L3 conhecido quando o gatilho for claro.
2. Use `obsidian-memory-finder`/`find-memory.ps1` por duas formas.
3. Use `rg` se Finder não localizar.
4. Para relações, use Graphify e confirme a fonte citada.

Memória sem recuperação é arquivo morto.

## Qualidade e ciclo de vida

Antes de gravar:

- confirme valor futuro, segurança, novidade e destino;
- mantenha L1 curto e L2/L3 como fonte viva;
- qualquer promessa futura precisa de owner e `quando`;
- use `garimpeiro` antes de descartar ouro;
- use `estacionamento` somente para resíduo vivo com condição de retomada;
- use `consciencia-memorias` para revisão pós-escrita quando aplicável.

Para conhecimento reutilizável profundo, L3 precisa de objetivo, escopo,
exemplos, anti-exemplos, modelo operacional, validação, fontes, riscos de
obsolescência e comando de achabilidade.

Ao final do bloco, informe brevemente somente a quantidade de achados fortes
memoráveis gravados, a quantidade de tropeços novos catalogados e os gatilhos
L1 quentes realmente usados; então pergunte se o usuário deseja editar alguma
memória. Arquivos, rotas e receipts permanecem disponíveis como evidência e
devem ser apresentados quando necessários para diagnosticar falha ou quando o
usuário os pedir.

## Manutenção e troubleshooting

O uso cotidiano termina aqui. Não abra documentação de desenvolvimento para
uma gravação normal.

Somente quando estiver mantendo o produto, investigando falha, alterando
contrato ou executando recovery manual, consulte sob demanda:

- `SPEC.md`: contrato de ciclo de vida;
- `docs/usage.md`: exemplos e referência CLI, incluindo a seção
  `Contrato De Tags Do V2` (regras de tags/validação com exemplo e
  anti-exemplo, códigos `MISSING_NESTED_TAG`/`DIVERGENT_TAG_SET`/`ORPHAN_L1_LINE`
  e o `failure.detail.validation_errors` do receipt `FAILED`) e a seção
  `Semântica de Root do validate-root` (root self-contained vs vault composto,
  campo opcional `vault_root` com `cross_vault_links`, `EMPTY_ROOT` anti
  verde-vazio e a tabela de skips declarados do validador — issue #5);
- `docs/runtime-boundary.md`: fronteira do pacote;
- `docs/memory-home.md`: resolução de roots;
- `contracts/schemas/`: schemas públicos;
- `bin/dex-memoria.js help`: primitivas avançadas.

Primitivas avançadas preservadas:

```text
dex-memoria v2 plan
dex-memoria v2 apply
dex-memoria v2 resume
dex-memoria v2 recover
dex-memoria v2 validate
dex-memoria v2 validate-root
dex-memoria v2 capability
```

As bancadas V0 e o identificador histórico `governed-theme-v2` existem apenas
para fixtures e arqueologia. Não são o produto, o perfil ativo nem fallback.

Se a fonte canônica estiver ausente ou ilegível, bloqueie explicitamente. Não
improvise outra versão da skill.
