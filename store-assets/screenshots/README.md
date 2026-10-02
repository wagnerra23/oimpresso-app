# Screenshots de loja — 2º lote: as 7 áreas da v1 (2026-10-02)

- **Origem:** `main` com Tarefas (#13), contraste (#14), Pessoas (#17), Produção (#18) e Início (#19);
  `npm run build:demo`, capturado no Chromium (Playwright) sobre o `www/` do build, tema claro, com GPS
  simulado e dados fictícios do modo demonstração. Perfil ERP (todas as áreas), que é o que a ficha da loja
  descreve (D9/D13).
- **Escondido só na captura:** a faixa "Modo demonstração" e a caixa de demonstração do Login (o build de loja
  não mostra nenhuma das duas). A tela Conta é gerada (`08-conta`) mas **não** vai à loja.
- **Trava:** o script falha se o texto visível de uma tela de loja tiver "REP-P", "REP", "Portaria", "671",
  "Modo demonstração" ou "dados simulados" (ressalva legal, ERP #8417; D9). Provada em 2026-10-02 rodando com a
  faixa visível: parou em "Modo demonstração".
- **Tamanhos:** `android-1080x1920/` (telefone Play, 9:16) e `iphone69-1320x2868/` (iPhone 6.9"), PNG RGB sem
  alfa (tipo de cor 2, conferido).
- **Ordem na loja** (8 = máximo da Play): 00-login · 01-inicio · 02-tarefas · 03-pedidos · 04-producao ·
  05-pessoas · 06-bater-ponto · 07-meu-espelho. "Justificar", que estava no 1º lote, saiu para caber no limite.
- **Refazer:** `node store-assets/screenshots/capturar.mjs <www> <saída> --sem-faixa` (usa o Playwright do repo
  oimpresso.com; ajuste o caminho do `createRequire` se rodar de outro lugar).
- **Atenção à ordem de envio:** o revisor entra como colaborador (`revisor.ponto`) e vê só Ponto · Mais (D6, #20).
  As fotos mostram o app de quem tem o ERP; as notas de revisão explicam a diferença.
