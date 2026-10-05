// Screenshots de loja do build de demonstração do oimpresso-app — 3º lote, escopo D16 (todas as telas antes do envio).
// Uso: node capturar.mjs <www> <saida> [--sem-faixa]
// Android telefone: 360x640 @3 = 1080x1920 · iPhone 6.9": 440x956 @3 = 1320x2868.
// GPS simulado (coordenada genérica), nada vai para servidor (build de demonstração, dados fictícios de demo.ts).
// Ordem na loja (8 = máximo da Play; a App Store aceita até 10 e usa as mesmas 8):
// 01 início · 02 pedidos · 03 produção · 04 tarefas · 05 produtos · 06 financeiro · 07 ordens de serviço · 08 bater ponto.
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
  const foto = async (n) => {
    if (css) await p.addStyleTag({ content: css });
    await p.waitForTimeout(900);
    // Tela vazia ou com erro não vai à loja: exige conteúdo além do título.
    const visivel = await p.evaluate(() => document.body.innerText);
    if (SEM_FAIXA) {
      const achou = visivel.match(PROIBIDO);
      if (achou) throw new Error(`${ap.pasta}/${n}: texto proibido na tela ("${achou[0]}")`);
    }
    if (/erro|não foi possível|sem conexão/i.test(visivel)) throw new Error(`${ap.pasta}/${n}: tela com erro`);
    await p.screenshot({ path: path.join(dir, n + '.png') });
  };
  const aba = async (t) => { await p.locator('nav button, nav a').filter({ hasText: t }).first().click(); await p.waitForTimeout(1000); };
  // Item de Mais pelo rótulo exato (o texto de descrição de outros itens também cita "Produtos", "estoque"...).
  const modulo = async (t) => {
    await aba('Mais');
    const alvo = p.locator('button').filter({ has: p.locator('b', { hasText: new RegExp(`^${t}$`) }) });
    if ((await alvo.count()) !== 1) throw new Error(`${ap.pasta}: esperava 1 item "${t}" em Mais, achei ${await alvo.count()}`);
    await alvo.click(); await p.waitForTimeout(1200);
  };
  await p.goto('http://localhost:5581/'); await p.waitForTimeout(1200);
  await p.getByPlaceholder('Usuário ou e-mail').fill('demo'); await p.getByPlaceholder('Senha').fill('demo123');
  await p.locator('button', { hasText: 'Entrar' }).last().click(); await p.waitForTimeout(1500);
  await foto('01-inicio');
  await aba('Pedidos'); await foto('02-pedidos');
  await aba('Produção'); await foto('03-producao');
  await aba('Tarefas'); await foto('04-tarefas');
  await modulo('Produtos'); await foto('05-produtos');
  await modulo('Financeiro'); await foto('06-financeiro');
  await modulo('Oficina'); await foto('07-ordens-de-servico');
  await modulo('Ponto');
  const atualizar = p.locator('button').filter({ hasText: 'Atualizar local' });
  if (await atualizar.count()) { await atualizar.first().click(); await p.waitForTimeout(1200); }
  await foto('08-bater-ponto');
  await ctx.close();
}
await b.close(); srv.close(); console.log('ok');
