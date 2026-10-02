import { describe, expect, it } from 'vitest';
import { conferir, corpo, numeroBr, raiz, VAZIO } from './NovoProduto';

describe('Novo produto (tela 20) — número digitado em pt-BR', () => {
  it('aceita vírgula ou ponto com até 2 casas, e converte sem erro de ponto flutuante', () => {
    expect(numeroBr('18,40')).toBe(18.4);
    expect(numeroBr('18.4')).toBe(18.4);
    expect(numeroBr('R$ 0,29')).toBe(0.29);
    expect(numeroBr('1234')).toBe(1234);
    expect(numeroBr('1,005')).toBeNull();
  });

  it('separador seguido de 3 dígitos é ambíguo (milhar ou decimal?) e é recusado', () => {
    expect(numeroBr('1.234')).toBeNull();
    expect(numeroBr('1.234,50')).toBeNull();
    expect(numeroBr('204.99605')).toBeNull();
    expect(numeroBr('')).toBeNull();
    expect(numeroBr('-5')).toBeNull();
  });
});

describe('Novo produto (tela 20) — corpo do POST', () => {
  it('o app NÃO manda preço de venda: só custo e margem, como digitados, com 2 casas', () => {
    const c = corpo({ ...VAZIO, nome: '  Adesivo  ', custo: '18,40', margem: '100' });
    expect(c).not.toHaveProperty('preco');
    expect(c.nome).toBe('Adesivo');
    expect(c.custo).toBe(18.4);
    expect(JSON.stringify(c.custo)).toBe('18.4');
    expect(c.margem).toBe(100);
  });

  it('campos em branco vão null; código em branco fica para o ERP gerar', () => {
    const c = corpo({ ...VAZIO, nome: 'X' });
    expect(c.codigo).toBeNull();
    expect(c.custo).toBeNull();
    expect(c.margem).toBeNull();
    expect(c.categoria_id).toBeNull();
    expect(c.fiscal).toEqual({ ncm: null, cfop: null, origem: 0 });
  });

  it('sob demanda não manda mínimo nem prateleira; NCM e CFOP saem só com dígitos', () => {
    const c = corpo({ ...VAZIO, nome: 'X', controla: false, minimo: '40', rack: 'A', ncm: '3919.90.00', cfop: '5.102' });
    expect(c.estoque).toEqual({ controla: false, minimo: null, prateleira: { rack: null, fileira: null, posicao: null } });
    expect(c.fiscal.ncm).toBe('39199000');
    expect(c.fiscal.cfop).toBe('5102');
  });
});

describe('Novo produto (tela 20) — conferência por passo', () => {
  it('confere só o que impede salvar no passo atual', () => {
    expect(conferir(VAZIO, 'dados')).toHaveProperty('nome');
    expect(conferir({ ...VAZIO, nome: 'X' }, 'dados')).toEqual({});
    expect(conferir({ ...VAZIO, custo: '1.234,50' }, 'preco')).toHaveProperty('custo');
    expect(conferir({ ...VAZIO, margem: '100' }, 'preco')).toHaveProperty('custo');
    expect(conferir({ ...VAZIO, custo: '18,40', margem: '100' }, 'preco')).toEqual({});
    expect(conferir({ ...VAZIO, minimo: 'muito' }, 'estoque')).toHaveProperty(['estoque.minimo']);
    expect(conferir({ ...VAZIO, ncm: '3919' }, 'fiscal')).toHaveProperty(['fiscal.ncm']);
    expect(conferir({ ...VAZIO, cfop: '51020' }, 'fiscal')).toHaveProperty(['fiscal.cfop']);
  });

  it('erro de item de lista volta ao campo da tela; campo aninhado é mantido', () => {
    expect(raiz('estoque.minimo')).toBe('estoque.minimo');
    expect(raiz('fiscal.ncm.0')).toBe('fiscal.ncm');
    expect(raiz('nome')).toBe('nome');
  });
});
