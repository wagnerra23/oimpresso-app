// Contrato novo do pedido tolerando o antigo: normalização, barra de passos, selo de pagamento e a demo nos dois contratos.
import { afterEach, describe, expect, it } from 'vitest';
import { demo } from './demo';
import { corpoAcao, tituloConfirmacao } from './pedido-acao-regras';
import { barraDePassos, ehCancelado, normalizarDetalhe, normalizarLista, normalizarResumo, seloPagamento, tintaEtapa } from './pedido-passos';
import { novaChave } from './venda';

describe('normalização', () => {
  it('JSON do ERP antigo (cliente em texto + cliente_detalhe, etapas sem rótulo) vira o formato da tela', () => {
    const d = normalizarDetalhe({
      id: 7, numero: '0099', cliente: 'Papelaria Sol', resumo: null, valor: 10, prazo: null, atrasado: false, progresso: 0.5,
      etapa: { chave: 'in_production', rotulo: 'Em produção', grupo: 'producao' },
      cliente_detalhe: { id: 3, nome: 'Papelaria Sol', telefone: null },
      itens_venda: [], acoes: [{ chave: 'pausar_producao', rotulo: 'Pausar produção', pode: true }],
      etapas: [{ grupo: 'orcamento', estado: 'feito' }, { grupo: 'producao', estado: 'atual' }, { grupo: 'xpto', estado: '??' }],
      entrega: null,
    });
    expect(d.cliente).toEqual({ id: 3, nome: 'Papelaria Sol', telefone: null });
    expect(d.etapas).toEqual([
      { grupo: 'orcamento', rotulo: 'Orçamento', estado: 'feito' }, { grupo: 'producao', rotulo: 'Produção', estado: 'atual' },
      { grupo: 'xpto', rotulo: 'xpto', estado: 'futuro' }]);
    expect(d.acoes).toEqual([{ chave: 'pausar_producao', rotulo: 'Pausar produção', pode: true, pede_motivo: false }]);
    expect(d.passos).toBeUndefined();
    expect(d.passo_atual).toBeNull();
    expect('pagamento' in d).toBe(false);
  });

  it('etapa null (venda legada) e grupo desconhecido não quebram', () => {
    const r = normalizarResumo({ id: 1, numero: '1', cliente: 'X', etapa: null });
    expect(r.etapa).toEqual({ chave: '', rotulo: 'Sem etapa', grupo: null });
    expect(tintaEtapa(r.etapa)).toBe('var(--text-dim)');
    const g = normalizarResumo({ id: 1, numero: '1', cliente: 'X', etapa: { chave: 'nova', rotulo: 'Nova', grupo: 'outro' } });
    expect(g.etapa.grupo).toBeNull();
    expect(normalizarLista({ itens: null, contadores: null, pagina: 1, tem_mais: false }).itens).toEqual([]);
  });

  it('passos malformados são ignorados; pagamento com situação desconhecida some', () => {
    const d = normalizarDetalhe({ etapa: { chave: 'x', rotulo: 'X', grupo: 'producao' }, passos: [{ rotulo: 'sem chave' }, { chave: 'a' }],
      pagamento: { situacao: 'estornado', valor_aberto: 3 } });
    expect(d.passos).toEqual([{ chave: 'a', rotulo: 'a' }]);
    expect(d.pagamento).toBeNull();
    expect(normalizarDetalhe({ passos: [] }).passos).toBeUndefined();
  });
});

describe('barra de passos', () => {
  const passos = [{ chave: 'a', rotulo: 'A' }, { chave: 'b', rotulo: 'B' }, { chave: 'c', rotulo: 'C' }];
  const etapa = { chave: 'b', rotulo: 'B', grupo: 'producao' as const };
  const etapas = [{ grupo: 'producao', rotulo: 'Produção', estado: 'atual' as const }];

  it('com passos usa passo_atual; sem passos cai nas etapas por grupo', () => {
    expect(barraDePassos({ passos, passo_atual: 'b', etapa, etapas }).map((x) => x.estado)).toEqual(['feito', 'atual', 'futuro']);
    expect(barraDePassos({ passo_atual: 'b', etapa, etapas })).toEqual([{ chave: 'producao', rotulo: 'Produção', estado: 'atual' }]);
  });

  it('passo atual desconhecido: terminal = tudo feito; cancelado ou não terminal = tudo futuro', () => {
    expect(barraDePassos({ passos, passo_atual: 'zz', etapa: { ...etapa, terminal: true }, etapas }).every((x) => x.estado === 'feito')).toBe(true);
    const cancelada = { chave: 'cancelled', rotulo: 'Cancelada', grupo: null, terminal: true, cancelada: true };
    expect(barraDePassos({ passos, passo_atual: null, etapa: cancelada, etapas }).every((x) => x.estado === 'futuro')).toBe(true);
    expect(ehCancelado(cancelada)).toBe(true);
    expect(tintaEtapa(cancelada)).toBe('var(--danger)');
    expect(barraDePassos({ passos, passo_atual: 'zz', etapa, etapas }).every((x) => x.estado === 'futuro')).toBe(true);
  });
});

