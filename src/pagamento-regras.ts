// Regras da escrita da tela 15 (links de pagamento). Arquivo sem dependência do Capacitor, para o teste rodar em Node.
//
// Regra mestre (valor): o app NUNCA manda valor ao ERP. Gerar link manda só QUAL documento cobrar (pedido ou
// orçamento), o método preferido e o prazo; o valor sai do documento, no ERP. O valor que a tela mostra antes de
// gerar é o que o próprio ERP devolveu na lista de referências — exibição, não entrada.
import type { MetodoPagamento, StatusPagamento } from './api';

export const PRAZOS = [3, 7, 15] as const;
export type Prazo = (typeof PRAZOS)[number];
export type TipoReferencia = 'pedido' | 'orcamento';

/** Corpo do POST /api/app/pagamentos. Sem campo de valor, por construção. */
export interface NovoLinkPagamento {
  referencia: { tipo: TipoReferencia; id: number };
  metodo: MetodoPagamento;
  vencimento_dias: Prazo;
}

export function corpoNovoLink(ref: { tipo: TipoReferencia; id: number }, metodo: MetodoPagamento, dias: number): NovoLinkPagamento {
  if (!(PRAZOS as readonly number[]).includes(dias)) throw new Error('Prazo fora das opções (3, 7 ou 15 dias).');
  if (!Number.isInteger(ref.id) || ref.id <= 0) throw new Error('Referência inválida.');
  // Monta campo a campo (nunca espalha o objeto da referência, que traz o valor exibido).
  return { referencia: { tipo: ref.tipo, id: ref.id }, metodo, vencimento_dias: dias as Prazo };
}

/** Consultar o provedor e cancelar só fazem sentido com a cobrança em aberto. */
export const emAberto = (s: StatusPagamento) => s === 'pendente' || s === 'vencido';
