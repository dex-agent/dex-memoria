# Limites de recursos de memória — SHADOW

Localizador: `DEX-MEMORY-RESOURCE-LIMITS`

Este diretório é a superfície central, fácil de localizar e publicável do candidato `dex.memory.resource-limits.v1`. O owner do candidato é `dex-memoria`.

## Configurações

Dentro do candidato SHADOW, os valores observados ficam exclusivamente no arquivo de policy. As fontes atuais citadas por `source_evidence` continuam efetivas até um cutover explícito; este bundle ainda não as substitui. O schema descreve a forma, mas não copia valores operacionais. Os bootstraps em `generated/` são derivados determinísticos e carregam apenas identidade, tamanhos e hashes do contrato.

## Regras

- Estado de autoridade: `SHADOW`.
- Ativação: `effective=false`.
- Nenhum consumidor operacional/runtime lê esta policy neste corte; apenas superfícies SHADOW de geração, leitura e validação a consultam. As fontes atuais continuam sendo a autoridade vigente.
- Evidência de repositório deve declarar commit; evidência instalada usa caminho portátil iniciado por `$DEX_MEMORY_HOME`.
- Um limite operacional que referencia um teto deve ser menor ou igual a ele.
- Falta, alteração, versão divergente, BOM ou CRLF produzem falha fechada nos leitores de verificação.
- Os leitores provam consistência interna do bundle e verificam paths fixos antes de carregar um bootstrap. Autenticidade contra adulteração coordenada depende da integridade externa do pacote; este contrato não é uma assinatura digital.

## Limites

Consulte `dex.memory.resource-limits.v1.json`. Não replique os números desta policy em documentação, schema, bootstrap ou leitor.

## Contratos

- Policy autoral: `dex.memory.resource-limits.v1.json`.
- Forma: `dex.memory.resource-limits.v1.schema.json`.
- Derivados: `generated/`.
- Verificação independente: `scripts/read-memory-resource-limits-shadow.js` e `scripts/read-memory-resource-limits-shadow.ps1`.
- Geração e validação semântica: `scripts/generate-memory-resource-limit-artifacts.js`.

Abandonar este candidato significa remover o bundle ainda inativo e restaurá-lo por Git, nunca migrar ou editar o vault vivo.
