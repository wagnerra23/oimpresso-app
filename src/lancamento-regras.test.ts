// Novo lançamento (tela 06): validação por campo e corpo que vai ao ERP. Mexe em valor (regra mestre): o corpo
// leva só os campos do contrato, montados um a um, e o valor arredondado em centavos.
import { describe, expect, it } from 'vitest';
import { contaAnalitica, corpoLancamento, dataGeracao, dividirParcelas, formVazio, planosDoTipo, previaParcelas, proximaRecorrencia, somarMeses,
  validarLancamento, type FormLancamento } from './lancamento-regras';

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
      parcelas: null, recorrencia: null,
    });
  });
  it('não leva o nome da pessoa, só o id', () => expect(Object.keys(corpoLancamento(ok({ parte: { id: 1, nome: 'X' } })))).not.toContain('parte'));
  it('recusa valor inválido mesmo sem validar antes', () => expect(() => corpoLancamento(ok({ valor: '0' }))).toThrow());
});

describe('parcelado', () => {
  it('divide em centavos e a sobra vai para a 1ª', () => {
    expect(dividirParcelas(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(dividirParcelas(1250.5, 2)).toEqual([625.25, 625.25]);
    expect(dividirParcelas(0.05, 2)).toEqual([0.03, 0.02]);
  });
  it('a soma das parcelas é sempre o total', () => {
    for (const [t, n] of [[999.99, 7], [1, 3], [12345.67, 60]] as const) {
      expect(Math.round(dividirParcelas(t, n).reduce((a, b) => a + b, 0) * 100)).toBe(Math.round(t * 100));
    }
  });
  it('um vencimento por mês; dia 31 cai no último dia do mês curto', () => {
    expect(previaParcelas(300, '2026-01-31', 3).map((p) => p.vencimento)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
    expect(somarMeses('2026-11-15', 3)).toBe('2027-02-15');
    expect(somarMeses('2026-03-31', -1)).toBe('2026-02-28');
  });
  it('valida número de parcelas e não deixa parcela de zero', () => {
    expect(validarLancamento(ok({ repeticao: 'parcelado', parcelas: '1' }), PLANOS).parcelas).toMatch(/2 a 60/);
    expect(validarLancamento(ok({ repeticao: 'parcelado', parcelas: '61' }), PLANOS).parcelas).toMatch(/2 a 60/);
    expect(validarLancamento(ok({ repeticao: 'parcelado', parcelas: '3', valor: '0,02' }), PLANOS).parcelas).toMatch(/0,01/);
    expect(validarLancamento(ok({ repeticao: 'parcelado', parcelas: '12' }), PLANOS)).toEqual({});
  });
  it('corpo leva o total e o número de parcelas', () => {
    const c = corpoLancamento(ok({ repeticao: 'parcelado', parcelas: '3' }));
    expect([c.valor, c.parcelas, c.recorrencia]).toEqual([1250.5, 3, null]);
  });
});

describe('recorrente', () => {
  it('gera no mesmo mês quando o dia vem antes do vencimento, senão no mês anterior', () => {
    expect(dataGeracao('2026-11-10', 1)).toBe('2026-11-01');
    expect(dataGeracao('2026-11-10', 10)).toBe('2026-11-10');
    expect(dataGeracao('2026-11-10', 25)).toBe('2026-10-25');
    expect(dataGeracao('2026-03-05', 28)).toBe('2026-02-28');
  });
  it('próximo ciclo a partir de hoje, por frequência', () => {
    expect(proximaRecorrencia('2026-10-10', 'mensal', 1, null, '2026-10-15')).toEqual({ geracao: '2026-11-01', vencimento: '2026-11-10' });
    expect(proximaRecorrencia('2026-10-10', 'trimestral', 25, null, '2026-10-15')).toEqual({ geracao: '2026-12-25', vencimento: '2027-01-10' });
    expect(proximaRecorrencia('2025-06-20', 'anual', 5, null, '2026-10-15')).toEqual({ geracao: '2027-06-05', vencimento: '2027-06-20' });
  });
  it('pula ciclos já gerados e para no término do contrato', () => {
    expect(proximaRecorrencia('2026-01-10', 'mensal', 1, null, '2026-10-15')).toEqual({ geracao: '2026-11-01', vencimento: '2026-11-10' });
    expect(proximaRecorrencia('2026-10-10', 'mensal', 1, '2026-11-09', '2026-10-15')).toBeNull();
  });
  it('valida dia de renovação e término', () => {
    expect(validarLancamento(ok({ repeticao: 'recorrente', dia_geracao: '31' }), PLANOS).dia_geracao).toMatch(/1 a 28/);
    expect(validarLancamento(ok({ repeticao: 'recorrente', termino: '2026-10-01' }), PLANOS).termino).toMatch(/antes do 1º vencimento/);
    expect(validarLancamento(ok({ repeticao: 'recorrente', dia_geracao: '5', termino: '2027-10-30' }), PLANOS)).toEqual({});
  });
  it('corpo leva a recorrência e não leva parcelas', () => {
    const c = corpoLancamento(ok({ repeticao: 'recorrente', frequencia: 'anual', dia_geracao: '5', termino: '' }));
    expect([c.parcelas, c.recorrencia]).toEqual([null, { frequencia: 'anual', dia_geracao: 5, termino: null }]);
  });
});
