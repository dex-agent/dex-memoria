# Memory Home

> Este mapeamento e independente da versao da implementacao. O writer/selector
> ativo e V2; `legacy-v1` permanece somente para leitura e restauracao. Consulte
> [Memory Architecture Profiles](memory-architecture-profiles.md).

```text
Product: Dex Memoria V2
Implementation-Version: v2
Scope: project | global | theme
Active-Write-Profile: v2
project/local -> <WORKSPACE>/.agents
global -> <DEX_MEMORIA_HOME>/global
theme -> <DEX_MEMORIA_HOME>/temas/<tema>
dual-scope -> dois destinos e dois recibos
```

As dimensoes implementation, scope e root sao independentes. Selecionar um root
nao define nem congela o layout interno. O V1 historico continua read-only,
restauravel e recuperavel junto do V2 novo. `governed-theme-v2` e identificador
historico de fixture; nao e produto, umbrella ou perfil ativo.

`DEX_MEMORIA_HOME` e a raiz canonica de memoria cross-project do
`dex-memoria`.

Ela existe para impedir que um projeto crie acidentalmente pastas `global/` ou
`temas/` dentro do proprio workspace quando a memoria deveria ser reutilizavel
entre projetos.

## Resolucao

1. Se `$env:DEX_MEMORIA_HOME` existir, use esse caminho.
2. Se nao existir, use `$HOME/.agents/memories`.

No Windows, escreva o fallback como variavel de perfil, nao como caminho fixo:

```text
$env:USERPROFILE\.agents\memories
```

## Mapeamento

```text
<DEX_MEMORIA_HOME>/
  global/
    lembranca.md
    memoria.md
    conhecimento/
  temas/
    <tema>/
      lembranca.md
      memoria.md
      conhecimento/

<WORKSPACE>/
  .agents/
    lembranca.md
    memoria.md
    conhecimento/
```

## Regras

- `global` fica em `<DEX_MEMORIA_HOME>/global`.
- `tema` fica em `<DEX_MEMORIA_HOME>/temas/<tema>`.
- `projeto` fica em `<WORKSPACE>/.agents`.
- Se ja existir exatamente um `lembranca.md` por comparacao case-insensitive,
  preserve seu casing byte a byte. Em root novo, projeto usa `lembranca.md` e
  global/tema usam `LEMBRANCA.md`; duas variantes equivalentes bloqueiam.
- `DEX_AGENT_HOME` nao e raiz de memoria cross-project por padrao.
- `$HOME/.codex/memories` pertence ao host Codex e nao e destino padrao do
  `dex-memoria`.

## Taxonomia De Temas

Tema e dominio reutilizavel. Nao use tema como apelido de projeto, conversa,
sprint, bug isolado ou combinacao projeto-ferramenta.

Exemplos preferidos:

- `temas/deepseek`
- `temas/delphi`
- `temas/php`
- `temas/codex`

Use `temas/<area>/<tema>` apenas quando `<area>` ja for uma familia real e
repetida. Se uma captura mistura projeto e ferramenta, guarde o estado do
projeto em `<WORKSPACE>/.agents` e o aprendizado reutilizavel em
`<DEX_MEMORIA_HOME>/temas/<dominio>`.

Se um ambiente quiser usar outro local, deve configurar `DEX_MEMORIA_HOME`
explicitamente.

## Bloqueios

Antes de escrever memoria:

- se `escopo=global` e o destino esta dentro do workspace, pare;
- se `escopo=tema` e o destino esta dentro do workspace, pare;
- se `escopo=projeto` e o destino nao esta em `<WORKSPACE>/.agents`, peça
  confirmacao;
- se o destino contem `templates/`, `examples/`, logs, screenshots ou secrets,
  pare.
