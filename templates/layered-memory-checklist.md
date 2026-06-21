# Checklist - Memoria Em Camadas

Use este checklist antes de promover uma captura para L1/L2/L3.

## Escala Graduada

- [ ] Nivel escolhido: simples, operacional ou robusta.
- [ ] A memoria simples nao virou L3 robusto sem necessidade.
- [ ] Anti-gatilho foi exigido apenas quando havia confusao real.
- [ ] Anti-exemplo foi exigido apenas quando evita erro real.
- [ ] A forca da evidencia foi classificada como `fraca`, `boa`, `forte` ou `bloqueante`.

## L1 - Lembranca

- [ ] `lembranca.md` nao tem teto artificial de linhas; cada gatilho e curto, especifico, linkado e recuperavel.
- [ ] Cada linha tem gatilho curto.
- [ ] Cada gatilho tem tagname especifica visivel e nao generica.
- [ ] Cada gatilho aponta para `memoria.md#ancora` por Markdown ou fonte viva equivalente.
- [ ] Cada gatilho aponta para L2 por Obsidian com block id quando o vault usa Obsidian: `[[memoria#^ancora|memoria]] ^ancora`.
- [ ] Quando houver risco de confusao, L1 inclui anti-gatilho ou rota alternativa.
- [ ] L1 nao contem tutorial, historico longo ou dump de contexto.
- [ ] O escopo esta correto: global, tema ou projeto.
- [ ] `DEX_MEMORIA_HOME` foi resolvido quando o escopo e global ou tema.
- [ ] `global` aponta para `<DEX_MEMORIA_HOME>/global`, nao para `<WORKSPACE>/global`.
- [ ] `tema` aponta para `<DEX_MEMORIA_HOME>/temas/<tema>`, nao para `<WORKSPACE>/temas`.
- [ ] `projeto` aponta para `<WORKSPACE>/.agents`.
- [ ] Tema representa dominio reutilizavel, nao projeto, conversa ou combinacao projeto-ferramenta.
- [ ] Nome composto de tema foi revisado e justificado antes de gravar.

## L2 - Memoria

- [ ] Toda ancora apontada por L1 existe em `memoria.md`.
- [ ] Cada secao L2 tem heading com `{#ancora}` e linha de block id `^ancora`.
- [ ] Cada secao L2 declara `Localizador`, `Tags`, `Aliases` e `Obsidian: L1`.
- [ ] Nenhuma secao L2 foi criada sem gatilho L1 ou fonte viva equivalente.
- [ ] Cada secao tem problema, mecanismo, verificacao e prevencao quando aplicavel.
- [ ] Cada secao declara quando lembrar e quando nao lembrar.
- [ ] Secoes operacionais declaram aliases e anti-aliases quando houver ambiguidade.
- [ ] Secoes de risco declaram gatilhos fortes, anti-gatilhos e rotas alternativas.
- [ ] L2 aponta para L3 quando o detalhe ultrapassa uso recorrente.

## L3 - Conhecimento

- [ ] `conhecimento/INDEX.md` existe.
- [ ] L3 foi linkada por uma ancora L2.
- [ ] L3 aparece em `conhecimento/INDEX.md` com retorno para L2.
- [ ] O indice L3 e o arquivo L3 usam templates separados quando houver arquivo robusto.
- [ ] L3 declara objetivo, escopo, exemplos, anti-exemplos e modelo operacional.
- [ ] L3 declara comandos ou scripts de validacao quando aplicavel.
- [ ] L3 separa fontes `confirmado`, `inferido` e `lacuna`.
- [ ] L3 registra referencias e riscos de obsolescencia.
- [ ] L3 aponta de volta para a L2 relacionada por Markdown.
- [ ] L3 aponta de volta para L2 por Obsidian com `#^block-id`, nao apenas `#ancora`.
- [ ] Existe `rg de achabilidade` cobrindo gatilho, alias humano e termo tecnico.
- [ ] Graphify foi usado como mapa, nao prova; hits permanecem como `source: graphify` ate confirmacao direta.
- [ ] Se Graphify participou, query, graph, hits confirmados e hits nao promovidos foram registrados.
- [ ] Subpastas longas tem `INDEX.md` proprio quando existirem.
- [ ] L3 nao e tratada como contexto sempre carregado por padrao.

## Seguranca

- [ ] Nao ha `api_key`, token, segredo, senha, `.env`, log, screenshot ou estado real.
- [ ] Exemplos usam paths ficticios ou relativos.
- [ ] Configs mostradas sao abstratas e nao copiadas de ambiente privado.

## Veredito

- [ ] Promover para L1/L2/L3.
- [ ] Manter como memoria operacional comum.
- [ ] Registrar apenas em ledger.
- [ ] Descartar.
