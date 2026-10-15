// Contrato do filtro avançado do Financeiro: parâmetros da rota, ida e volta, e a regra de filtragem da demo.
import { describe, expect, it } from 'vitest';
import { contarFiltros, filtrarLancamentos, lerSituacoes, ordenarLancamentos, situacaoDe, FILTROS_VAZIOS, lerParams, lerValor, paramsFiltros, periodoDe, type FiltrosFinanceiro } from './financeiro-filtros';

const f = (x: Partial<FiltrosFinanceiro>): FiltrosFinanceiro => ({ ...FILTROS_VAZIOS, ...x });
const L = [
  { id: 1, descricao: 'Pedido #0044 · placas', parte: 'Clínica Vita', vencimento: '2026-10-08', pago_em: null, valor: 1260,
    emissao: '2026-09-08', competencia: '2026-09', venda_em: '2026-09-05', forma_pagamento: 'Boleto', conta_id: 1, nf_numero: '1284', nosso_numero: '00012311' },
  { id: 2, descricao: 'Aluguel do galpão', parte: 'Imobiliária Centro', vencimento: '2026-10-30', pago_em: null, valor: 3500,
    emissao: '2026-10-01', competencia: '2026-10', venda_em: null, forma_pagamento: 'Transferência', conta_id: 1, nf_numero: null, nosso_numero: null },
  { id: 3, descricao: 'Venda balcão #V-0009', parte: 'Consumidor final', vencimento: '2026-10-13', pago_em: '2026-10-13', valor: 186,
    emissao: '2026-10-13', competencia: '2026-10', venda_em: '2026-10-13', forma_pagamento: 'Dinheiro', conta_id: 2, nf_numero: null, nosso_numero: null },
];
const ids = (x: FiltrosFinanceiro) => filtrarLancamentos(L, x).map((l) => l.id);

describe('lerValor', () => {
  it('aceita formato brasileiro e com ponto', () => {
    expect(lerValor('1.500,50')).toBe(1500.5);
    expect(lerValor('R$ 200')).toBe(200);
    expect(lerValor('99.9')).toBe(99.9);
    expect(lerValor('1.000')).toBe(1000);
  });
  it('vazio ou texto vira null', () => { expect(lerValor('  ')).toBeNull(); expect(lerValor('abc')).toBeNull(); });
});

describe('paramsFiltros / lerParams', () => {
  it('sem filtro não acrescenta nada à rota', () => expect(paramsFiltros(FILTROS_VAZIOS)).toBe(''));
  it('só manda o campo de data quando há período', () => {
    expect(paramsFiltros(f({ campo_data: 'emissao' }))).toBe('');
    expect(paramsFiltros(f({ campo_data: 'emissao', de: '2026-10-01' }))).toBe('&data_campo=emissao&de=2026-10-01');
  });
  it('ida e volta mantém os filtros', () => {
    const x = f({ campo_data: 'competencia', de: '2026-09-01', ate: '2026-10-31', texto: 'Clínica', forma: 'Boleto', conta_id: 1,
      nf: '1284', nosso_numero: '00012311', valor_min: '1000', valor_max: '2000' });
    expect(lerParams('/api/app/financeiro?aba=receber&pagina=1' + paramsFiltros(x))).toEqual(x);
  });
  it('conta cada filtro ligado uma vez', () => expect(contarFiltros(f({ de: '2026-10-01', ate: '2026-10-31', forma: 'Pix', valor_max: '50' }))).toBe(3));
});

describe('filtrarLancamentos', () => {
  it('período pela data escolhida', () => {
    expect(ids(f({ campo_data: 'vencimento', de: '2026-10-01', ate: '2026-10-15' }))).toEqual([1, 3]);
    expect(ids(f({ campo_data: 'emissao', de: '2026-10-01', ate: '2026-10-31' }))).toEqual([2, 3]);
    expect(ids(f({ campo_data: 'pagamento', de: '2026-10-01' }))).toEqual([3]);
    expect(ids(f({ campo_data: 'venda', ate: '2026-09-30' }))).toEqual([1]);
  });
  it('competência compara pelo mês', () => expect(ids(f({ campo_data: 'competencia', de: '2026-09-15', ate: '2026-09-15' }))).toEqual([1]));
  it('texto em razão social ou descrição, sem acento', () => {
    expect(ids(f({ texto: 'clinica' }))).toEqual([1]);
    expect(ids(f({ texto: 'galpao' }))).toEqual([2]);
  });
  it('forma, conta, nota, nosso número e valor', () => {
    expect(ids(f({ forma: 'Dinheiro' }))).toEqual([3]);
    expect(ids(f({ conta_id: 1 }))).toEqual([1, 2]);
    expect(ids(f({ nf: '1284' }))).toEqual([1]);
    expect(ids(f({ nosso_numero: '12311' }))).toEqual([1]);
    expect(ids(f({ valor_min: '1.000', valor_max: '2.000' }))).toEqual([1]);
  });
});

describe('periodoDe', () => {
  const hoje = new Date(2026, 9, 15);
  it('este mês e mês passado', () => {
    expect(periodoDe('mes', hoje)).toEqual({ de: '2026-10-01', ate: '2026-10-31' });
    expect(periodoDe('mes_passado', hoje)).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
  });
  it('7 dias termina hoje', () => expect(periodoDe('7d', hoje)).toEqual({ de: '2026-10-09', ate: '2026-10-15' }));
});

describe('situações (caixas de seleção)', () => {
  it('cada lançamento cai numa das quatro', () => {
    expect(situacaoDe({ tipo: 'receber', status: 'vencido' })).toBe('a_receber');
    expect(situacaoDe({ tipo: 'receber', status: 'liquidado' })).toBe('recebidas');
    expect(situacaoDe({ tipo: 'pagar', status: 'aberto' })).toBe('a_pagar');
    expect(situacaoDe({ tipo: 'pagar', status: 'liquidado' })).toBe('pagas');
  });
  it('lê a lista da rota e ignora valor desconhecido', () => {
    expect(lerSituacoes('/api/app/financeiro?situacao=a_pagar,pagas,xyz&pagina=1')).toEqual(['a_pagar', 'pagas']);
    expect(lerSituacoes('/api/app/financeiro?situacao=&pagina=1')).toEqual([]);
    expect(lerSituacoes('/api/app/financeiro?aba=receber')).toBeNull();
  });
  it('em aberto primeiro por vencimento, depois liquidados do mais recente', () => {
    const x = [
      { id: 'pago-antigo', status: 'liquidado', vencimento: '2026-10-01', pago_em: '2026-10-01' },
      { id: 'vence-depois', status: 'aberto', vencimento: '2026-10-20', pago_em: null },
      { id: 'pago-recente', status: 'liquidado', vencimento: '2026-10-10', pago_em: '2026-10-12' },
      { id: 'vencido', status: 'vencido', vencimento: '2026-10-05', pago_em: null },
    ];
    expect(ordenarLancamentos(x).map((l) => l.id)).toEqual(['vencido', 'vence-depois', 'pago-recente', 'pago-antigo']);
  });
});
