---
name: dex-memoria-v2-pilot
description: Executa uma prova manual preservada do governed-theme-v2 em fixtures descartáveis, criando rotas L1 para L2 e L1 para L3, pesquisando-as pelo Finder e salvando recibos e arquivos para inspeção. Use quando o usuário pedir para testar criação, busca, recuperação ou rollback V2 sem tocar o vault vivo, instalar skill global ou alterar o default legacy-v1.
---

# Dex Memória V2 Pilot

Executar somente contra o código do repositório `dex-memoria` que contém o
runner integrado fixture-only.

## Comando

No PowerShell:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File `
  ".\skills\dex-memoria-v2-pilot\scripts\run-v2-memory-pilot.ps1" `
  -LinkValidator "<caminho-absoluto-validate-memory-links.ps1>" `
  -Finder "<caminho-absoluto-find-memory-atual.ps1>" `
  -BaselineFinder "<caminho-absoluto-find-memory-baseline.ps1>"
```

Usar `-OutputRoot <pasta-absoluta>` para escolher uma pasta filha do laboratório
governado. Sem esse parâmetro, criar uma pasta nova sob
`%USERPROFILE%\.agents\laboratorio-memories`.

Os três paths de ferramentas são obrigatórios e explícitos. A skill não procura
Finder, validator ou backup por convenção local.

## Resultado esperado

Exigir exit code zero e abrir a pasta informada em `output_root`. Conferir:

- `l2-commit\work\tema-exemplo\lembranca.md`;
- `l2-commit\work\tema-exemplo\memorias\mapa-visual-v2.md`;
- `l3-commit\work\tema-exemplo\lembranca.md`;
- `l3-commit\work\tema-exemplo\conhecimento\journal-recuperavel\README.md`;
- `receipt.json`, com criação, pesquisa, idempotência e recovery;
- `PILOT-MANIFEST.json`, com paths e fronteiras da execução.

## Limites

- Apontar `-OutputRoot` somente para uma pasta nova sob
  `%USERPROFILE%\.agents\laboratorio-memories`.
- Não instalar esta skill globalmente.
- Não tratar PASS da fixture como cutover.
- Não apagar a prova automaticamente; o objetivo é inspeção manual.
- O default operacional continua `legacy-v1`.

Se falhar, preservar a pasta e o erro. Não executar fallback contra o vault.
