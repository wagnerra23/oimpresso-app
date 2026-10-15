import { afterEach, describe, expect, it } from 'vitest';
import type { CalculoOrcamento, CorpoCalculoOrcamento, ListaOrcamentos, MaterialOrcamento, OrcamentoCriado } from './api';
import { demo } from './demo';
import {
  assinaturaCalculo, camposDaTela, corpoCalculo, corpoOrcamento, errosMedidas, medidaTexto, quantidadeTexto, resumoCalculo,
  totalMudou, totalPrevisto,
} from './orcamento-regras';
// Fonte crua (Vite `?raw`) da tela e das regras, para a varredura de aritmética.
import fonteRegras from './orcamento-regras.ts?raw';
import fonteTela from './telas/OrcamentoNovo.tsx?raw';

// Regra mestre (P4): o app nunca calcula nem arredonda valor. Os testes abaixo provam isso de três jeitos:
//   1. o que vai ao ERP e o que a tela mostra é o número do ERP, mesmo quando ele "não fecha" com L × A × preço;
//   2. uma varredura do código da tela e das regras falha se aparecer aritmética ou arredondamento;
//   3. a varredura morde: as mutações típicas (somar itens, área × preço, toFixed…) são pegas.

describe('P4 · orçamento rápido — texto das medidas (contrato: número como texto, com ponto)', () => {
  it('largura e altura: vírgula vira ponto, até 3 casas, maior que zero', () => {
    expect(medidaTexto('3,00')).toBe('3.00');
    expect(medidaTexto(' 1.2 ')).toBe('1.2');
    expect(medidaTexto('0,905')).toBe('0.905');
    expect(medidaTexto('007,5')).toBe('7.5');
    expect(medidaTexto('0')).toBeNull();
    expect(medidaTexto('0,000')).toBeNull();
    expect(medidaTexto('1,2345')).toBeNull();
    expect(medidaTexto('-1')).toBeNull();
    expect(medidaTexto('1.000,50')).toBeNull();
    expect(medidaTexto('')).toBeNull();
  });
  it('quantidade: inteiro a partir de 1', () => {
    expect(quantidadeTexto('1')).toBe('1');
    expect(quantidadeTexto('012')).toBe('12');
    expect(quantidadeTexto('0')).toBeNull();
    expect(quantidadeTexto('1,5')).toBeNull();
    expect(quantidadeTexto('')).toBeNull();
  });
  it('sem material ou com medida inválida, nada vai ao ERP', () => {
    expect(corpoCalculo(null, { largura: '3', altura: '1,2', quantidade: '1' })).toBeNull();
    expect(corpoCalculo(12, { largura: '3', altura: '', quantidade: '1' })).toBeNull();
    const c = corpoCalculo(12, { largura: '3,00', altura: '1,20', quantidade: '1' });
    expect(c).toEqual({ material_id: 12, largura_m: '3.00', altura_m: '1.20', quantidade: '1' });
    expect(assinaturaCalculo(c!)).toBe('12|3.00|1.20|1');
    expect(errosMedidas({ largura: '3,1234', altura: '', quantidade: '0' })).toEqual({
      largura: expect.any(String), quantidade: expect.any(String) });
  });
  it('erro de campo do ERP cai no campo da tela; o 422 da dupla prova é reconhecido pela chave literal', () => {
    expect(camposDaTela({ 'itens.0.largura_m': 'a', altura_m: 'b', cliente_id: 'c', material_id: 'd' }))
      .toEqual({ largura: 'a', altura: 'b', cliente: 'c', material: 'd' });
    expect(totalMudou({ 'itens.0.total_previsto': 'O total mudou' })).toBe(true);
    expect(totalMudou({ 'itens.0.largura_m': 'x' })).toBe(false);
  });
});

describe('P4 · regra mestre — o valor é o do ERP, sem conta nem arredondamento no app', () => {
  const c: CorpoCalculoOrcamento = { material_id: 12, largura_m: '3.00', altura_m: '1.20', quantidade: '1' };

  it('total_previsto é o total do ERP só reescrito como "N.NN"', () => {
    expect(totalPrevisto(234)).toBe('234.00');
    expect(totalPrevisto(1612.8)).toBe('1612.80');
    expect(totalPrevisto(0.1)).toBe('0.10');
    expect(totalPrevisto(1234567.89)).toBe('1234567.89');
  });
  it('total com mais de 2 casas, negativo ou fora do formato: o app NÃO arredonda (sem texto, não salva)', () => {
    expect(totalPrevisto(0.105)).toBeNull();
    expect(totalPrevisto(233.999)).toBeNull();
    expect(totalPrevisto(-5)).toBeNull();
    expect(totalPrevisto(1e21)).toBeNull();
    expect(totalPrevisto(Number.NaN)).toBeNull();
    expect(corpoOrcamento(null, c, { area_m2: 3.6, preco_m2: 65, total: 233.999 })).toBeNull();
  });
  it('ERP devolve um total que NÃO é L × A × preço: o app mostra e envia esse total, não o "certo"', () => {
    // 3,00 × 1,20 × R$ 65 daria R$ 234,00. O ERP manda outro número (ex.: preço mudou no meio); o app só repassa.
    const doErp: CalculoOrcamento = { area_m2: 3.6, preco_m2: 65, total: 999.99 };
    expect(corpoOrcamento(7, c, doErp)).toEqual({ cliente_id: 7, itens: [{ ...c, total_previsto: '999.99' }] });
    const r = resumoCalculo(doErp);
    expect(r.total).toMatch(/999,99/);
    expect(r.total).not.toMatch(/234/);
    expect(r.area).toBe('3,6 m²');
    expect(r.precoM2).toMatch(/65,00/);
  });
  it('um item por orçamento: o corpo leva exatamente o item calculado', () => {
    const corpo = corpoOrcamento(null, c, { area_m2: 3.6, preco_m2: 65, total: 234 });
    expect(corpo?.itens).toHaveLength(1);
    expect(corpo?.cliente_id).toBeNull();
  });
});

