// P4 · orçamento rápido (tela 04, ERP PR 16). Regras puras, sem React nem Capacitor, para o teste rodar em Node.
//
// REGRA MESTRE (valor): o app NUNCA calcula. Área, preço do m² e total são os números que o ERP devolveu em
// POST /api/app/orcamentos/calcular, mostrados como vieram; `total_previsto` é o MESMO total, só reescrito como
// texto "N.NN". Este arquivo só mexe em texto (vírgula → ponto, zeros à esquerda): nenhuma conta, nenhum
// arredondamento. O teste `orcamento-regras.test.ts` varre este arquivo e a tela e falha se aparecer aritmética.
import type { CalculoOrcamento, CorpoCalculoOrcamento } from './api';

/** "3,00" / "3.00" / " 3 " → "3.00" / "3". Até 3 casas, maior que zero (contrato: `"N.NNN"`). Inválido = null. */
export function medidaTexto(digitado: string): string | null {
  const t = digitado.trim().replace(',', '.');
  if (!/^\d{1,4}(\.\d{1,3})?$/.test(t)) return null;
  if (!/[1-9]/.test(t)) return null; // só zeros = zero
  return t.replace(/^0+(?=\d)/, '');
}

/** "2" / "002" → "2". Inteiro, pelo menos 1 (contrato: `"N"`). Inválido = null. */
export function quantidadeTexto(digitado: string): string | null {
  const t = digitado.trim();
  if (!/^\d{1,5}$/.test(t) || !/[1-9]/.test(t)) return null;
  return t.replace(/^0+/, '');
}

export interface Medidas { largura: string; altura: string; quantidade: string }

/** Corpo do /calcular, ou null enquanto falta material ou alguma medida é inválida (nada vai ao ERP). */
export function corpoCalculo(material_id: number | null, m: Medidas): CorpoCalculoOrcamento | null {
  const largura_m = medidaTexto(m.largura), altura_m = medidaTexto(m.altura), quantidade = quantidadeTexto(m.quantidade);
  if (material_id === null || !largura_m || !altura_m || !quantidade) return null;
  return { material_id, largura_m, altura_m, quantidade };
}

/** Assinatura do pedido de cálculo: resposta de um pedido antigo (o usuário já mudou a medida) é descartada. */
export const assinaturaCalculo = (c: CorpoCalculoOrcamento) => [c.material_id, c.largura_m, c.altura_m, c.quantidade].join('|');

/** Erro de cada campo digitado (só o formato; quem decide o valor é o ERP). */
export function errosMedidas(m: Medidas): Partial<Record<keyof Medidas, string>> {
  const e: Partial<Record<keyof Medidas, string>> = {};
  if (m.largura.trim() && !medidaTexto(m.largura)) e.largura = 'Use até 3 casas, maior que zero.';
  if (m.altura.trim() && !medidaTexto(m.altura)) e.altura = 'Use até 3 casas, maior que zero.';
  if (m.quantidade.trim() && !quantidadeTexto(m.quantidade)) e.quantidade = 'Número inteiro, a partir de 1.';
  return e;
}

/**
 * O total que o ERP devolveu (JSON number, 2 casas) reescrito como texto "N.NN" para `total_previsto`.
 * Só completa zeros: 234 → "234.00", 1612.8 → "1612.80". Número com mais de 2 casas, negativo ou em notação
 * científica → null (o app não arredonda: sem texto, o Salvar fica travado).
 */
export function totalPrevisto(total: number): string | null {
  if (typeof total !== 'number' || !Number.isFinite(total)) return null;
  const t = String(total);
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(t);
  if (!m) return null;
  return m[1] + '.' + (m[2] ?? '').padEnd(2, '0');
}

/** Corpo do POST /orcamentos: um item, com o total exatamente como o ERP calculou. */
export function corpoOrcamento(cliente_id: number | null, c: CorpoCalculoOrcamento, calculo: CalculoOrcamento) {
  const total = totalPrevisto(calculo.total);
  if (total === null) return null;
  return { cliente_id, itens: [{ ...c, total_previsto: total }] };
}

/** Assinatura do corpo inteiro: a Idempotency-Key só muda quando o que vai gravar muda. */
export const assinaturaOrcamento = (corpo: NonNullable<ReturnType<typeof corpoOrcamento>>) => JSON.stringify(corpo);

/** O que a caixa de resumo mostra: os números do ERP, só formatados. */
export function resumoCalculo(calculo: CalculoOrcamento) {
  return {
    area: calculo.area_m2.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' m²',
    precoM2: calculo.preco_m2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
    total: calculo.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
  };
}

/** O 422 da dupla prova vem em `itens.0.total_previsto` (chave literal, com os pontos). */
export const totalMudou = (campos: Record<string, string>) => Object.keys(campos).some((k) => /^itens\.\d+\.total_previsto$/.test(k));

/** Erro de campo do ERP → campo da tela (`itens.0.largura_m` → largura). */
export function camposDaTela(campos: Record<string, string>): Partial<Record<keyof Medidas | 'cliente' | 'material', string>> {
  const e: Partial<Record<keyof Medidas | 'cliente' | 'material', string>> = {};
  for (const [k, v] of Object.entries(campos)) {
    const base = k.replace(/^itens\.\d+\./, '');
    if (base === 'largura_m') e.largura = v;
    else if (base === 'altura_m') e.altura = v;
    else if (base === 'quantidade') e.quantidade = v;
    else if (base === 'material_id') e.material = v;
    else if (base === 'cliente_id') e.cliente = v;
  }
  return e;
}
