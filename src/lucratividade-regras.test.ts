// P6 · tela 13 — apresentação das abas Lucratividade e Comissões, e a demo no formato do contrato (ERP #9448).
import { afterEach, describe, expect, it } from 'vitest';
import { avisoSemComissoes, equilibrio, reaisCurto, rotuloBase, tomMargem } from './lucratividade-regras';
import { demo } from './demo';
import type { Relatorios } from './api';

describe('regras de apresentação (P6)', () => {
  it('cor da margem por pedido: < 15% ruim, < 25% atenção', () => {
    expect(tomMargem(12)).toBe('neg');
    expect(tomMargem(-900)).toBe('neg');
    expect(tomMargem(15)).toBe('warn');
    expect(tomMargem(24.9)).toBe('warn');
    expect(tomMargem(25)).toBe('');
  });
  it('barra do equilíbrio: cheia quando a receita passou, proporcional quando não', () => {
    expect(equilibrio({ receita: 148230, ponto_equilibrio: 88296.43 })).toEqual({ acima: true, preenchido: 100 });
    expect(equilibrio({ receita: 50000, ponto_equilibrio: 100000 })).toEqual({ acima: false, preenchido: 50 });
    expect(equilibrio({ receita: 0, ponto_equilibrio: null })).toBeNull();
  });
  it('valor curto para as três colunas', () => {
    expect(reaisCurto(148230)).toBe('R$ 148,2 mil');
    expect(reaisCurto(1689822)).toBe('R$ 1,69 mi');
    expect(reaisCurto(452)).toBe('R$ 452,00');
    expect(reaisCurto(-79400)).toBe('−R$ 79,4 mil');
  });
  it('rótulo da base e aviso conforme o ajuste da empresa', () => {
    expect(rotuloBase('payment_received')).toMatch(/quando o cliente paga/);
    expect(rotuloBase('invoice_value')).toMatch(/valor vendido/);
    expect(avisoSemComissoes(true)).toBe('Seu usuário não pode ver comissões.');
    expect(avisoSemComissoes(false)).toMatch(/empresa não libera/);
  });
});

const rel = (periodo: string, aba: string) => demo.chamar<Relatorios>('GET', `/api/app/relatorios?periodo=${periodo}&aba=${aba}`);

describe('demo no formato do contrato (P6)', () => {
  afterEach(() => demo.definirAjustes());

  it('aba lucratividade: só esse bloco preenchido, campos do contrato', async () => {
    await demo.entrar('demo', '123');
    const r = await rel('mes', 'lucratividade');
    expect(r.comissoes).toBeNull();
    expect(r.dre).toBeNull();
    const l = r.lucratividade!;
    expect(Object.keys(l).sort()).toEqual(['custo_fixo', 'custo_variavel', 'margem_contribuicao', 'margem_pct', 'menores_margens', 'ponto_equilibrio', 'receita']);
    expect(l.margem_contribuicao).toBe(68830);
    expect(l.margem_pct).toBe(46.4);
    expect(Object.keys(l.menores_margens[0]).sort()).toEqual(['margem_pct', 'numero', 'pedido_id', 'resumo', 'valor']);
  });

  it('aba comissoes: gestor vê todos, maior comissão primeiro', async () => {
    await demo.entrar('demo', '123');
    const c = (await rel('mes', 'comissoes')).comissoes!;
    expect(c.base).toBe('payment_received');
    expect(c.vendedores.map((v) => v.nome)).toEqual(['Ana Souza', 'Bruno Lima', 'Carla Mendes']);
    expect(c.vendedores[0]).toEqual({ id: 7, nome: 'Ana Souza', percentual: 3, vendido: 62100, recebido: 54300, comissao: 1629, a_liberar: 234 });
  });

  it('vendedor vê só a própria linha; com o ajuste desligado, comissoes null', async () => {
    await demo.entrar('ana.vendas', '123');
    expect((await rel('mes', 'comissoes')).comissoes!.vendedores.map((v) => v.id)).toEqual([7]);
    demo.definirAjustes({ app_comissao_vendedor_ve_propria: false });
    expect((await rel('mes', 'comissoes')).comissoes).toBeNull();
  });
});
