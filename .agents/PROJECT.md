# Project - dex-memoria

## Identidade

`dex-memoria` e o pacote documental publico que define o contrato de ciclo de
vida de memoria operacional para projetos Dex Agent.

Ele distribui:

- contrato de memoria e recuperacao L1/L2/L3;
- templates;
- exemplos sanitizados;
- documentacao de fronteira;
- CLI leve para doctor/install documental;
- validacao da estrutura publica.

## Fora Do Escopo

Este projeto nao e o runtime do Dex Agent.

Nao manter aqui:

- escrita automatica de memoria;
- hooks de runtime;
- comandos `/inbox` ou `/memory`;
- ledger real;
- inbox real;
- tokens, chats, cookies, Authorization headers ou `.env`;
- producao Telegram ou configuracao operacional privada.

## Memoria E Caminhos

`DEX_MEMORIA_HOME` resolvido nesta maquina (forma portável; o caminho físico
é a variável abaixo expandida no perfil do usuário):

```text
$env:USERPROFILE\.agents\memories
```

Uso de escopo:

- global: `<DEX_MEMORIA_HOME>\global`;
- tema: `<DEX_MEMORIA_HOME>\temas\<tema>`;
- projeto: `<WORKSPACE>\.agents`.

Nao criar `global/` ou `temas/` dentro deste workspace para memoria
cross-project.

## Fontes Que Vencem

Para contrato publico, vencem `SPEC.md`, `SKILL.md`, `README.md` e `docs/`.

Para retomada local, vencem nesta ordem:

1. `.agents/HANDOFF.md`
2. `.agents/ACTIVE.md`
3. `.agents/PLAN-TASKS/ACTIVE.md`
4. `.agents/MEMORY.ndjson`, se existir
5. historico ou arquivo resolvido

## Validacao Padrao

```powershell
npm run check
npm run doctor
npm run pack:check
```

Node.js 18 ou superior.

