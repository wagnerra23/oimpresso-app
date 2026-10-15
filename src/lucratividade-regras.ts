// P6 · tela 13 — regras puras das abas Lucratividade e Comissões (e do cartão do Dashboard). Só apresentação:
// os valores vêm prontos do ERP (#9448) e o app não refaz conta nenhuma — aqui só se escolhe cor, texto e o
// tamanho da barra do equilíbrio.
import type { BaseComissao, Lucratividade } from './api';

/** Cor da margem de um pedido (como no protótipo P6): abaixo de 15% é ruim, abaixo de 25% pede atenção. */
export const tomMargem = (pct: number): 'neg' | 'warn' | '' => (pct < 15 ? 'neg' : pct < 25 ? 'warn' : '');

/** Valor curto para caber em três colunas ("R$ 148,2 mil", "R$ 1,69 mi"). O valor inteiro vai no aria-label. */
export function reaisCurto(v: number): string {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e4) return `${s}R$ ${(a / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Barra do ponto de equilíbrio: quanto da receita já cobre o equilíbrio (0–100) e se passou dele.
 *  null quando o ERP não manda o ponto (sem receita ou margem ≤ 0). */
export function equilibrio(l: Pick<Lucratividade, 'receita' | 'ponto_equilibrio'>): { preenchido: number; acima: boolean } | null {
  if (l.ponto_equilibrio === null || l.ponto_equilibrio <= 0) return null;
  const acima = l.receita >= l.ponto_equilibrio;
  return { acima, preenchido: acima ? 100 : Math.max(0, Math.round((l.receita / l.ponto_equilibrio) * 100)) };
}

/** Rótulo da lista de comissões conforme a base do ERP. */
export const rotuloBase = (b: BaseComissao) => (b === 'payment_received' ? 'Comissões · liberadas quando o cliente paga' : 'Comissões · sobre o valor vendido');

/** Aviso quando o ERP manda `comissoes: null`. O ajuste da empresa explica o porquê ao vendedor. */
export const avisoSemComissoes = (vendedorVePropria: boolean) => (vendedorVePropria
  ? 'Seu usuário não pode ver comissões.'
  : 'A empresa não libera a consulta de comissão no app. Quem tem acesso à lista de comissões continua vendo.');
