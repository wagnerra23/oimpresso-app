// Venda rápida (tela 11) — regras do carrinho, sem dependência do Capacitor (o teste roda em Node).
// O total aqui é só PRÉVIA: quem calcula preço, desconto e imposto é o ERP, e a tela de conclusão
// mostra o total que o ERP devolveu. A conta é feita em centavos inteiros para não acumular erro de float,
// e o envio leva preço e quantidade como texto com 2 casas e ponto decimal (nunca float ambíguo).

// Boleto fica fora da v1 (no ERP é venda a prazo, e a emissão de boleto está desligada em produção). Decisão [W].
export type MetodoPagamento = 'pix' | 'credito' | 'debito' | 'dinheiro';

/** Métodos do protótipo (s11), na ordem dele. */
export const METODOS: Array<{ id: MetodoPagamento; rotulo: string; desc: string }> = [
  { id: 'pix', rotulo: 'PIX', desc: 'QR Code instantâneo' },
  { id: 'credito', rotulo: 'Crédito', desc: '1× a 12×' },
  { id: 'debito', rotulo: 'Débito', desc: 'Visa / Master' },
  { id: 'dinheiro', rotulo: 'Dinheiro', desc: 'Sem comprovante' },
];

/** Produto como a busca devolve. `id` é a variação (é ela que tem preço e estoque no ERP). */
export interface ProdutoVenda {
  id: number; nome: string; categoria: string | null;
  /** Preço de venda em reais, já com o que o ERP aplica. */
  preco: number;
  /** Estoque disponível no local da venda; null = o ERP não controla estoque deste produto. */
  estoque: number | null;
}

export interface ItemCarrinho { produto: ProdutoVenda; qtd: number }

/** Reais → centavos inteiros, meio para cima. O `toFixed(6)` tira o resíduo binário antes de arredondar
 *  (1.005 * 100 = 100.49999… em float, mas o preço digitado era 1,005 → 101 centavos). */
export const centavos = (reais: number): number => Math.round(Number((reais * 100).toFixed(6)));

/** Centavos → texto com 2 casas e ponto decimal ("1234.50"), o formato de envio. */
export function texto2(c: number): string {
  const neg = c < 0;
  const a = Math.abs(Math.round(c));
  return (neg ? '-' : '') + Math.floor(a / 100) + '.' + String(a % 100).padStart(2, '0');
}

/** Subtotal do item em centavos. */
export const subtotal = (i: ItemCarrinho): number => centavos(i.produto.preco) * i.qtd;

/** Prévia do total em centavos (soma dos subtotais). */
export const previa = (itens: ItemCarrinho[]): number => itens.reduce((a, i) => a + subtotal(i), 0);

/** Quantidade total de unidades no carrinho. */
export const unidades = (itens: ItemCarrinho[]): number => itens.reduce((a, i) => a + i.qtd, 0);

/** Soma `delta` à quantidade do produto; entra no fim se é novo; sai se chega a 0. Não passa do estoque. */
export function mudarQtd(itens: ItemCarrinho[], produto: ProdutoVenda, delta: number): ItemCarrinho[] {
  const atual = itens.find((i) => i.produto.id === produto.id);
  const nova = (atual?.qtd ?? 0) + delta;
  const teto = produto.estoque === null ? Infinity : Math.max(0, Math.floor(produto.estoque));
  const qtd = Math.min(nova, teto);
  if (!atual) return qtd > 0 ? [...itens, { produto, qtd }] : itens;
  if (qtd <= 0) return itens.filter((i) => i.produto.id !== produto.id);
  return itens.map((i) => (i.produto.id === produto.id ? { ...i, qtd } : i));
}

/** true se o próximo "+" ainda cabe no estoque. */
export const podeSomar = (itens: ItemCarrinho[], produto: ProdutoVenda): boolean => {
  if (produto.estoque === null) return true;
  const atual = itens.find((i) => i.produto.id === produto.id)?.qtd ?? 0;
  return atual + 1 <= produto.estoque;
};

/** Corpo do POST da venda. Preço é o que a tela mostrou (o ERP confere); quantidade e preço com 2 casas. */
export interface CorpoVenda {
  cliente_id: number | null;
  metodo: MetodoPagamento;
  itens: Array<{ variacao_id: number; quantidade: string; preco_unitario: string }>;
  /** Prévia do app, só para o ERP comparar e recusar se divergir. Nunca é o valor gravado. */
  total_previsto: string;
}

export function corpoVenda(itens: ItemCarrinho[], metodo: MetodoPagamento, clienteId: number | null = null): CorpoVenda {
  return {
    cliente_id: clienteId,
    metodo,
    itens: itens.map((i) => ({ variacao_id: i.produto.id, quantidade: texto2(i.qtd * 100), preco_unitario: texto2(centavos(i.produto.preco)) })),
    total_previsto: texto2(previa(itens)),
  };
}

/** Chave de idempotência da tentativa de venda: a mesma em toda repetição do MESMO carrinho. */
export function novaChave(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let k = 0; k < 16; k++) b[k] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Assinatura do carrinho + método: se mudar, a chave antiga não vale mais (é outra venda). */
export const assinatura = (itens: ItemCarrinho[], metodo: MetodoPagamento): string =>
  metodo + '|' + itens.map((i) => `${i.produto.id}x${i.qtd}@${centavos(i.produto.preco)}`).join(',');

/** Erros do 422 por item ("itens.2.quantidade" → produto do 3º item), na ordem em que o corpo foi enviado. */
export function errosPorItem(campos: Record<string, string>, itens: ItemCarrinho[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const [k, v] of Object.entries(campos)) {
    const m = k.match(/^itens\.(\d+)\./);
    const item = m ? itens[Number(m[1])] : undefined;
    if (item && !(item.produto.id in out)) out[item.produto.id] = v;
  }
  return out;
}
