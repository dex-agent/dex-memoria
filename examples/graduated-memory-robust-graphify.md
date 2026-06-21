# Example - Memoria Robusta Com Graphify

> Exemplo sanitizado baseado em erro tecnico recorrente. Nao contem payload real,
> segredo, screenshot real ou log privado.

Nivel: `3 - memoria robusta`
Escopo: `tema`
Forca da evidencia: `forte`

## L1

```md
- [PRINT-HWND-OCULTO] print por handle so vale se a janela real foi capturada; anti-gatilho: se CopyFromScreen usar regiao de tela, validar sobreposicao ou usar rota que captura a janela isolada -> [memoria.md#print-hwnd-oculto]
```

## L2

```md
## Print Hwnd Oculto {#print-hwnd-oculto}

Localizador: `PRINT-HWND-OCULTO`
Aliases: `print por handle; HWND screenshot; captura janela`
Anti-aliases/confusoes: `CopyFromScreen com retangulo; PNG existe; handle existe`

Problema:
Um PNG pode existir e ainda representar a janela errada se a captura usou a
regiao da tela em vez da janela isolada.

Mecanismo:
`CopyFromScreen + HWND` pode calcular a regiao da janela na tela, mas ainda
copiar pixels visiveis naquele retangulo. Se outra janela estiver por cima, o
PNG mostra a sobreposicao.

Gatilhos fortes:
- teste precisa provar conteudo da janela e nao apenas existencia do arquivo;
- ha sobreposicao, janela minimizada, janela parcialmente coberta ou desktop
  compartilhado;
- falso pronto anterior aceitou PNG existente como prova.

Anti-gatilhos:
- captura vem de API que renderiza o buffer da janela isolada;
- teste valida DOM, console, handle correto ou conteudo interno por canal
  proprio;
- a necessidade e apenas registrar a regiao visivel da tela.

Verificacao:
Executar teste com janela parcialmente coberta e confirmar se a imagem contem a
janela alvo ou a janela sobreposta.

Forca da evidencia:
- fraca: PNG existe ou HWND existe;
- boa: imagem foi inspecionada e metadados da janela foram confirmados;
- forte: teste repetivel com sobreposicao prova que o processo captura a janela
  correta;
- bloqueante: PNG mostra janela errada, fonte nao aberta ou teste nao reproduz
  sobreposicao real.

Prevencao:
Nao aceitar existencia de PNG como prova. Validar conteudo, rota de captura e
cenario de sobreposicao quando o objetivo for janela isolada.

Exemplos corretos:
- capturar janela coberta e comparar conteudo esperado;
- usar canal do app, DOM/console ou API de janela isolada quando disponivel.

Anti-exemplos:
- declarar sucesso apenas porque `screenshot.png` foi criado;
- tratar `HWND` valido como prova de que os pixels pertencem a janela alvo;
- usar Graphify hit como confirmacao sem abrir a fonte citada.

Quando lembrar:
- QA visual por handle;
- screenshot de app desktop;
- validacao de janela com risco de sobreposicao.

Quando nao lembrar:
- captura intencional da area visivel da tela;
- fluxo web validado por DOM/console em browser real.

Rotas alternativas:
- Se for WebView/browser, validar DOM e console junto com screenshot.
- Se for desktop nativo, preferir API que capture buffer da janela isolada.
- Se so houver `CopyFromScreen`, testar sobreposicao antes de aprovar.

Graphify:
- query: `print por handle captura janela sobreposta`
- graph: `memories graph local`
- hits confirmados: `conhecimento/print-hwnd.md#captura-janela`
- hits nao promovidos: `source: graphify` sem fonte aberta sobre captura por
  retangulo de tela.

Fonte viva:
- `conhecimento/print-hwnd.md#captura-janela`

Conhecimento sob demanda:
- `conhecimento/print-hwnd.md`
```

## L3

```md
L2 relacionada: memoria.md#print-hwnd-oculto
source: graphify -> confirmado em conhecimento/print-hwnd.md#captura-janela
```

## Decisao

Graphify acelerou a descoberta de memorias proximas, mas nao foi prova final.
A promocao so ocorreu depois de abrir a fonte citada e cruzar com o teste que
reproduz a sobreposicao.
