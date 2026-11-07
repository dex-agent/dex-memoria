# SCHEMA — Porta de entrada

- Schema específico: [dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md](dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md).
- Schema base do pacote: `dex.workflow.v1`, cuja fonte viva pertence à skill `dex-criar-workflow-contexto-atual`; não copiar a fonte para este pacote.
- Schemas adicionais: cada um usa nome do schema com extensao .schm.md; aplicar padrao-schema-casa-v3 da skill check-schemas. Schema transversal mora na skill owner; projecao necessaria ao cold-start fica em references, nunca como segunda fonte em SCHEMA.
- Contato: consumir dex.contact-resume.v1 da skill dex-criar-workflow-contexto-atual; regras operacionais no references/CONTACT-RESUME.md do pacote.

## Contrato

- Perfil consumivel: ../profiles/cc.json; schema owner dex.complexidade.profile.v1 em dex-complexidade-ciclomatica/references/schema-v2.json, validacao real scripts/v2_report.py::load_profile. Nao duplicar schema. Politica interpretativa separada em ../references/POLICY.md; exemplo5 nao define norma global.

- Entradas: ver schema específico [dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md](dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md#contrato).
- Saídas: ver schema específico [dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md](dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md#contrato).
- Critérios de pronto: ver schema específico [dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md](dex.workflow.manutencao-iterativa-com-evidencia.v1.schm.md#contrato).


method_contract: dex.workflow.v1 rev 1.4

## Metodos concorrentes

- action_family: familia da acao/resultado
- method_id: identificador e versao do metodo
- scope: limites de aplicabilidade
- responsibilities: owners e responsabilidades
- differential_hypothesis: ganho/risco que diferencia o metodo
- inputs: entradas
- outputs: saidas
- applicability: condicoes de uso
- comparator: candidato comparador, ou nenhum identificado no escopo pesquisado
- comparability: criterios que tornam observacoes comparaveis
- reuse_potential: potencial ainda nao observado
- reuse_observed: uso/evidencia observados
- initial_investment: custo inicial separado
- recurring_maintenance: custo recorrente separado
- selection_state: candidate | not_elected | standard | reverted
- criteria: criterios previamente declarados
- owner_decision: decisao explicita do owner
- decision_evidence: localizadores verificaveis
- reversal: plano para retirar ou reverter o padrao

Eleicao de `standard` exige evidencias reais em pelo menos duas oportunidades comparaveis ao longo do tempo. Revisao humana confirma significado e veracidade.

## Registro de meta-análise questionadora

- Entrada: snapshot do resultado/SPT, evidências, premissas e dependências.
- Saída: registro no Trilho/relatório com revisão/hash, perguntas/respostas,
  oráculo/motivo, corpus reaberto (obra/edição/seção/linha/identidade), parecer,
  decisão/justificativa, impactos atuais e futuros, ação, responsável, quando e prova.
- Gate: executar antes de fechar e entre SPTs, inclusive o último; corrigir e
  retestar impactos. Seleção de oráculo ou checker verde não prova consulta.
  Lacuna mantém revisão pendente com recuperação; trabalho independente
  autorizado continua. Núcleo operacional no WORKFLOW, campos não são selo.
