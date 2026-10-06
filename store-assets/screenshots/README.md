# Screenshots de loja — 4º lote: escopo D16 com a Venda rápida (2026-10-05)

- **Origem:** `main` em `f107dcf`, depois do #51 (Novo produto) e do #39 (Venda rápida); `npm run build:demo`, capturado no
  Chromium (Playwright) sobre o `www/` do build, tema claro, GPS simulado e dados **fictícios** do modo
  demonstração (`src/demo.ts`: "Gráfica Demonstração", clientes inventados). Nenhum dado de cliente real e
  nenhuma chamada a servidor. Perfil ERP (todas as áreas).
- **Por que mudou:** o 2º lote mostrava as 7 áreas da v1 (D13). A D16 ([W] 2026-10-02) troca o escopo para
  todas as telas do protótipo antes do envio. O lote passou a mostrar uma tela principal de cada área que
  já está no `main`.
- **Ordem na loja:** a Play aceita até 8 por telefone e o Android leva 01 a 08; a App Store aceita até 10 e o
  iPhone leva as 9: 01-inicio · 02-venda-rapida · 03-pedidos · 04-producao · 05-produtos · 06-financeiro ·
  07-ordens-de-servico · 08-bater-ponto · 09-tarefas (só iPhone). O Login saiu porque não mostra função do app.
- **Venda rápida:** o carrinho tem 2 produtos do catálogo fictício. A foto sai antes de "Cobrar", então nada é
  enviado. O 3º lote (#63) foi capturado antes do #39 e não tinha esta tela.
- **Escondido só na captura:** a faixa "Modo demonstração" (o build de loja não mostra).
- **Travas do script:** falha se o texto visível tiver "REP-P", "REP", "Portaria", "671", "Modo demonstração"
  ou "dados simulados" (ressalva legal, ERP #8417; D9), se a tela mostrar erro, ou se o item de Mais não
  existir exatamente uma vez.
- **Tamanhos:** `android-1080x1920/` (telefone Play, 9:16) e `iphone69-1320x2868/` (iPhone 6.9"), PNG RGB sem
  alfa (tipo de cor 2, conferido nas 17).
- **Refazer:** `npm run build:demo` e depois `node store-assets/screenshots/capturar.mjs www store-assets/screenshots --sem-faixa`
  (usa o Playwright do repo oimpresso.com em `D:/oimpresso.com`; ajuste o `createRequire` se rodar de outro lugar).
- **Antes do envio:** refazer quando entrarem as telas que faltam da D16, se mudarem estas telas.
- **Atenção à revisão:** o revisor colaborador (`revisor.ponto`) vê só Ponto · Mais (D6). As fotos mostram o
  app de quem tem o ERP; as notas de revisão explicam a diferença.
