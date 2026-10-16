// Recibo: valor por extenso, texto pelo lado (recebido x pago) e o PDF que o app monta sozinho.
import { describe, expect, it } from 'vitest';
import { dataPorExtenso, pdfRecibo, quebrarLinhas, reciboComoTexto, textoRecibo, valorPorExtenso, type ReciboDados } from './recibo';

describe('valorPorExtenso', () => {
  it.each([
    [1, 'um real'], [21, 'vinte e um reais'], [100, 'cem reais'], [101, 'cento e um reais'], [1001, 'mil e um reais'],
    [1260, 'mil duzentos e sessenta reais'], [1500, 'mil e quinhentos reais'], [0.5, 'cinquenta centavos'], [0.01, 'um centavo'],
    [333.34, 'trezentos e trinta e três reais e trinta e quatro centavos'], [2000000, 'dois milhões de reais'],
    [1200000, 'um milhão e duzentos mil reais'], [7840, 'sete mil oitocentos e quarenta reais'],
  ])('%s → %s', (v, txt) => expect(valorPorExtenso(v)).toBe(txt));
  it('data por extenso', () => expect(dataPorExtenso('2026-10-15')).toBe('15 de outubro de 2026'));
});

const base: ReciboDados = {
  numero: 'REC-2026-00902', tipo: 'receber', valor: 1260, data: '2026-10-15', referente: 'Pedido #0044 · placas', forma: 'Boleto',
  documento: 'PED-0044/1', empresa: { nome: 'Gráfica Demonstração', documento: '00.000.000/0001-91', cidade: 'Tubarão/SC' },
  parte: { nome: 'Clínica Vita', documento: '00.000.000/0002-72' },
};

describe('textoRecibo', () => {
  it('recebido: a empresa recebe do cliente e assina', () => {
    const t = textoRecibo(base);
    expect(t.corpo).toMatch(/^Recebemos de Clínica Vita, CNPJ 00\.000\.000\/0002-72, a importância de R\$\s1\.260,00 \(mil duzentos e sessenta reais\)/);
    expect(t.corpo).toContain('documento PED-0044/1, pago via Boleto');
    expect([t.assinante, t.local]).toEqual(['Gráfica Demonstração', 'Tubarão/SC, 15 de outubro de 2026.']);
  });
  it('pago: o fornecedor recebe da empresa e assina', () => {
    const t = textoRecibo({ ...base, tipo: 'pagar', parte: { nome: 'Gráfica Lona Sul', documento: null } });
    expect(t.corpo).toMatch(/^Recebi de Gráfica Demonstração, CNPJ 00\.000\.000\/0001-91, a importância/);
    expect([t.assinante, t.assinanteDoc]).toEqual(['Gráfica Lona Sul', null]);
  });
  it('texto para copiar tem número, valor e assinatura', () => {
    const x = reciboComoTexto(base);
    expect(x.split('\n')[0]).toMatch(/^RECIBO Nº REC-2026-00902 — R\$\s1\.260,00$/);
    expect(x).toContain('Gráfica Demonstração — 00.000.000/0001-91');
  });
});

describe('pdfRecibo', () => {
  const pdf = pdfRecibo(base);
  const txt = String.fromCharCode(...pdf);
  it('é um PDF com fim de arquivo', () => {
    expect(txt.startsWith('%PDF-1.4')).toBe(true);
    expect(txt.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('a tabela xref aponta para cada objeto', () => {
    const inicio = Number(txt.match(/startxref\n(\d+)/)![1]);
    expect(txt.slice(inicio, inicio + 4)).toBe('xref');
    const offs = [...txt.slice(inicio).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(offs).toHaveLength(6);
    offs.forEach((o, i) => expect(txt.slice(o, o + 7)).toBe(`${i + 1} 0 obj`));
  });
  it('acento vai em WinAnsi (um byte) e parêntese é escapado', () => {
    expect(pdf.includes(0xe7)).toBe(true); // "ç" de "Demonstração"
    expect(txt).toContain('\\(mil');
  });
  it('o tamanho do stream bate com o declarado', () => {
    const m = txt.match(/<< \/Length (\d+) >>\nstream\n/)!;
    const ini = m.index! + m[0].length;
    expect(txt.slice(ini + Number(m[1]), ini + Number(m[1]) + 10)).toBe('\nendstream');
  });
  it('quebra o texto sem passar da largura', () => {
    const linhas = quebrarLinhas(textoRecibo(base).corpo, 483, 11.5);
    expect(linhas.length).toBeGreaterThan(2);
    expect(linhas.join(' ')).toBe(textoRecibo(base).corpo);
  });
});

describe('moldura do recibo (revisão #98)', () => {
  it('com texto longo, a moldura desce até abaixo da assinatura', () => {
    const longo = pdfRecibo({ ...base, referente: 'x'.repeat(40) + ' ' + 'Pedido de fachada completa com letreiro iluminado e instalação '.repeat(2).slice(0, 120),
      parte: { nome: 'Empresa de Nome Bem Comprido Comunicação Visual e Serviços Ltda', documento: '00.000.000/0002-72' } });
    const txt = String.fromCharCode(...longo);
    const [, yRet] = txt.match(/\d+ (\d+) \d+ \d+ re S/)!.map(Number);
    const ys = [...txt.matchAll(/ (\d+(?:\.\d+)?) Td /g)].map((m) => Number(m[1]));
    expect(yRet).toBeLessThan(Math.min(...ys));
  });
});
