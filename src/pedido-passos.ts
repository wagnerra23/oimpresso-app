// Pedido · contrato novo tolerando o antigo (Wagner, 16/10/2026). Regras puras, sem Capacitor nem React, para o teste de
// unidade rodar em Node. Apps e ERPs em versões diferentes convivem: o ERP novo pode mandar `passos[]`, `passo_atual`,
// `etapa.terminal`, `etapa.cancelada` e `pagamento`; o antigo, não. Tudo que vier fora do esperado (grupo ou passo
// desconhecido, `etapa` null de venda legada, `cliente` como texto no detalhe) vira um valor seguro em vez de quebrar a tela.
import type { EtapaPedido, GrupoEtapa, ListaPedidos, PagamentoPedido, PassoPedido, PedidoDetalheApi, PedidoResumo } from './api';

const GRUPOS: readonly GrupoEtapa[] = ['orcamento', 'aprovacao', 'producao', 'entrega', 'concluido', 'cancelado'];
const ROTULO_GRUPO: Record<GrupoEtapa, string> = {
  orcamento: 'Orçamento', aprovacao: 'Aprovação', producao: 'Produção', entrega: 'Entrega', concluido: 'Concluído', cancelado: 'Cancelado',
};
const TINTA: Record<GrupoEtapa, string> = {
  orcamento: 'var(--text-dim)', aprovacao: 'var(--warn)', producao: 'var(--accent-text)', entrega: 'var(--info)', concluido: 'var(--text-mute)',
  cancelado: 'var(--danger)',
};
const SITUACOES: readonly PagamentoPedido['situacao'][] = ['sem_titulo', 'pendente', 'parcial', 'pago'];

type Bruto = Record<string, unknown>;
const obj = (v: unknown): Bruto => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Bruto) : {});
const txt = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');
const grupoDe = (v: unknown): GrupoEtapa | null => (GRUPOS.includes(v as GrupoEtapa) ? (v as GrupoEtapa) : null);

/** Etapa do pedido; `null` (venda legada sem estágio) ou grupo desconhecido não quebram a tela. */
export function normalizarEtapa(v: unknown): EtapaPedido {
  const e = obj(v);
  const etapa: EtapaPedido = { chave: txt(e.chave), rotulo: txt(e.rotulo) || 'Sem etapa', grupo: grupoDe(e.grupo) };
  if (typeof e.terminal === 'boolean') etapa.terminal = e.terminal;
  if (typeof e.cancelada === 'boolean') etapa.cancelada = e.cancelada;
  return etapa;
}

/** `passos[]` do ERP novo; ausente, vazio ou malformado = `undefined` (a barra cai no comportamento por grupo). */
export function normalizarPassos(v: unknown): PassoPedido[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const passos = v.map(obj).filter((p) => txt(p.chave)).map((p) => ({ chave: txt(p.chave), rotulo: txt(p.rotulo) || txt(p.chave) }));
  return passos.length ? passos : undefined;
}

/** `pagamento` do detalhe; situação desconhecida = sem selo. */
export function normalizarPagamento(v: unknown): PagamentoPedido | null {
  const p = obj(v);
  if (!SITUACOES.includes(p.situacao as PagamentoPedido['situacao'])) return null;
  const aberto = Number(p.valor_aberto);
  return { situacao: p.situacao as PagamentoPedido['situacao'], valor_aberto: Number.isFinite(aberto) ? aberto : 0 };
}

export function normalizarResumo(v: unknown): PedidoResumo {
  const p = obj(v);
  const r = { ...p, etapa: normalizarEtapa(p.etapa), cliente: txt(p.cliente) || txt(obj(p.cliente).nome) } as unknown as PedidoResumo;
  const passos = normalizarPassos(p.passos);
  if (passos) r.passos = passos; else delete r.passos;
  r.passo_atual = txt(p.passo_atual) || null;
  return r;
}

export function normalizarLista(v: unknown): ListaPedidos {
  const l = obj(v);
  return { ...(l as unknown as ListaPedidos), itens: Array.isArray(l.itens) ? l.itens.map(normalizarResumo) : [], contadores: obj(l.contadores) as ListaPedidos['contadores'] };
}

