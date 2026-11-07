# Preflight e exemplo relocavel

Owner: executor do consumidor; ferramenta permanece na skill owner.
Entrada: copia inteira deste pacote; Python3 compativel com as skills owners; registry instalado com dex-criar-workflow-contexto-atual e dex-complexidade-ciclomatica0.4.3 ou revisao compativel validada.
Saida: JSON bruto no stdout; guardar comando/exit/UTC/versoes/hashes em receipt local.
Tokens: <REGISTRY> e <BASE> pertencem ao dicionario dex.workflow.variaveis.v1; preencher com registry instalado e raiz desta copia do pacote. Nao herdar caminho da maquina de origem.
Dependencias: motor e schemas nao sao copiados; skills ausentes exigem instalacao pela governanca owner, sem download implicito.

## Comando sintetico completo

```powershell
$registryRoot = '<REGISTRY>'
$packageRoot = '<BASE>'
$meterEntry = Join-Path $registryRoot 'dex-complexidade-ciclomatica/scripts/medir_cc.py'
$profileValidator = Join-Path $registryRoot 'dex-complexidade-ciclomatica/scripts/v2_report.py'
$schemaEntry = Join-Path $registryRoot 'dex-complexidade-ciclomatica/references/schema-v2.json'
$workflowChecker = Join-Path $registryRoot 'dex-criar-workflow-contexto-atual/scripts/check-workflow.py'
foreach ($requiredPath in @($meterEntry, $profileValidator, $schemaEntry, $workflowChecker)) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "DEPENDENCY_MISSING: $requiredPath; owner: skill indicada no caminho; instalar pela governanca antes de medir"
  }
}
python -B $workflowChecker --workflow $packageRoot
if ($LASTEXITCODE -ne 0) { throw 'WORKFLOW_INVALID: corrigir findings do checker owner' }
python -B $meterEntry --escopo projeto --raiz (Join-Path $packageRoot 'examples') --schema-version 2 --format json --capabilities cc --profile (Join-Path $packageRoot 'profiles/cc.json')
if ($LASTEXITCODE -ne 0) { throw 'MEASUREMENT_FAILED: preservar JSON/diagnostico; nao interpretar como zero' }
```

## Contrato e limites

- Preflight: executar --help/--schema/--usage do medidor e do checker antes do primeiro uso; ler schema-v2.json. O medidor valida o perfil usando load_profile; nao criar validador concorrente.
- Perfil: [cc.json](../profiles/cc.json); politica: [POLICY.md](POLICY.md); fixture: [sample.js](../examples/sample.js). JSON valida CC-only; alterar capabilities exige outro perfil consistente.
- Sintetico: funcao classify com uma decisao, CC esperada2 quando parser/provider reconhece; exigir quantidade real, spans e diagnostics. Delphi exige provider externo documentado pelo medidor; sem provider registrar unavailable/partial, nunca zero ou suporte comprovado.
- Generico: fixture JS demonstra somente JS; nao demonstra suporte a linguagem arbitraria.
- Nesting: chamada separada --capabilities cc,js_ts_nesting para JS/TS; nao reutilizar perfil CC-only nessa chamada. Para outras linguagens consultar suporte real; nao presumir nesting universal.
- CRG: skill code-review-graph, CLI code-review-graph --help; detectar linguagem, reutilizar registry/data dir existentes. Delphi usa feeder owner; nunca inferir suporte .pas do CRG nativo.
- Exporter: code-review-graph/scripts/crg-snapshot/export_crg_snapshot.py, contrato1.2.0, SQLite schema9 quando compativel; --database vem da config local, --repo-root recebe <REPO>, --output recebe arquivo novo em <MISSAO_DIR>. Exporter nao constroi grafo e nao mede ciclos. Conferir --help/--schema/--usage.
- Contato: owner dex-criar-workflow-contexto-atual/scripts/contact-resume.mjs; consumir schema dex.contact-resume.v1 versao1, sem copiar helper. schema_id/schema_version/project_id/executor_conversation_id/request_id/response_required em cada mensagem; resposta aponta reply_to_request_id. Resposta necessaria:210s, leituras incrementais30/90/150/210s com cursores reais e todas paginas; resposta suficiente encerra, ausencia/insuficiencia/transporte separados. Informativa nao inicia polling. Silencio nao aprova.
- Regras: ler RULES do ecossistema e pacote antes de executar; fixture sintetica valida contrato, nao aceite do produto.
- Relocacao: copiar pacote inteiro para outro diretorio junto com RULES/INDEX do ecossistema; executar checker, comando acima e teste negativo com registry ausente. Preservar manifesto de hashes, versoes, stdout/stderr/exit e cobertura parcial.
