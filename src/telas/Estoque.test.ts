import { describe, expect, it } from 'vitest';
import { ehBaixo, pctBarra, textoOnde, textoQtd, tomEstoque } from './Estoque';

describe('tela 05 · Estoque — regras do cartão', () => {
  it('"baixo" é qtd ≤ mínimo; sem mínimo nunca é baixo', () => {
    expect(ehBaixo({ qtd: 18, minimo: 50 })).toBe(true);
    expect(ehBaixo({ qtd: 10, minimo: 10 })).toBe(true);
    expect(ehBaixo({ qtd: 11, minimo: 10 })).toBe(false);
    expect(ehBaixo({ qtd: 0, minimo: null })).toBe(false);
  });
  it('tom segue o protótipo: até o mínimo perigo, até o dobro atenção, acima ok', () => {
    expect(tomEstoque({ qtd: 18, minimo: 50 })).toBe('danger');
    expect(tomEstoque({ qtd: 64, minimo: 40 })).toBe('warn');
    expect(tomEstoque({ qtd: 81, minimo: 40 })).toBe('ok');
    expect(tomEstoque({ qtd: 5, minimo: null })).toBeNull();
  });
  it('a barra enche em 3× o mínimo e some sem mínimo', () => {
    expect(pctBarra({ qtd: 18, minimo: 50 })).toBe(12);
    expect(pctBarra({ qtd: 2400, minimo: 1000 })).toBe(80);
    expect(pctBarra({ qtd: 9000, minimo: 1000 })).toBe(100);
    expect(pctBarra({ qtd: -3, minimo: 10 })).toBe(0);
    expect(pctBarra({ qtd: 4, minimo: null })).toBeNull();
    expect(pctBarra({ qtd: 4, minimo: 0 })).toBeNull();
  });
  it('quantidade com unidade e onde fica (prateleira · loja)', () => {
    expect(textoQtd(2400, 'un')).toBe('2.400 un');
    expect(textoQtd(2.5, 'L')).toBe('2,5 L');
    expect(textoQtd(3, null)).toBe('3');
    expect(textoOnde({ prateleira: 'A · 1 · 2', local: 'Loja Centro' })).toBe('A · 1 · 2 · Loja Centro');
    expect(textoOnde({ prateleira: null, local: 'Filial Norte' })).toBe('Filial Norte');
  });
});
