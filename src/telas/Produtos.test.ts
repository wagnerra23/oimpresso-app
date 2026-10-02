import { describe, expect, it } from 'vitest';
import { aPartirDe, rotuloProdutos, textoEstoque, textoMeta, textoPreco } from './Produtos';

describe('tela 19 · Produtos — textos do cartão', () => {
  it('estoque controlado mostra quantidade e unidade, sem zeros sobrando', () => {
    expect(textoEstoque({ controla: true, qtd: 18, unidade: 'm²' })).toBe('18 m²');
    expect(textoEstoque({ controla: true, qtd: 2.5, unidade: 'un' })).toBe('2,5 un');
    expect(textoEstoque({ controla: true, qtd: 1234.5678, unidade: null })).toBe('1.234,57');
  });
  it('produto que não controla estoque é "sob demanda"', () => {
    expect(textoEstoque({ controla: false, qtd: null, unidade: 'un' })).toBe('sob demanda');
  });
  it('preço com mais de uma variação ganha "a partir de"; sem preço, travessão', () => {
    expect(textoPreco(42)).toMatch(/^R\$\s?42,00$/);
    expect(textoPreco(null)).toBe('—');
    expect(aPartirDe({ preco: 29, variacoes: 3 })).toBe(true);
    expect(aPartirDe({ preco: 29, variacoes: 1 })).toBe(false);
    expect(aPartirDe({ preco: 29, variacoes: null })).toBe(false);
    expect(aPartirDe({ preco: null, variacoes: 3 })).toBe(false);
  });
  it('linha de baixo pula o que vier vazio e nomeia o sem categoria', () => {
    expect(textoMeta({ codigo: 'LON-440', categoria: 'Adesivos', calculo: 'por m²' })).toEqual(['LON-440', 'Adesivos', 'por m²']);
    expect(textoMeta({ codigo: '', categoria: null, calculo: null })).toEqual(['Sem categoria']);
  });
  it('rótulo do topo cabe ao lado do "+ Produto": contagem e quantos estão em baixa', () => {
    expect(rotuloProdutos(6, 2)).toBe('6 produtos · 2 em baixa');
    expect(rotuloProdutos(1, 0)).toBe('1 produto');
    expect(rotuloProdutos(0, 0)).toBe('0 produtos');
  });
});
