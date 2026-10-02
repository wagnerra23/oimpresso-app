// Gera src/styles/oi-v4.css a partir de design/oi-theme.v4.ts (tokens do design-v4,
// convertidos do DS do oimpresso pelo projeto de design). Não editar o CSS à mão:
// mudou o DS → troque design/oi-theme.v4.ts e rode `npm run tokens`.
import { readFileSync, writeFileSync } from 'node:fs';

const fonte = readFileSync(new URL('../design/oi-theme.v4.ts', import.meta.url), 'utf8');

function bloco(nome) {
  const ini = fonte.indexOf(`export const ${nome}`);
  if (ini < 0) throw new Error(`não achei ${nome} em oi-theme.v4.ts`);
  let i = fonte.indexOf('{', ini), nivel = 0, fim = i;
  for (; fim < fonte.length; fim++) {
    if (fonte[fim] === '{') nivel++;
    if (fonte[fim] === '}' && --nivel === 0) break;
  }
  return fonte.slice(i, fim + 1);
}

/** Só os pares chave: "#hex" do nível de cima (ignora brand/origin aninhados). */
function cores(objeto) {
  const out = {};
  let nivel = 0;
  for (const linha of objeto.split('\n')) {
    if (nivel === 1) {
      const m = linha.match(/^\s*([a-zA-Z0-9]+):\s*"(#[0-9a-fA-F]{3,8})"/);
      if (m) out[m[1]] = m[2];
    }
    for (const c of linha) { if (c === '{') nivel++; if (c === '}') nivel--; }
  }
  return out;
}

const VAR = {
  bg: '--bg', bg2: '--bg-2', surface: '--surface', surface2: '--surface-2', border: '--border', border2: '--border-2',
  text: '--text', textDim: '--text-dim', textMute: '--text-mute',
  accent: '--accent', accent2: '--accent-2', accentSoft: '--accent-soft', accentFg: '--accent-fg', accentText: '--accent-text',
  action: '--action', action2: '--action-2', actionSoft: '--action-soft', actionFg: '--action-fg',
  info: '--info', danger: '--danger', warn: '--warn', ok: '--ok',
};

function css(seletor, pal, marca) {
  const linhas = Object.entries(VAR).map(([k, v]) => {
    if (!pal[k]) throw new Error(`token ${k} ausente em ${seletor}`);
    return `  ${v}: ${pal[k]};`;
  });
  for (const [k, v] of Object.entries(marca)) linhas.push(`  --brand-${k}: ${v};`);
  return `${seletor} {\n${linhas.join('\n')}\n}\n`;
}

const claro = cores(bloco('lightPalette'));
const escuro = cores(bloco('darkPalette'));
const marca = cores(bloco('brand'));
const marcaEscura = cores(bloco('darkPalette').slice(bloco('darkPalette').indexOf('brand:') + 6));

const saida = `/* GERADO por scripts/tokens-v4.mjs a partir de design/oi-theme.v4.ts — não editar à mão.
   design-v4: neutros e destaque vêm do DS do oimpresso (roxo 295), ação em verde. */
${css('.oi', claro, marca)}
${css('.oi[data-theme="dark"]', escuro, marcaEscura)}`;

writeFileSync(new URL('../src/styles/oi-v4.css', import.meta.url), saida);
console.log(`oi-v4.css: ${Object.keys(claro).length} cores claras, ${Object.keys(escuro).length} escuras`);