describe('selo de pagamento', () => {
  it('cada situação tem texto; ausente = sem selo', () => {
    expect(seloPagamento(undefined)).toBeNull();
    expect(seloPagamento({ situacao: 'pago', valor_aberto: 0 })).toEqual({ texto: 'Pago', tom: 'ok' });
    expect(seloPagamento({ situacao: 'parcial', valor_aberto: 980 })?.tom).toBe('warn');
    expect(seloPagamento({ situacao: 'pendente', valor_aberto: 10 })?.texto).toMatch(/^A receber/);
    expect(seloPagamento({ situacao: 'sem_titulo', valor_aberto: 0 })?.tom).toBe('neutro');
  });
});

const detalhe = async (id: number) => normalizarDetalhe(await demo.chamar('GET', `/api/app/pedidos/${id}`));
const lista = async (filtro: string) => normalizarLista(await demo.chamar('GET', `/api/app/pedidos?filtro=${filtro}&pagina=1`));
const mover = async (id: number, corpo: unknown) =>
  normalizarDetalhe(await demo.chamar('POST', `/api/app/pedidos/${id}/acao`, corpo, { 'Idempotency-Key': novaChave() }));

describe('demo no contrato novo e no antigo', () => {
  afterEach(() => demo.definirContratoPedido('novo'));

  it('novo: passos, passo atual, pagamento e filtro "cancelados"', async () => {
    const d = await detalhe(110);
    expect(d.etapa).toMatchObject({ chave: 'invoiced', terminal: false, cancelada: false });
    expect(d.passos?.length).toBeGreaterThan(0);
    expect(barraDePassos(d).find((x) => x.estado === 'atual')?.chave).toBe('invoiced');
    expect(d.pagamento).toEqual({ situacao: 'parcial', valor_aberto: 980 });
    const c = await lista('cancelados');
    expect(c.itens.map((p) => p.etapa.chave)).toEqual(['cancelled']);
    expect(c.contadores.cancelados).toBe(1);
    expect((await detalhe(111)).etapa).toMatchObject({ cancelada: true, terminal: true });
  });

  it('antigo: sem passos nem pagamento; "cancelados" volta os ativos e não tem contador', async () => {
    demo.definirContratoPedido('antigo');
    const d = await detalhe(110);
    expect(d.passos).toBeUndefined();
    expect(d.pagamento).toBeUndefined();
    expect(barraDePassos(d).find((x) => x.estado === 'atual')?.chave).toBe('entrega');
    const c = await lista('cancelados');
    expect(c.contadores.cancelados).toBeUndefined();
    expect(c.itens.map((p) => p.id)).toEqual((await lista('ativos')).itens.map((p) => p.id));
    expect((await detalhe(108)).acoes).toEqual([]);
  });

  it('Faturada oferece a entrega no contrato novo; no antigo, só Paga', async () => {
    expect((await detalhe(110)).entrega).toEqual({ pode: true });
    expect((await detalhe(102)).entrega).toEqual({ pode: true });
    demo.definirContratoPedido('antigo');
    expect((await detalhe(110)).entrega).toBeNull();
  });

  it('pausar e retomar pedem motivo opcional e vão e voltam de Em espera', async () => {
    const antes = await detalhe(103);
    expect(antes.acoes).toEqual([{ chave: 'pausar_producao', rotulo: 'Pausar produção', pode: true, pede_motivo: true }]);
    const pausado = await mover(103, corpoAcao('pausar_producao', 'in_production', ' falta lona '));
    expect(pausado.etapa.chave).toBe('on_hold');
    expect(barraDePassos(pausado).find((x) => x.estado === 'atual')?.chave).toBe('in_production');
    expect(pausado.acoes).toEqual([{ chave: 'retomar_producao', rotulo: 'Retomar produção', pode: true, pede_motivo: true }]);
    expect(tituloConfirmacao(pausado.acoes[0])).toBe('Mover para Em produção?');
    const retomado = await mover(103, corpoAcao('retomar_producao', 'on_hold', null));
    expect(retomado.etapa.chave).toBe('in_production');
  });
});
