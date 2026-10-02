# Screenshots de loja — 1º lote (aprovado pela gestão do app em 2026-10-01)

- **Origem:** branch `fix/textos-loja` (fc43486, contém os PRs #6 e #7), `npm run build:demo`, capturado no
  Chromium (Playwright) sobre o `www/` do build, com GPS simulado e dados fictícios do modo demonstração.
- **Escondido só na captura:** a faixa "Modo demonstração" e a caixa de demonstração do Login (o build de loja não
  mostra nenhuma das duas). A tela Conta ficou de fora (rodapé do build de demonstração).
- **Tamanhos:** `android-1080x1920/` (telefone Play, 9:16) e `iphone69-1320x2868/` (iPhone 6.9"), PNG RGB sem alfa.
- **Ordem na loja:** 00-login · 01-inicio · 02-bater-ponto · 03-meu-espelho · 04-justificar.
- **Refazer:** `node store-assets/screenshots/capturar.mjs <www> <saída> --sem-faixa` (usa o Playwright do repo
  oimpresso.com; ajuste o caminho do `createRequire` se rodar de outro lugar). Ele gera também `05-conta`, que não vai à loja.
- Sem "REP-P", "Portaria" nem "671" nas telas (ressalva legal, ERP #8417).
