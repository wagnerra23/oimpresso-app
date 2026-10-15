// Fila do apontamento sem internet (P8). Regras puras, sem Capacitor, para o teste rodar em Node.
//
// Decisão [W] 2026-10-15, exceção à regra 8 do playbook SÓ para o apontamento: o toque é guardado no celular e enviado
// quando a rede volta, sem duplicar. Todo o resto do app continua travando sem internet.
// - Cada toque vira um item com a sua Idempotency-Key, gerada UMA vez, e o `momento` do toque (ISO com fuso). Toda
//   tentativa reenvia a mesma chave e o mesmo corpo: o ERP devolve a mesma resposta (200) em vez de gravar de novo.
// - Ordem de chegada (FIFO). Um item recusado pelo ERP trava os de trás até o operador ver e descartar: o concluir de
//   um início recusado não tem para onde ir.
// - Item só sai da fila com a confirmação do servidor (2xx) ou quando o operador descarta um recusado.
// - O concluir/corrigir de um início que ainda está na fila aponta para ele (`ref`); o id do ERP entra quando o
//   início é confirmado.
// - Cada item tem dono (o usuário que tocou): outro login no mesmo celular não envia nem vê o que não é dele.
import type { PedidoApontamento } from './api';

export type AcaoFila = 'iniciar' | 'concluir' | 'corrigir';
/** Para onde vai concluir/corrigir: o id do ERP ou o `local` de um iniciar ainda na fila. */
export type AlvoApontamento = { id: number } | { ref: string };

export interface ItemFila {
  /** Id do item no aparelho. */
  local: string;
  dono: string;
  acao: AcaoFila;
  /** Idempotency-Key, gerada uma vez (≤ 64). */
  chave: string;
  /** Hora do toque, ISO 8601 com fuso. */
  momento: string;
  /** iniciar: a etapa (`programacao_id`) e, se a empresa exige QR, o código lido. */
  programacao_id?: number;
  codigo?: string;
  /** concluir/corrigir. */
  alvo?: AlvoApontamento;
  /** corrigir: a hora certa (ISO com fuso) e a justificativa. */
  hora_certa?: string;
  justificativa?: string;
  /** Para mostrar ao operador. */
  pedido: Pick<PedidoApontamento, 'id' | 'numero' | 'resumo' | 'cliente'>;
  etapa: string;
  estado: 'pendente' | 'recusado';
  erro?: string;
  tentativas: number;
}

export interface Fila {
  itens: ItemFila[];
  /** `local` do iniciar → id do ERP, enquanto algum item ainda aponta para ele. */
  ids: Record<string, number>;
}

export const FILA_VAZIA: Fila = { itens: [], ids: {} };

