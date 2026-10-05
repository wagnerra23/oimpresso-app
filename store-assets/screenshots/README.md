# Screenshots de loja — 3º lote: escopo D16 (2026-10-05)

- **Origem:** `main` em `b5d17b0` (#62, histórico de OS do veículo); `npm run build:demo`, capturado no
  Chromium (Playwright) sobre o `www/` do build, tema claro, GPS simulado e dados **fictícios** do modo
  demonstração (`src/demo.ts`: "Gráfica Demonstração", clientes inventados). Nenhum dado de cliente real e
  nenhuma chamada a servidor. Perfil ERP (todas as áreas).
- **Por que mudou:** o 2º lote mostrava as 7 áreas da v1 (D13). A D16 ([W] 2026-10-02) troca o escopo para
  todas as telas do protótipo antes do envio. O lote passou a mostrar uma tela principal de cada área que
  já está no `main`.
- **Ordem na loja** (8 = máximo da Play; a App Store aceita até 10 e usa as mesmas 8):
  01-inicio · 02-pedidos · 03-producao · 04-tarefas · 05-produtos · 06-financeiro · 07-ordens-de-servico ·
  08-bater-ponto. O Login saiu porque não mostra função do app.
- **Escondido só na captura:** a faixa "Modo demonstração" (o build de loja não mostra).
- **Travas do script:** falha se o texto visível tiver "REP-P", "REP", "Portaria", "671", "Modo demonstração"
  ou "dados simulados" (ressalva legal, ERP #8417; D9), se a tela mostrar erro, ou se o item de Mais não
  existir exatamente uma vez.
- **Tamanhos:** `android-1080x1920/` (telefone Play, 9:16) e `iphone69-1320x2868/` (iPhone 6.9"), PNG RGB sem
  alfa (tipo de cor 2, conferido nas 16).
- **Refazer:** `npm run build:demo` e depois `node store-assets/screenshots/capturar.mjs www store-assets/screenshots --sem-faixa`
  (usa o Playwright do repo oimpresso.com em `D:/oimpresso.com`; ajuste o `createRequire` se rodar de outro lugar).
- **Antes do envio:** refazer quando entrarem as telas que faltam da D16 e quando PR #51 (tela 20) e #39
  (tela 11) mergearem, se mudarem estas telas.
- **Atenção à revisão:** o revisor colaborador (`revisor.ponto`) vê só Ponto · Mais (D6). As fotos mostram o
  app de quem tem o ERP; as notas de revisão explicam a diferença.
