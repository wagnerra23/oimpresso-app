// Screenshots de loja do build de demonstração do oimpresso-app — as 7 áreas da v1 (D13).
// Uso: node capturar.mjs <www> <saida> [--sem-faixa]
// Android telefone: 360x640 @3 = 1080x1920 · iPhone 6.9": 440x956 @3 = 1320x2868.
// GPS simulado (coordenada genérica), nada vai para servidor (build de demonstração).
// Ordem na loja (8 = máximo da Play): 00 login · 01 início · 02 tarefas · 03 pedidos · 04 produção ·
// 05 pessoas · 06 bater ponto · 07 meu espelho. Gera também 08-conta, que NÃO vai à loja.
import { createRequire } from 'node:module'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const { chromium } = createRequire('D:/oimpresso.com/package.json')('playwright');
const ROOT = process.argv[2], OUT = process.argv[3], SEM_FAIXA = process.argv.includes('--sem-faixa');
const mime = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json' };
const srv = http.createServer((q, r) => { let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  r.writeHead(200, { 'content-type': mime[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)); }).listen(5581);
const APARELHOS = [
  { pasta: 'android-1080x1920', w: 360, h: 640 },
  { pasta: 'iphone69-1320x2868', w: 440, h: 956 },
];
// Nada disto pode aparecer numa tela de loja: ressalva legal D9 (ERP #8417) e a marca do modo demonstração.
const PROIBIDO = /REP-P|\bREP\b|Portaria|671|Modo demonstração|dados simulados/i;
const b = await chromium.launch();
for (const ap of APARELHOS) {
  const dir = path.join(OUT, ap.pasta); fs.mkdirSync(dir, { recursive: true });
  const ctx = await b.newContext({ viewport: { width: ap.w, height: ap.h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    geolocation: { latitude: -23.5505, longitude: -46.6333, accuracy: 12 }, permissions: ['geolocation'], locale: 'pt-BR', timezoneId: 'America/Sao_Paulo',
    colorScheme: 'light' });
  const p = await ctx.newPage();
  // Só some o que o build de produção NÃO mostra (faixa e caixa de demonstração) — decisão da gestão do app, 2026-10-01.
  const css = SEM_FAIXA ? '.app-banner.demo{display:none!important}' : '';
  const cssLogin = SEM_FAIXA ? '.l4-erro{display:none!important}' : '';
  const foto = async (n, { loja = true } = {}) => {
    if (css) await p.addStyleTag({ content: css });
    await p.waitForTimeout(700);
    if (SEM_FAIXA && loja) {
      // Só o texto visível conta: o que está escondido pelo CSS acima não sai na foto.
      const visivel = await p.evaluate(() => document.body.innerText);
      const achou = visivel.match(PROIBIDO);
      if (achou) throw new Error(`${ap.pasta}/${n}: texto proibido na tela ("${achou[0]}")`);
    }
    await p.screenshot({ path: path.join(dir, n + '.png') });
  };
  const aba = async (t) => { await p.locator('nav button, nav a').filter({ hasText: t }).first().click(); await p.waitForTimeout(1000); };
  const sub = async (t) => { await p.locator('main button, .oi-scroll button, button').filter({ hasText: t }).first().click(); await p.waitForTimeout(1000); };
  await p.goto('http://localhost:5581/'); await p.waitForTimeout(1200);
  if (cssLogin) await p.addStyleTag({ content: cssLogin });
  const demoNoLogin = await p.locator('.l4-erro').count();
  if (demoNoLogin !== 1) throw new Error('esperava 1 caixa de demonstração no login, achei ' + demoNoLogin);
  await foto('00-login');
  await p.getByPlaceholder('Usuário ou e-mail').fill('demo'); await p.getByPlaceholder('Senha').fill('demo123');
  await p.locator('button', { hasText: 'Entrar' }).last().click(); await p.waitForTimeout(1500);
  await foto('01-inicio');
  await aba('Tarefas'); await foto('02-tarefas');
  await aba('Pedidos'); await foto('03-pedidos');
  await aba('Produção'); await foto('04-producao');
  await aba('Mais'); await sub('Pessoas'); await foto('05-pessoas');
  await aba('Mais'); await sub('Bater ponto, espelho');
  const atualizar = p.locator('button').filter({ hasText: 'Atualizar local' });
  if (await atualizar.count()) { await atualizar.first().click(); await p.waitForTimeout(1200); }
  await foto('06-bater-ponto');
  await sub('Meu espelho'); await foto('07-meu-espelho');
  await aba('Mais'); await sub('Lembrete, privacidade'); await foto('08-conta', { loja: false });
  await ctx.close();
}
await b.close(); srv.close(); console.log('ok');
