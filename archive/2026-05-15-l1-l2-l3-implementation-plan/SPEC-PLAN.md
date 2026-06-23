# Spec Plan - Lembranca, Memoria e Conhecimento

Data: `2026-05-15`
Status: `implementado localmente`
Projeto: `dex-memoria`

## 1. Veredito Tecnico

`dex-memoria` esta correto como contrato de ciclo de vida, mas ainda nao entrega
sozinho a arquitetura operacional de recuperacao em tres camadas.

O objetivo desta implementacao e promover explicitamente o modelo:

```text
L1 lembranca -> L2 memoria -> L3 conhecimento
```

sem transformar este pacote em runtime do Dex Agent e sem prometer comandos,
hooks ou escrita automatica que ainda nao existam.

## 2. Tese

Memoria util nao e acumulacao de texto. Memoria util e recuperacao governada.

A ideia central passa a ser:

- `lembranca`: gatilho curto, sempre carregavel, sem conteudo longo;
- `memoria`: detalhe operacional com ancoras, criterio e regras de uso;
- `conhecimento`: documentacao, tutoriais, modelos e exemplos sob demanda.

O fluxo esperado e:

```text
captura -> classificacao -> gatilho -> ancora -> detalhe -> conhecimento sob demanda
```

## 3. Problema Atual

O contrato atual ja diz quando lembrar, quanto lembrar, por que lembrar, quando
nao lembrar, qual fonte viva vence e como resolver memoria viva.

Ainda falta materializar:

- estrutura canonica L1/L2/L3;
- templates especificos de `lembranca.md`, `memoria.md` e `conhecimento/`;
- exemplos completos de dominio usando gatilho -> ancora -> detalhe;
- validacao de links de L1 para L2;
- validacao de tamanho maximo de L1;
- orientacao de configuracao para ambientes que carregam arquivos no prompt;
- regra de seguranca para nunca incluir secrets em config, memoria ou exemplos.

## 4. Escopo Da Implementacao

### Inclui

- adicionar a arquitetura L1/L2/L3 ao contrato documental;
- criar templates de camada;
- criar exemplo sanitizado de dominio com L1, L2 e L3;
- criar checklist de validacao de camadas;
- atualizar docs de uso e fronteira;
- adicionar script simples de validacao documental, se o recorte do sprint
  exigir;
- manter compatibilidade com a versao documental do pacote.

### Nao Inclui Agora

- runtime do Dex Agent;
- comandos `/inbox` ou `/memory`;
- escrita automatica em ledger;
- hook automatico de sessao;
- leitura real de configs privadas do usuario;
- migracao automatica de memorias existentes;
- publicacao npm sem sprint proprio de release.

## 5. Conceitos Canonicos

### L1 - Lembranca

Arquivo curto de gatilhos. Pode ser carregado em toda sessao ou por dominio.

Regras:

- maximo recomendado: 30 linhas uteis;
- cada linha deve ter gatilho e destino;
- nao deve conter tutorial, historico longo ou explicacao extensa;
- deve apontar para uma ancora L2 ou fonte viva equivalente;
- deve declarar quando nao usar, quando o gatilho for arriscado.

Exemplo de linha:

```text
- `Cannot redeclare function` -> duplicacao em include/require -> [memoria.md#include-duplicacao]
```

### L2 - Memoria

Arquivo de conhecimento operacional detalhado, organizado por ancoras.

Regras:

- cada secao usada por L1 deve ter ancora estavel;
- cada secao deve registrar problema, mecanismo, verificacao e prevencao quando aplicavel;
- deve apontar para L3 quando o detalhe ultrapassar o uso recorrente;
- deve preservar criterio de saida quando for memoria operacional viva.

### L3 - Conhecimento

Pasta sob demanda para documentacao, tutoriais, modelos e referencias longas.

Regras:

- deve ter `INDEX.md`;
- nao deve ser carregada automaticamente por padrao;
- deve ser linkada a partir de L2;
- pode conter tutoriais, modelos, exemplos extensos e troubleshooting.

## 6. Relacao Com O Contrato Atual

O contrato existente continua valido:

- memoria resolvida nao orienta proximo passo;
- `HANDOFF.md` vence ledger para proximo passo seguro;
- memoria global e indice curto, nao dump;
- conteudo grande fica na fonte viva.

A arquitetura L1/L2/L3 nao substitui esses principios. Ela oferece a forma
operacional de recuperacao.

## 7. Criterios De Aceite

A implementacao esta pronta quando:

- `SPEC.md` ou documento de uso referenciar explicitamente L1/L2/L3;
- existirem templates para as tres camadas;
- houver pelo menos um exemplo sanitizado de gatilho -> ancora -> L3;
- o checklist de validacao cobrir links L1 -> L2, tamanho de L1 e presenca de `INDEX.md` em L3;
- a fronteira de runtime continuar clara;
- nenhum exemplo ou config incluir secrets, tokens, caminhos privados sensiveis ou estado real.

Status local: atendido nesta implementacao. Release ou publicacao ficam fora
deste corte.

## 8. Riscos

- inflar L1 ate virar memoria longa;
- duplicar conteudo entre L2 e L3;
- confundir pacote documental com runtime;
- criar exemplo bonito sem mecanismo de validacao;
- copiar config real com token ou segredo;
- tratar L3 como contexto sempre carregado e poluir o prompt.

## 9. Decisao De Arquitetura

Escolha para esta rodada:

- promover L1/L2/L3 como arquitetura documental canonica dentro do
  `dex-memoria`;
- validar por arquivos e exemplos sanitizados;
- manter runtime e carregamento automatico como responsabilidade do ambiente
  consumidor.

Caminho que fica fora desta rodada:

- transformar `dex-memoria` em motor de memoria ativo.

## 10. Gate PPIRTV

Esta implementacao deve seguir gates sequenciais:

```text
Pensamento -> Planejamento -> Implementacao -> Revisao -> Teste -> Veredito
```

Nenhuma fase avanca sem evidencia de saida da anterior.
