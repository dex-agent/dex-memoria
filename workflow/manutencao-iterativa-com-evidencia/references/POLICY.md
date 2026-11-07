# Politica interpretativa configuravel

Status: exemplo; owner consumidor aprova valores antes de adotar.
Version: 1.0.0
Entrada-medidor: ../profiles/cc.json, schema dex.complexidade.profile.v1.
Autoridade: dex-complexidade-ciclomatica/references/schema-v2.json e scripts/v2_report.py::load_profile. Este arquivo e projecao explicativa, nao segundo schema.

| Dimensao | Exemplo configuravel | Interpretacao |
| --- | --- | --- |
| CC por funcao | meta ate5; alerta6..10; revisao acima10 | Somente max_per_function=5 entra no perfil; faixas ficam aqui. |
| Nesting | meta ate2; alerta3; revisao a partir4 | Opt-in JS/TS ou Delphi quando provider suportado; nao e threshold do perfil. |
| Cobertura alterada | linhas90%; branches80% | Somente relatorio confiavel do escopo alterado; ausente = nao medido. |
| Testes | pertinentes aprovados | Skips/falhas registrados separadamente. |
| Ciclos novos | zero | Exige snapshots compativeis que reportem ciclos; exporter nao os mede. |

- Regra: exemplo nao e padrao global nem gate; personalizar id/version/max_per_function no JSON e esta politica separadamente. Capabilities do perfil devem coincidir exatamente com a CLI.
- Regra: nao acrescentar thresholds de nesting, cobertura ou reuso no JSON do medidor.
- Regra: funcionar -> comprovar comportamento -> refatorar -> retestar; CC inicial alta nao reprova automaticamente entrega.
- Regra: medir funcao e conjunto afetado, incluindo helpers; registrar modulos, dependencias, esforco observado e regressoes; nenhuma exigencia de retorno imediato.
- Regra: dois consumidores independentes provam reuso observado; chamadas repetidas do mesmo consumidor nao contam. Helper com um consumidor pode ter justificativa.
- Regra: partial/null/funcao ausente/provider indisponivel nunca significam zero; resultado sintetico nao demonstra ganho longitudinal.
- Regra: manter baseline e dois cortes uteis somente quando reais; nao fabricar alteracoes para preencher estados.
- Preservacao-local: manter valores aprovados no consumidor, mesmo diferentes deste exemplo.
