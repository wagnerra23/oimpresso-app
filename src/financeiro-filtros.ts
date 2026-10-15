// Filtro avançado do Financeiro (tela 06): período por qualquer data do título, texto, forma de pagamento,
// conta, nota fiscal, nosso número e faixa de valor. O filtro vai para o ERP como parâmetros da rota
// GET /api/app/financeiro (a lista é paginada: filtrar só o que já veio esconderia títulos de outras páginas).
// `filtrarLancamentos` é a mesma regra rodando na demo; serve de referência para o lado do ERP.

export type CampoData = 'vencimento' | 'pagamento' | 'emissao' | 'competencia' | 'venda';

export const CAMPOS_DATA: Array<{ id: CampoData; label: string }> = [
  { id: 'vencimento', label: 'Vencimento' }, { id: 'pagamento', label: 'Pagamento' }, { id: 'emissao', label: 'Emissão' },
  { id: 'competencia', label: 'Competência' }, { id: 'venda', label: 'Data da venda' },
];

/** Usada quando o ERP não manda a lista de formas da empresa. */
export const FORMAS_PADRAO = ['Pix', 'Boleto', 'Cartão de crédito', 'Cartão de débito', 'Dinheiro', 'Transferência'];

/** Datas em AAAA-MM-DD; texto vazio = sem filtro. Valores em reais, como o usuário digitou ("1.500,50"). */
export interface FiltrosFinanceiro {
  campo_data: CampoData; de: string; ate: string;
  texto: string; forma: string; conta_id: number | null; nf: string; nosso_numero: string;
  valor_min: string; valor_max: string;
}

export const FILTROS_VAZIOS: FiltrosFinanceiro = {
  campo_data: 'vencimento', de: '', ate: '', texto: '', forma: '', conta_id: null, nf: '', nosso_numero: '', valor_min: '', valor_max: '',
};