/** Detalhe: além do resumo, `cliente` vira objeto (o ERP manda texto + `cliente_detalhe`), `etapas[]` sem rótulo ou com
 *  grupo desconhecido não quebra, e `acoes`/`itens_venda` ausentes viram listas vazias. */
export function normalizarDetalhe(v: unknown): PedidoDetalheApi {
  const p = obj(v);
  const base = normalizarResumo(p);
  const c = typeof p.cliente === 'object' && p.cliente ? obj(p.cliente) : obj(p.cliente_detalhe);
  const cliente = { id: Number(c.id) || 0, nome: txt(c.nome) || txt(p.cliente) || '—', telefone: txt(c.telefone) || null };
  const etapas = (Array.isArray(p.etapas) ? p.etapas : []).map(obj).filter((e) => txt(e.grupo)).map((e) => {
    const g = grupoDe(e.grupo);
    const estado = e.estado === 'feito' || e.estado === 'atual' ? e.estado : 'futuro';
    return { grupo: txt(e.grupo), rotulo: txt(e.rotulo) || (g ? ROTULO_GRUPO[g] : txt(e.grupo)), estado } as PedidoDetalheApi['etapas'][number];
  });
  const acoes = (Array.isArray(p.acoes) ? p.acoes : []).map(obj).filter((a) => txt(a.chave))
    .map((a) => ({ chave: txt(a.chave), rotulo: txt(a.rotulo) || txt(a.chave), pode: a.pode === true, pede_motivo: a.pede_motivo === true }));
  const d = { ...base, cliente, etapas, acoes, itens_venda: Array.isArray(p.itens_venda) ? p.itens_venda : [] } as PedidoDetalheApi;
  if ('pagamento' in p) d.pagamento = normalizarPagamento(p.pagamento);
  return d;
}

/** O pedido foi cancelado (flag do ERP novo ou grupo `cancelado`). */
export const ehCancelado = (e: EtapaPedido) => e.cancelada === true || e.grupo === 'cancelado';

/** Cor da etapa no cartão e no detalhe; grupo desconhecido usa o tom neutro. */
export const tintaEtapa = (e: EtapaPedido) => (ehCancelado(e) ? TINTA.cancelado : e.grupo ? TINTA[e.grupo] : 'var(--text-dim)');

export interface PassoBarra { chave: string; rotulo: string; estado: 'feito' | 'atual' | 'futuro' }

/** Barra de passos do detalhe. Com `passos[]` do ERP novo, usa eles e `passo_atual`; sem, cai nas `etapas[]` por grupo.
 *  Passo atual desconhecido: terminal (não cancelado) = tudo feito; senão, tudo futuro. */
export function barraDePassos(p: Pick<PedidoDetalheApi, 'passos' | 'passo_atual' | 'etapa' | 'etapas'>): PassoBarra[] {
  if (p.passos?.length) {
    const i = p.passo_atual ? p.passos.findIndex((x) => x.chave === p.passo_atual) : -1;
    const tudoFeito = i < 0 && p.etapa.terminal === true && !ehCancelado(p.etapa);
    return p.passos.map((x, j) => ({
      chave: x.chave, rotulo: x.rotulo,
      estado: tudoFeito ? 'feito' : i < 0 ? 'futuro' : j < i ? 'feito' : j === i ? 'atual' : 'futuro',
    }));
  }
  return p.etapas.map((e) => ({ chave: e.grupo, rotulo: e.rotulo, estado: e.estado }));
}

const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Selo do pagamento no detalhe; `null` = sem selo (ERP antigo ou situação desconhecida). */
export function seloPagamento(pg: PagamentoPedido | null | undefined): { texto: string; tom: 'ok' | 'warn' | 'neutro' } | null {
  if (!pg) return null;
  if (pg.situacao === 'pago') return { texto: 'Pago', tom: 'ok' };
  if (pg.situacao === 'parcial') return { texto: `Pago em parte · falta ${reais(pg.valor_aberto)}`, tom: 'warn' };
  if (pg.situacao === 'pendente') return { texto: `A receber · ${reais(pg.valor_aberto)}`, tom: 'warn' };
  return { texto: 'Sem cobrança', tom: 'neutro' };
}
