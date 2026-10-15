// Novo lançamento (tela 06): validação por campo e corpo que vai ao ERP. Mexe em valor (regra mestre): o corpo
// leva só os campos do contrato, montados um a um, e o valor arredondado em centavos.
import { describe, expect, it } from 'vitest';
import { contaAnalitica, corpoLancamento, formVazio, planosDoTipo, validarLancamento, type FormLancamento } from './lancamento-regras';

const PLANOS = [
  { codigo: '1', nome: 'Receitas', tipo: 'receita' as const }, { codigo: '1.1', nome: 'Vendas', tipo: 'receita' as const },
  { codigo: '1.1.01', nome: 'Comunicação visual', tipo: 'receita' as const }, { codigo: '2', nome: 'Despesas', tipo: 'despesa' as const },
  { codigo: '2.1', nome: 'Insumos', tipo: 'despesa' as const }, { codigo: '2.1.01', nome: 'Lona', tipo: 'despesa' as const },
];
const ok = (x: Partial<FormLancamento> = {}): FormLancamento => ({
  ...formVazio('pagar', '2026-10-15'), descricao: 'Lona 440 g', valor: '1.250,50', vencimento: '2026-10-30', plano: '2.1.01', ...x,
});

describe('validarLancamento', () => {
  it('formulário completo passa', () => expect(validarLancamento(ok(), PLANOS)).toEqual({}));
  it('obrigatórios', () => {
    const e = validarLancamento(formVazio('receber', '2026-10-15'), PLANOS);
    expect(Object.keys(e).sort()).toEqual(['descricao', 'plano', 'valor', 'vencimento']);
  });
  it('valor: zero, negativo, texto e mais de 2 casas', () => {
    expect(validarLancamento(ok({ valor: '0' }), PLANOS).valor).toMatch(/maior que zero/);
    expect(validarLancamento(ok({ valor: '-5' }), PLANOS).valor).toMatch(/maior que zero/);
    expect(validarLancamento(ok({ valor: 'abc' }), PLANOS).valor).toMatch(/inválido/);
    expect(validarLancamento(ok({ valor: '10,555' }), PLANOS).valor).toMatch(/2 casas/);
    expect(validarLancamento(ok({ valor: '19,99' }), PLANOS).valor).toBeUndefined();
  });
  it('vencimento antes da emissão', () => expect(validarLancamento(ok({ vencimento: '2026-10-01' }), PLANOS).vencimento).toMatch(/antes da emissão/));
  it('grupo do plano não recebe lançamento', () => expect(validarLancamento(ok({ plano: '2.1' }), PLANOS).plano).toMatch(/não um grupo/));
});

describe('plano de contas', () => {
  it('conta analítica é a que não tem filhas', () => {
    expect(contaAnalitica('2.1.01', PLANOS)).toBe(true);
    expect(contaAnalitica('2.1', PLANOS)).toBe(false);
  });
  it('receber mostra receitas e pagar mostra despesas', () => {
    expect(planosDoTipo(PLANOS, 'receber').map((p) => p.codigo)).toEqual(['1', '1.1', '1.1.01']);
    expect(planosDoTipo(PLANOS, 'pagar').map((p) => p.codigo)).toEqual(['2', '2.1', '2.1.01']);
  });
});

describe('corpoLancamento', () => {
  it('converte o valor e manda vazio como null', () => {
    expect(corpoLancamento(ok({ parte: { id: 11, nome: 'Gráfica Lona Sul' }, documento: '  ', nf: '88213 ' }))).toEqual({
      tipo: 'pagar', descricao: 'Lona 440 g', contato_id: 11, valor: 1250.5, vencimento: '2026-10-30', emissao: '2026-10-15',
      competencia: '2026-10', forma_pagamento: null, conta_id: null, plano_codigo: '2.1.01', documento: null, nf_numero: '88213', observacao: null,
    });
  });
  it('não leva o nome da pessoa, só o id', () => expect(Object.keys(corpoLancamento(ok({ parte: { id: 1, nome: 'X' } })))).not.toContain('parte'));
  it('recusa valor inválido mesmo sem validar antes', () => expect(() => corpoLancamento(ok({ valor: '0' }))).toThrow());
});