/** "1.500,50" → 1500.5; "1.000" → 1000; vazio ou inválido → null. */
export function lerValor(v: string): number | null {
  const t = v.trim().replace(/[R$\s]/g, '');
  if (!t) return null;
  // Vírgula é o decimal; sem vírgula, "1.000" e "12.500" são milhar (como se digita no Brasil) e "99.9" é decimal.
  const milhar = !t.includes(',') && /^\d{1,3}(\.\d{3})+$/.test(t);
  const n = Number(t.includes(',') || milhar ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : null;
}

/** Quantos filtros estão ligados (o período conta como um). */
export function contarFiltros(f: FiltrosFinanceiro): number {
  return [f.de || f.ate, f.texto.trim(), f.forma, f.conta_id !== null, f.nf.trim(), f.nosso_numero.trim(),
    lerValor(f.valor_min) !== null || lerValor(f.valor_max) !== null].filter(Boolean).length;
}

/** Parâmetros da rota, só os ligados. Ex.: "&data_campo=emissao&de=2026-10-01&ate=2026-10-15&forma_pagamento=Pix". */
export function paramsFiltros(f: FiltrosFinanceiro): string {
  const p = new URLSearchParams();
  if (f.de || f.ate) { p.set('data_campo', f.campo_data); if (f.de) p.set('de', f.de); if (f.ate) p.set('ate', f.ate); }
  if (f.texto.trim()) p.set('busca', f.texto.trim());
  if (f.forma) p.set('forma_pagamento', f.forma);
  if (f.conta_id !== null) p.set('conta_id', String(f.conta_id));
  if (f.nf.trim()) p.set('nf', f.nf.trim());
  if (f.nosso_numero.trim()) p.set('nosso_numero', f.nosso_numero.trim());
  const min = lerValor(f.valor_min), max = lerValor(f.valor_max);
  if (min !== null) p.set('valor_min', String(min));
  if (max !== null) p.set('valor_max', String(max));
  const s = p.toString();
  return s ? '&' + s : '';
}

/** Lê de volta os parâmetros da rota (a demo usa; é o espelho de `paramsFiltros`). */
export function lerParams(query: string): FiltrosFinanceiro {
  const p = new URLSearchParams(query.includes('?') ? query.slice(query.indexOf('?') + 1) : query);
  const campo = p.get('data_campo') as CampoData | null;
  const conta = p.get('conta_id');
  return {
    campo_data: campo && CAMPOS_DATA.some((c) => c.id === campo) ? campo : 'vencimento',
    de: p.get('de') ?? '', ate: p.get('ate') ?? '', texto: p.get('busca') ?? '', forma: p.get('forma_pagamento') ?? '',
    conta_id: conta && /^\d+$/.test(conta) ? Number(conta) : null, nf: p.get('nf') ?? '', nosso_numero: p.get('nosso_numero') ?? '',
    valor_min: p.get('valor_min') ?? '', valor_max: p.get('valor_max') ?? '',
  };
}

/** Campos do lançamento que o filtro usa (todos opcionais além dos do contrato §10.1). */
export interface LancamentoFiltravel {
  descricao: string; parte: string | null; vencimento: string | null; pago_em: string | null; valor: number;
  emissao?: string | null; competencia?: string | null; venda_em?: string | null; forma_pagamento?: string | null;
  conta_id?: number | null; nf_numero?: string | null; nosso_numero?: string | null;
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const soDigitos = (s: string) => s.replace(/\D/g, '');

/** Data do lançamento para o campo escolhido. Competência é mês (AAAA-MM): compara pelo mês. */
function dataDo(l: LancamentoFiltravel, campo: CampoData): string | null {
  switch (campo) {
    case 'vencimento': return l.vencimento;
    case 'pagamento': return l.pago_em;
    case 'emissao': return l.emissao ?? null;
    case 'competencia': return l.competencia ?? null;
    case 'venda': return l.venda_em ?? null;
  }
}

export function filtrarLancamentos<T extends LancamentoFiltravel>(itens: T[], f: FiltrosFinanceiro): T[] {
  const texto = semAcento(f.texto.trim());
  const nf = soDigitos(f.nf);
  const nosso = soDigitos(f.nosso_numero);
  const min = lerValor(f.valor_min), max = lerValor(f.valor_max);
  const mes = f.campo_data === 'competencia';
  const de = mes ? f.de.slice(0, 7) : f.de;
  const ate = mes ? f.ate.slice(0, 7) : f.ate;
  return itens.filter((l) => {
    if (de || ate) {
      const d = dataDo(l, f.campo_data)?.slice(0, mes ? 7 : 10);
      if (!d || (de && d < de) || (ate && d > ate)) return false;
    }
    if (texto && !semAcento(`${l.descricao} ${l.parte ?? ''}`).includes(texto)) return false;
    if (f.forma && l.forma_pagamento !== f.forma) return false;
    if (f.conta_id !== null && l.conta_id !== f.conta_id) return false;
    if (nf && !soDigitos(l.nf_numero ?? '').includes(nf)) return false;
    if (nosso && !soDigitos(l.nosso_numero ?? '').includes(nosso)) return false;
    if (min !== null && l.valor < min) return false;
    if (max !== null && l.valor > max) return false;
    return true;
  });
}

/** Caixas de seleção do Financeiro (no lugar das abas, junto com o filtro avançado): em aberto e liquidados,
 *  de cada lado. Vão para a rota como `situacao=a_receber,pagas` (o ERP ainda só conhece `aba`). */
export type Situacao = 'a_receber' | 'a_pagar' | 'recebidas' | 'pagas';
export const SITUACOES: Array<{ id: Situacao; label: string }> = [
  { id: 'a_receber', label: 'A receber' }, { id: 'a_pagar', label: 'A pagar' }, { id: 'recebidas', label: 'Recebidas' }, { id: 'pagas', label: 'Pagas' },
];

export function situacaoDe(l: { tipo: 'receber' | 'pagar'; status: string }): Situacao {
  const liquidado = l.status === 'liquidado';
  return l.tipo === 'receber' ? (liquidado ? 'recebidas' : 'a_receber') : (liquidado ? 'pagas' : 'a_pagar');
}

/** Lê `situacao=` da rota; ignora valores desconhecidos. Sem o parâmetro, null (a rota usa `aba`). */
export function lerSituacoes(query: string): Situacao[] | null {
  const p = new URLSearchParams(query.includes('?') ? query.slice(query.indexOf('?') + 1) : query);
  const v = p.get('situacao');
  if (v === null) return null;
  return SITUACOES.map((s) => s.id).filter((id) => v.split(',').includes(id));
}

/** Em aberto primeiro, pelo vencimento mais próximo; depois os liquidados, do pagamento mais recente. */
export function ordenarLancamentos<T extends { status: string; vencimento: string | null; pago_em: string | null }>(itens: T[]): T[] {
  const abertos = itens.filter((l) => l.status !== 'liquidado').sort((a, b) => (a.vencimento ?? '').localeCompare(b.vencimento ?? ''));
  const pagos = itens.filter((l) => l.status === 'liquidado').sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? ''));
  return [...abertos, ...pagos];
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export type Atalho = 'hoje' | '7d' | '30d' | 'mes' | 'mes_passado';
export const ATALHOS: Array<{ id: Atalho; label: string }> = [
  { id: 'hoje', label: 'Hoje' }, { id: '7d', label: '7 dias' }, { id: '30d', label: '30 dias' },
  { id: 'mes', label: 'Este mês' }, { id: 'mes_passado', label: 'Mês passado' },
];

/** Período de um atalho, no fuso do aparelho. "7 dias" e "30 dias" terminam hoje. */
export function periodoDe(a: Atalho, hoje = new Date()): { de: string; ate: string } {
  const y = hoje.getFullYear(), m = hoje.getMonth(), d = hoje.getDate();
  switch (a) {
    case 'hoje': return { de: iso(hoje), ate: iso(hoje) };
    case '7d': return { de: iso(new Date(y, m, d - 6)), ate: iso(hoje) };
    case '30d': return { de: iso(new Date(y, m, d - 29)), ate: iso(hoje) };
    case 'mes': return { de: iso(new Date(y, m, 1)), ate: iso(new Date(y, m + 1, 0)) };
    case 'mes_passado': return { de: iso(new Date(y, m - 1, 1)), ate: iso(new Date(y, m, 0)) };
  }
}

/** Resumo curto dos filtros ligados, para a linha acima da lista. */
export function resumoFiltros(f: FiltrosFinanceiro, contas: Array<{ id: number; nome: string }>): string[] {
  const br = (s: string) => s.split('-').reverse().join('/');
  const r: string[] = [];
  if (f.de || f.ate) {
    const campo = CAMPOS_DATA.find((c) => c.id === f.campo_data)!.label;
    r.push(`${campo} ${f.de ? br(f.de) : '…'} a ${f.ate ? br(f.ate) : '…'}`);
  }
  if (f.texto.trim()) r.push(`“${f.texto.trim()}”`);
  if (f.forma) r.push(f.forma);
  if (f.conta_id !== null) r.push(contas.find((c) => c.id === f.conta_id)?.nome ?? 'Conta');
  if (f.nf.trim()) r.push(`NF ${f.nf.trim()}`);
  if (f.nosso_numero.trim()) r.push(`Nosso nº ${f.nosso_numero.trim()}`);
  const min = lerValor(f.valor_min), max = lerValor(f.valor_max);
  const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (min !== null || max !== null) r.push(min !== null && max !== null ? `${reais(min)} a ${reais(max)}` : min !== null ? `a partir de ${reais(min)}` : `até ${reais(max!)}`);
  return r;
}
