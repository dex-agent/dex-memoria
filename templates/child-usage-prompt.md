# Prompt Curto Para Filho Usar Dex Memoria

Use este prompt em um projeto filho quando uma captura precisar ser classificada antes de virar memoria, artefato, handoff ou descarte.

```text
Use dex-memoria para classificar esta captura antes de salvar, lembrar ou encaminhar.

Captura:
<cole aqui>

Responda com:
- veredito: memoria viva | ledger-only | estacionamento | descarte | skill-candidate;
- nivel: simples | operacional | robusta;
- fonte de verdade;
- forca da evidencia: fraca | boa | forte | bloqueante;
- tagname especifica proposta;
- localizador L1 proposto;
- anchor/block id L2 proposto;
- quando lembrar;
- quando nao lembrar;
- anti-gatilho, se houver risco real de confusao;
- anti-exemplo, se ele evitar erro real;
- proximo destino: local | pai | rede | nenhum.

Regras:
- HANDOFF.md manda no proximo passo seguro;
- ACTIVE.md manda no objetivo vivo e loops abertos;
- MEMORY.ndjson e ledger, nao fila viva;
- memoria resolvida nao orienta proximo passo;
- Graphify e mapa, nao prova; `source: graphify` exige fonte aberta antes de promover memoria;
- L1 aponta L2 por Markdown e Obsidian com block id, e cada gatilho L1 tem tagname especifica visivel;
- L2 declara Localizador, Tags, Aliases, Obsidian: L1 e block id;
- L2 aponta L3 quando existir; L3 volta para L2 por Markdown e Obsidian com `#^block-id`;
- bug do pai usa rota pai;
- handoff entre filhos usa rota rede.
```