/** ISO 8601 com o fuso do aparelho: 2026-10-15T14:03:00-03:00 (o formato que o ERP aceita no `momento`). */
export function momentoIso(d: Date): string {
  const dois = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const fuso = (off >= 0 ? '+' : '-') + dois(Math.trunc(off / 60)) + ':' + dois(off % 60);
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}${fuso}`;
}

/** O ERP recusa `momento` mais de 5 min à frente do relógio dele. Relógio do aparelho fora disso (para qualquer lado)
 *  trava o toque antes de guardar. `driftSeg` = aparelho − servidor; null = ainda não medido (deixa passar). */
export function relogioErrado(driftSeg: number | null): string | null {
  return driftSeg !== null && Math.abs(driftSeg) > 300 ? 'O relógio do celular está errado. Acerte a hora para apontar.' : null;
}

export const enfileirar = (f: Fila, item: ItemFila): Fila => ({ ...f, itens: [...f.itens, item] });

export type Proximo = { item: ItemFila; apontamentoId: number | null } | null;

/** Próximo item do dono a enviar, na ordem. null = nada a enviar ou a fila está parada num recusado. */
export function proximoEnvio(f: Fila, dono: string): Proximo {
  const item = f.itens.find((i) => i.dono === dono);
  if (!item || item.estado === 'recusado') return null;
  if (item.acao === 'iniciar' || !item.alvo) return { item, apontamentoId: null };
  if ('id' in item.alvo) return { item, apontamentoId: item.alvo.id };
  const id = f.ids[item.alvo.ref];
  return { item, apontamentoId: id ?? null };
}

/** O ERP confirmou (201 ou 200 da repetição): o item sai; o id do início fica para quem aponta para ele. */
export function aposSucesso(f: Fila, local: string, idDoErp?: number): Fila {
  const item = f.itens.find((i) => i.local === local);
  const itens = f.itens.filter((i) => i.local !== local);
  const ids = { ...f.ids };
  if (item?.acao === 'iniciar' && typeof idDoErp === 'number') ids[local] = idDoErp;
  return { itens, ids: limparIds(itens, ids) };
}

/** Falha sem resposta definitiva (rede, 5xx, 429, sessão): fica como está para a próxima tentativa. Recusa do ERP
 *  (4xx): fica parada e visível com a mensagem, até o operador descartar. */
export function aposFalha(f: Fila, local: string, tipo: 'tentar_de_novo' | 'recusado', mensagem: string): Fila {
  return {
    ...f,
    itens: f.itens.map((i) => (i.local !== local ? i
      : tipo === 'recusado' ? { ...i, estado: 'recusado' as const, erro: mensagem, tentativas: i.tentativas + 1 }
        : { ...i, tentativas: i.tentativas + 1 })),
  };
}

/** Só a recusa do ERP (4xx que não é limite de tentativas nem sessão) para a fila. */
export function tipoDaFalha(status: number): 'tentar_de_novo' | 'recusado' {
  return status === 0 || status >= 500 || status === 429 || status === 401 ? 'tentar_de_novo' : 'recusado';
}

/** O operador descarta um item RECUSADO (e o que dependia dele: o concluir/corrigir de um início recusado). */
export function descartar(f: Fila, local: string): Fila {
  const item = f.itens.find((i) => i.local === local);
  if (!item || item.estado !== 'recusado') return f;
  const fora = new Set([local]);
  if (item.acao === 'iniciar') f.itens.forEach((i) => { if (i.alvo && 'ref' in i.alvo && i.alvo.ref === local) fora.add(i.local); });
  const itens = f.itens.filter((i) => !fora.has(i.local));
  return { itens, ids: limparIds(itens, f.ids) };
}

export const pendentesDe = (f: Fila, dono: string): ItemFila[] => f.itens.filter((i) => i.dono === dono);

/** O que o operador vê rodando: o que o ERP disse (`servidor`) + inícios ainda na fila, menos o que já tem
 *  concluir na fila. `chave` identifica o cartão: `id:<n>` (do ERP) ou `local:<x>` (ainda no celular). */
export interface Rodando<T> { chave: string; alvo: AlvoApontamento; servidor: T | null; item: ItemFila | null }
export function rodando<T extends { id: number }>(servidor: T[], f: Fila, dono: string): Array<Rodando<T>> {
  const meus = pendentesDe(f, dono);
  const concluidos = new Set(meus.filter((i) => i.acao === 'concluir' && i.alvo)
    .map((i) => ('id' in i.alvo! ? `id:${i.alvo.id}` : `local:${i.alvo!.ref}`)));
  // Início já confirmado pelo ERP mas com concluir na fila apontando pelo local: o id também conta como concluído.
  for (const [local, id] of Object.entries(f.ids)) if (concluidos.has(`local:${local}`)) concluidos.add(`id:${id}`);
  const lista: Array<Rodando<T>> = servidor.map((s) => ({ chave: `id:${s.id}`, alvo: { id: s.id }, servidor: s, item: null }));
  for (const i of meus) if (i.acao === 'iniciar') lista.push({ chave: `local:${i.local}`, alvo: { ref: i.local }, servidor: null, item: i });
  return lista.filter((r) => !concluidos.has(r.chave));
}

function limparIds(itens: ItemFila[], ids: Record<string, number>): Record<string, number> {
  const usados = new Set(itens.flatMap((i) => (i.alvo && 'ref' in i.alvo ? [i.alvo.ref] : [])));
  return Object.fromEntries(Object.entries(ids).filter(([k]) => usados.has(k)));
}