// ── Varredura: aritmética de valor no código do app (tela + regras) ─────────────────────────────────────────────
/** Tira comentários e o texto de strings/templates (as expressões `${…}` ficam), para olhar só o código. */
function soCodigo(fonte: string): string {
  let out = '', i = 0;
  const pilha: number[] = []; // profundidade de chaves dentro de cada `${`
  let modo: 'cod' | 'tpl' = 'cod';
  while (i < fonte.length) {
    const ch = fonte[i], prox = fonte[i + 1];
    if (modo === 'tpl') {
      if (ch === '\\') { i += 2; continue; }
      if (ch === '`') { out += '``'; modo = 'cod'; i++; continue; }
      if (ch === '$' && prox === '{') { pilha.push(0); modo = 'cod'; out += ' ('; i += 2; continue; }
      i++; continue;
    }
    if (ch === '/' && prox === '/') { while (i < fonte.length && fonte[i] !== '\n') i++; continue; }
    if (ch === '/' && prox === '*') { const f = fonte.indexOf('*/', i + 2); i = f < 0 ? fonte.length : f + 2; continue; }
    if (ch === '\'' || ch === '"') {
      let j = i + 1;
      while (j < fonte.length && fonte[j] !== ch && fonte[j] !== '\n') j += fonte[j] === '\\' ? 2 : 1;
      out += '""'; i = j + 1; continue;
    }
    if (ch === '`') { modo = 'tpl'; i++; continue; }
    if (pilha.length && ch === '{') pilha[pilha.length - 1]++;
    if (pilha.length && ch === '}') {
      if (pilha[pilha.length - 1] === 0) { pilha.pop(); modo = 'tpl'; out += ') '; i++; continue; }
      pilha[pilha.length - 1]--;
    }
    out += ch; i++;
  }
  return out;
}
const VALOR = '(?:total|preco|area|valor|largura|altura|quantidade|m2|centavos|soma|subtotal)\\w*';
const PROIBIDO: Array<[string, RegExp]> = [
  ['arredondamento/conversão numérica', /\b(?:Math\.\w+|parseFloat|parseInt)\b|\.(?:toFixed|toPrecision)\s*\(|\bNumber\s*\(/],
  ['soma acumulada', /\.reduce\s*\(|[-+*/%]=/],
  ['conta com valor (valor ⊕ x)', new RegExp(`\\b${VALOR}\\b\\s*[\\])]?\\s*[-+*/%](?![=>/*])`, 'i')],
  ['conta com valor (x ⊕ valor)', new RegExp(`[\\w)\\]]\\s*(?<![=<>!]=?)[-+*/%]\\s*(?:\\w+\\.)*${VALOR}\\b`, 'i')],
];
const aritmetica = (fonte: string) => {
  const cod = soCodigo(fonte);
  return PROIBIDO.flatMap(([nome, re]) => {
    const m = re.exec(cod);
    return m ? [`${nome}: "${cod.slice(Math.max(0, m.index - 20), m.index + 30).replace(/\s+/g, ' ')}"`] : [];
  });
};

describe('P4 · regra mestre — nenhuma aritmética de preço no app', () => {
  it.each([['orcamento-regras.ts', fonteRegras], ['telas/OrcamentoNovo.tsx', fonteTela]])('%s não calcula valor', (_nome, fonte) => {
    expect(fonte.length).toBeGreaterThan(1000);
    expect(aritmetica(fonte)).toEqual([]);
  });
  it('a varredura morde: cada mutação típica é pega', () => {
    const mutacoes = [
      'const total = area_m2 * preco_m2;',
      'const t = calculo.area_m2 * material.preco_m2;',
      'const soma = itens.reduce((a, i) => a + i.total, 0);',
      'let s = 0; s += it.total;',
      'const x = Math.round(total * 100) / 100;',
      'const t = calculo.total.toFixed(2);',
      'const v = parseFloat(m.largura);',
      'const v = Number(m.altura);',
      'const area = largura * altura * quantidade;',
      'return <b>{reais(item.total + frete)}</b>;',
      'const c = `${total - desconto}`;',
    ];
    for (const m of mutacoes) expect(aritmetica(m), m).not.toEqual([]);
  });
  it('a varredura não reclama de comentário, texto nem comparação', () => {
    expect(aritmetica('// total * 2\nconst a = "area * preco"; const b = `total: ${x}`; if (total === 0 || q >= 1) {}')).toEqual([]);
    expect(aritmetica('const t = `${nome} · ${total}`;')).toEqual([]);
  });
});

// ── Rotas simuladas (src/demo.ts) no formato do contrato tela-04-orcamento-rapido.md ───────────────────────────
describe('P4 · orçamento rápido — rota simulada (contrato tela-04)', () => {
  afterEach(() => demo.definirAjustes());
  const calcular = (c: Record<string, unknown>) => demo.chamar<CalculoOrcamento>('POST', '/api/app/orcamentos/calcular', c);
  const criar = (corpo: unknown, chave: string) => demo.chamar<OrcamentoCriado>('POST', '/api/app/orcamentos', corpo, { 'Idempotency-Key': chave });
  const lona = { material_id: 12, largura_m: '3.00', altura_m: '1.20', quantidade: '1' };
  const contar = async () => (await demo.chamar<ListaOrcamentos>('GET', '/api/app/orcamentos?status=todos&pagina=1')).contadores.todos;

  it('materiais ativos com preço do m²; não confunde com a lista de orçamentos', async () => {
    const r = await demo.chamar<{ itens: MaterialOrcamento[] }>('GET', '/api/app/orcamentos/materiais');
    expect(r.itens.map((m) => m.id)).toEqual([12, 18, 31]);
    expect(r.itens[0]).toEqual({ id: 12, nome: 'Lona 440g', categoria: 'lona', unidade: 'm2', preco_m2: 65 });
  });
  it('/calcular devolve os casos do protótipo', async () => {
    expect(await calcular(lona)).toEqual({ area_m2: 3.6, preco_m2: 65, total: 234 });
    expect(await calcular({ material_id: 31, largura_m: '6.40', altura_m: '0.90', quantidade: '1' })).toEqual({ area_m2: 5.76, preco_m2: 280, total: 1612.8 });
  });
  it('/calcular recusa número em JSON e medida zero (422 com o campo)', async () => {
    await expect(calcular({ ...lona, largura_m: 3 })).rejects.toMatchObject({ status: 422, codigo: 'validacao', campos: { largura_m: expect.any(String) } });
    await expect(calcular({ ...lona, quantidade: '0' })).rejects.toMatchObject({ status: 422, campos: { quantidade: expect.any(String) } });
  });
  it('grava com o total do /calcular: 201 rascunho ORC-<ano>-<5 dígitos>; a mesma chave devolve o mesmo, sem gravar de novo', async () => {
    const antes = await contar();
    const corpo = { cliente_id: 9, itens: [{ ...lona, total_previsto: '234.00' }] };
    const o = await criar(corpo, 'k-p4-1');
    expect(o).toMatchObject({ status: 'rascunho', total: 234 });
    expect(o.numero).toMatch(/^ORC-\d{4}-\d{5}$/);
    expect(await criar(corpo, 'k-p4-1')).toEqual(o);
    expect(await contar()).toBe(antes + 1);
    await expect(criar({ ...corpo, cliente_id: null }, 'k-p4-1')).rejects.toMatchObject({ status: 422, codigo: 'idempotencia_conflito' });
  });
  it('dupla prova: total divergente → 422 em itens.0.total_previsto e nada é gravado', async () => {
    const antes = await contar();
    await expect(criar({ cliente_id: null, itens: [{ ...lona, total_previsto: '233.99' }] }, 'k-p4-2'))
      .rejects.toMatchObject({ status: 422, codigo: 'validacao', campos: { 'itens.0.total_previsto': expect.stringMatching(/234\.00/) } });
    expect(await contar()).toBe(antes);
    // A chave não ficou reservada: o reenvio certo com a mesma chave grava.
    expect(await criar({ cliente_id: null, itens: [{ ...lona, total_previsto: '234.00' }] }, 'k-p4-2')).toMatchObject({ total: 234 });
  });
  it('cliente de fora (fornecedor ou inexistente) → 422 cliente_id', async () => {
    await expect(criar({ cliente_id: 15, itens: [{ ...lona, total_previsto: '234.00' }] }, 'k-p4-3'))
      .rejects.toMatchObject({ status: 422, campos: { cliente_id: expect.any(String) } });
  });
  it('ajuste app_orcamento_rapido desligado → 403 ao gravar; calcular continua respondendo', async () => {
    demo.definirAjustes({ app_orcamento_rapido: false });
    await expect(criar({ cliente_id: null, itens: [{ ...lona, total_previsto: '234.00' }] }, 'k-p4-4')).rejects.toMatchObject({ status: 403, codigo: 'sem_permissao' });
    expect((await calcular(lona)).total).toBe(234);
  });
});
