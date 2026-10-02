import { describe, expect, it } from 'vitest';
import { conferir, corpo, numeroBr, raiz, VAZIO } from './NovoProduto';

describe('Novo produto (tela 20) — quantidade digitada em pt-BR', () => {
  it('aceita vírgula ou ponto com até 2 casas, e converte sem erro de ponto flutuante', () => {
    expect(numeroBr('12,5')).toBe(12.5);
    expect(numeroBr('12.5')).toBe(12.5);
    expect(numeroBr('40')).toBe(40);
    expect(numeroBr('0,29')).toBe(0.29);
  });

  it('separador seguido de 3 dígitos é ambíguo (milhar ou decimal?) e é recusado', () => {
    expect(numeroBr('1.234')).toBeNull();
    expect(numeroBr('1.234,50')).toBeNull();
    expect(numeroBr('1,005')).toBeNull();
    expect(numeroBr('')).toBeNull();
    expect(numeroBr('-5')).toBeNull();
  });
});

describe('Novo produto (tela 20) — corpo do POST /api/app/produtos (§9.4)', () => {
  it('não manda preço nem custo: o produto nasce sem preço (decisão [W] 2026-10-02)', () => {
    const c = corpo({ ...VAZIO, nome: '  Adesivo  ', unidade_id: '1' });
    for (const k of ['preco', 'custo', 'margem']) expect(c).not.toHaveProperty(k);
    expect(c.nome).toBe('Adesivo');
    expect(c.unidade_id).toBe(1);
  });

  it('campos em branco vão null; código em branco fica para o ERP gerar; prateleira vazia não vai', () => {
    const c = corpo({ ...VAZIO, nome: 'X', unidade_id: '2' });
    expect(c.codigo).toBeNull();
    expect(c.categoria_id).toBeNull();
    expect(c.estoque).toEqual({ controla: true, minimo: null });
    expect(c.prateleira).toBeNull();
    expect(c.fiscal).toEqual({ ncm: null, cest: null, cfop_interno: null, cfop_externo: null });
  });

  it('mínimo sai como número JSON com ponto; NCM, CEST e CFOP saem só com dígitos', () => {
    const c = corpo({ ...VAZIO, nome: 'X', unidade_id: '1', minimo: '12,5', rack: 'A', ncm: '3919.90.00', cest: '01.001.00', cfop_interno: '5.102' });
    expect(c.estoque.minimo).toBe(12.5);
    expect(JSON.stringify(c.estoque)).toBe('{"controla":true,"minimo":12.5}');
    expect(c.prateleira).toEqual({ rack: 'A', fileira: null, posicao: null });
    expect(c.fiscal).toEqual({ ncm: '39199000', cest: '0100100', cfop_interno: '5102', cfop_externo: null });
  });

  it('sob demanda não manda mínimo nem prateleira', () => {
    const c = corpo({ ...VAZIO, nome: 'X', unidade_id: '1', controla: false, minimo: '40', rack: 'A' });
    expect(c.estoque).toEqual({ controla: false, minimo: null });
    expect(c.prateleira).toBeNull();
  });
});

describe('Novo produto (tela 20) — conferência por passo', () => {
  it('confere só o que impede salvar no passo atual', () => {
    expect(conferir(VAZIO, 'dados')).toMatchObject({ nome: expect.any(String), unidade_id: expect.any(String) });
    expect(conferir({ ...VAZIO, nome: 'X', unidade_id: '1' }, 'dados')).toEqual({});
    expect(conferir({ ...VAZIO, minimo: 'muito' }, 'estoque')).toHaveProperty(['estoque.minimo']);
    expect(conferir({ ...VAZIO, controla: false, minimo: 'muito' }, 'estoque')).toEqual({});
    expect(conferir({ ...VAZIO, ncm: '3919' }, 'fiscal')).toHaveProperty(['fiscal.ncm']);
    expect(conferir({ ...VAZIO, cest: '123' }, 'fiscal')).toHaveProperty(['fiscal.cest']);
    expect(conferir({ ...VAZIO, cfop_externo: '61020' }, 'fiscal')).toHaveProperty(['fiscal.cfop_externo']);
    expect(conferir({ ...VAZIO, ncm: '3919.90.00', cest: '0100100', cfop_interno: '5102' }, 'fiscal')).toEqual({});
  });

  it('erro de item de lista volta ao campo da tela; campo aninhado é mantido', () => {
    expect(raiz('estoque.minimo')).toBe('estoque.minimo');
    expect(raiz('fiscal.ncm.0')).toBe('fiscal.ncm');
    expect(raiz('nome')).toBe('nome');
  });
});
