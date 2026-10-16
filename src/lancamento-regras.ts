// Novo lançamento do Financeiro (tela 06, "+ Novo"). Arquivo sem dependência do Capacitor, para o teste rodar em Node.
//
// Mexe em VALOR (regra mestre Tier 0): o valor é digitado pelo usuário e o ERP revalida tudo. O lançamento nasce
// em aberto; baixar (pagar/receber) continua na tela 15. Cada tentativa leva uma Idempotency-Key que só muda quando
// o formulário muda, para um reenvio por falha de rede não criar o lançamento duas vezes.
//
// Repetição: único, parcelado (o valor digitado é o TOTAL, dividido em parcelas mensais a partir do vencimento; a
// diferença de centavos vai para a 1ª) ou recorrente (o valor é o de CADA lançamento; o ERP cria o próximo no dia de
// geração escolhido, até a data de término ou até alguém interromper na aba Recorrências).
import { lerValor } from './financeiro-filtros';

export type TipoLancamento = 'receber' | 'pagar';
export type Repeticao = 'unico' | 'parcelado' | 'recorrente';
export type Frequencia = 'mensal' | 'trimestral' | 'semestral' | 'anual';

export const REPETICOES: Array<{ id: Repeticao; label: string }> = [
  { id: 'unico', label: 'Não repete' }, { id: 'parcelado', label: 'Parcelado' }, { id: 'recorrente', label: 'Recorrente' },
];
export const FREQUENCIAS: Array<{ id: Frequencia; label: string; meses: number }> = [
  { id: 'mensal', label: 'Mensal', meses: 1 }, { id: 'trimestral', label: 'Trimestral', meses: 3 },
  { id: 'semestral', label: 'Semestral', meses: 6 }, { id: 'anual', label: 'Anual', meses: 12 },
];
export const MAX_PARCELAS = 60;

/** Como a tela guarda o formulário: tudo texto, como digitado. Datas AAAA-MM-DD; competência AAAA-MM. */
export interface FormLancamento {
  tipo: TipoLancamento;
  descricao: string;
  parte: { id: number; nome: string } | null;
  valor: string;
  vencimento: string;
  emissao: string;
  competencia: string;
  forma: string;
  conta_id: number | null;
  plano: string;
  documento: string;
  nf: string;
  observacao: string;
  repeticao: Repeticao;
  parcelas: string;
  frequencia: Frequencia;
  /** Dia do mês (1 a 28) em que o ERP cria o próximo lançamento da recorrência. */
  dia_geracao: string;
  /** Fim do contrato (AAAA-MM-DD); vazio = até interromper. */
  termino: string;
  /** Nº do contrato (recorrência); também buscável no filtro avançado. */
  contrato: string;
}

/** Corpo do POST /api/app/financeiro/lancamentos (formato proposto ao ERP). */
export interface NovoLancamento {
  tipo: TipoLancamento;
  descricao: string;
  contato_id: number | null;
  /** Único e recorrente: valor de cada lançamento. Parcelado: valor TOTAL (o ERP divide como `dividirParcelas`). */
  valor: number;
  vencimento: string;
  emissao: string;
  competencia: string;
  forma_pagamento: string | null;
  conta_id: number | null;
  plano_codigo: string;
  documento: string | null;
  nf_numero: string | null;
  observacao: string | null;
  /** null = não parcelado. Parcelas mensais a partir de `vencimento`. */
  parcelas: number | null;
  /** null = não recorrente. */
  recorrencia: { frequencia: Frequencia; dia_geracao: number; termino: string | null; contrato: string | null } | null;
}

export function formVazio(tipo: TipoLancamento, hoje: string): FormLancamento {
  return { tipo, descricao: '', parte: null, valor: '', vencimento: '', emissao: hoje, competencia: hoje.slice(0, 7),
    forma: '', conta_id: null, plano: '', documento: '', nf: '', observacao: '',
    repeticao: 'unico', parcelas: '2', frequencia: 'mensal', dia_geracao: '1', termino: '', contrato: '' };
}

/** Só contas sem filhas recebem lançamento: "2.1" é grupo quando existe "2.1.01". */
export function contaAnalitica(codigo: string, planos: Array<{ codigo: string }>): boolean {
  return !planos.some((p) => p.codigo.startsWith(codigo + '.'));
}

/** Plano que serve ao tipo: receita para receber, despesa para pagar. Sem `tipo` no plano, vale todo ele. */
export function planosDoTipo<P extends { codigo: string; tipo?: 'receita' | 'despesa' }>(planos: P[], tipo: TipoLancamento): P[] {
  const quer = tipo === 'receber' ? 'receita' : 'despesa';
  return planos.filter((p) => !p.tipo || p.tipo === quer);
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Centavos inteiros: "10,10" passa, "10,1001" não (o ERP receberia 10.10 sem o usuário saber). */
const duasCasas = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const MES = /^\d{4}-\d{2}$/;
const p2 = (n: number) => String(n).padStart(2, '0');
const ultimoDia = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Soma meses mantendo o dia; dia que não existe no mês cai no último (31/01 + 1 = 28/02). `m` no índice 0. */
export function somarMeses(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12), nm = total % 12;
  return `${ny}-${p2(nm + 1)}-${p2(Math.min(d, ultimoDia(ny, nm)))}`;
}

/** Divide o total em parcelas de centavos inteiros; a diferença vai para a 1ª (100 em 3 = 33,34 + 33,33 + 33,33). */
export function dividirParcelas(total: number, n: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? cents - base * n : 0)) / 100);
}

export function previaParcelas(total: number, vencimento: string, n: number): Array<{ numero: number; vencimento: string; valor: number }> {
  return dividirParcelas(total, n).map((valor, i) => ({ numero: i + 1, vencimento: somarMeses(vencimento, i), valor }));
}

/** Dia em que o ERP cria o lançamento que vence em `vencimento`: o dia de geração no mesmo mês, ou no mês anterior
 *  quando ele cai depois do vencimento (vence dia 10 e gera dia 25 → gera no dia 25 do mês anterior). */
export function dataGeracao(vencimento: string, dia: number): string {
  const [y, m, d] = vencimento.split('-').map(Number);
  if (dia <= d) return `${y}-${p2(m)}-${p2(dia)}`;
  const ant = somarMeses(`${y}-${p2(m)}-01`, -1);
  const [ay, am] = ant.split('-').map(Number);
  return `${ay}-${p2(am)}-${p2(Math.min(dia, ultimoDia(ay, am - 1)))}`;
}

/** Próximo ciclo da recorrência depois do 1º lançamento (que nasce na hora): quando o ERP gera e quando vence.
 *  null quando o término já passou. Geração no próprio dia de hoje ainda conta como próxima. */
export function proximaRecorrencia(inicio: string, frequencia: Frequencia, dia: number, termino: string | null, hoje: string):
  { geracao: string; vencimento: string } | null {
  const meses = FREQUENCIAS.find((f) => f.id === frequencia)!.meses;
  for (let k = 1; k <= 1200; k++) {
    const vencimento = somarMeses(inicio, k * meses);
    if (termino && vencimento > termino) return null;
    const geracao = dataGeracao(vencimento, dia);
    if (geracao >= hoje) return { geracao, vencimento };
  }
  return null;
}

/** Erros por campo, em PT-BR. Vazio = pode enviar. */
export function validarLancamento(f: FormLancamento, planos: Array<{ codigo: string }>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.descricao.trim()) e.descricao = 'Escreva uma descrição.';
  else if (f.descricao.trim().length > 120) e.descricao = 'Use até 120 caracteres.';
  const v = lerValor(f.valor);
  if (f.valor.trim() === '') e.valor = 'Informe o valor.';
  else if (v === null) e.valor = 'Valor inválido. Use números, ex.: 1.250,00.';
  else if (v <= 0) e.valor = 'O valor precisa ser maior que zero.';
  else if (!duasCasas(v)) e.valor = 'Use no máximo 2 casas depois da vírgula.';
  if (!DATA.test(f.vencimento)) e.vencimento = 'Escolha a data de vencimento.';
  if (!DATA.test(f.emissao)) e.emissao = 'Escolha a data de emissão.';
  else if (DATA.test(f.vencimento) && f.vencimento < f.emissao) e.vencimento = 'O vencimento não pode ser antes da emissão.';
  if (!MES.test(f.competencia)) e.competencia = 'Escolha o mês de competência.';
  if (!f.plano) e.plano = 'Escolha a conta do plano de contas.';
  else if (planos.length && !planos.some((p) => p.codigo === f.plano)) e.plano = 'Conta não encontrada no plano de contas.';
  else if (planos.length && !contaAnalitica(f.plano, planos)) e.plano = 'Escolha uma conta, não um grupo.';
  if (f.repeticao === 'parcelado') {
    const n = Number(f.parcelas);
    if (!/^\d+$/.test(f.parcelas.trim()) || n < 2 || n > MAX_PARCELAS) e.parcelas = `Use de 2 a ${MAX_PARCELAS} parcelas.`;
    else if (v !== null && v > 0 && Math.round(v * 100) < n) e.parcelas = 'Cada parcela precisa ter pelo menos R$ 0,01.';
  }
  if (f.repeticao === 'recorrente') {
    const d = Number(f.dia_geracao);
    if (!/^\d+$/.test(f.dia_geracao.trim()) || d < 1 || d > 28) e.dia_geracao = 'Use um dia de 1 a 28 (vale para todos os meses).';
    if (f.termino && !DATA.test(f.termino)) e.termino = 'Data de término inválida.';
    else if (f.termino && DATA.test(f.vencimento) && f.termino < f.vencimento) e.termino = 'O término não pode ser antes do 1º vencimento.';
  }
  if (f.contrato.trim().length > 40) e.contrato = 'Use até 40 caracteres.';
  return e;
}

/** Monta o corpo campo a campo (nunca espalha o formulário). Chame só depois de validar. */
export function corpoLancamento(f: FormLancamento): NovoLancamento {
  const v = lerValor(f.valor);
  if (v === null || v <= 0) throw new Error('Valor inválido.');
  const ou = (s: string) => (s.trim() ? s.trim() : null);
  return {
    tipo: f.tipo, descricao: f.descricao.trim(), contato_id: f.parte?.id ?? null, valor: Math.round(v * 100) / 100,
    vencimento: f.vencimento, emissao: f.emissao, competencia: f.competencia, forma_pagamento: ou(f.forma),
    conta_id: f.conta_id, plano_codigo: f.plano, documento: ou(f.documento), nf_numero: ou(f.nf), observacao: ou(f.observacao),
    parcelas: f.repeticao === 'parcelado' ? Number(f.parcelas) : null,
    recorrencia: f.repeticao === 'recorrente'
      ? { frequencia: f.frequencia, dia_geracao: Number(f.dia_geracao), termino: f.termino || null, contrato: ou(f.contrato) } : null,
  };
}

// ── Detalhe do lançamento: ações por situação, baixa e alteração ──

export type AcaoLancamento = 'baixar' | 'alterar' | 'excluir' | 'estornar' | 'reativar';

/** Em aberto: receber/pagar, alterar e excluir. Liquidado: só retornar a receber/pagar (excluir pede estornar antes).
 *  Excluído: só reativar. */
export function acoesDoLancamento(l: { status: string; excluido?: boolean }): AcaoLancamento[] {
  if (l.excluido) return ['reativar'];
  if (l.status === 'liquidado') return ['estornar'];
  return ['baixar', 'alterar', 'excluir'];
}

export function rotuloAcao(a: AcaoLancamento, tipo: TipoLancamento): string {
  switch (a) {
    case 'baixar': return tipo === 'receber' ? 'Receber' : 'Pagar';
    case 'estornar': return tipo === 'receber' ? 'Retornar a receber' : 'Retornar a pagar';
    case 'reativar': return 'Reativar lançamento';
    case 'alterar': return 'Alterar';
    case 'excluir': return 'Excluir';
  }
}

/** Corpo do POST /api/app/financeiro/lancamentos/{id}/baixar. `valor_pago` é o valor realmente pago e o ERP deve
 *  registrar ESTE valor (não o cheio): menor que o do lançamento = baixa parcial, com o restante num lançamento novo
 *  vencendo em `vencimento_restante`. Maior que o do lançamento é recusado: juros, multa e desconto ficam no computador. */
export interface BaixaLancamento {
  pago_em: string; conta_id: number | null; forma_pagamento: string | null;
  /** Valor pago agora. Menor que o do lançamento = pagamento parcial: o lançamento fica liquidado com este valor e o
   *  ERP cria um novo lançamento em aberto com o restante, vencendo em `vencimento_restante`. */
  valor_pago: number;
  /** Obrigatório no parcial; null no pagamento total. */
  vencimento_restante: string | null;
}

/** Como a tela guarda a baixa: valor como digitado. */
export interface FormBaixa { pago_em: string; conta_id: number | null; forma: string; valor: string; vencimento_restante: string }

export function formBaixa(l: { valor: number; conta_id?: number | null; forma_pagamento?: string | null }, hoje: string): FormBaixa {
  return { pago_em: hoje, conta_id: l.conta_id ?? null, forma: l.forma_pagamento ?? '',
    valor: l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), vencimento_restante: '' };
}

/** Restante em reais quando o valor digitado é menor que o do lançamento; null quando paga tudo ou o valor é inválido. */
export function restanteDaBaixa(valorLancamento: number, digitado: string): number | null {
  const v = lerValor(digitado);
  if (v === null || v <= 0) return null;
  const resto = Math.round(valorLancamento * 100) - Math.round(v * 100);
  return resto > 0 ? resto / 100 : null;
}

export function validarBaixa(f: FormBaixa, valorLancamento: number, hoje: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!DATA.test(f.pago_em)) e.pago_em = 'Escolha a data do pagamento.';
  else if (f.pago_em > hoje) e.pago_em = 'A data do pagamento não pode ser no futuro.';
  const v = lerValor(f.valor);
  if (f.valor.trim() === '') e.valor = 'Informe o valor pago.';
  else if (v === null) e.valor = 'Valor inválido. Use números, ex.: 500,00.';
  else if (v <= 0) e.valor = 'O valor precisa ser maior que zero.';
  else if (!duasCasas(v)) e.valor = 'Use no máximo 2 casas depois da vírgula.';
  else if (Math.round(v * 100) > Math.round(valorLancamento * 100)) e.valor = 'O valor pago não pode passar do valor do lançamento. Juros e multa ficam no computador.';
  if (!e.valor && restanteDaBaixa(valorLancamento, f.valor) !== null) {
    if (!DATA.test(f.vencimento_restante)) e.vencimento_restante = 'Escolha o vencimento do restante.';
    else if (DATA.test(f.pago_em) && f.vencimento_restante < f.pago_em) e.vencimento_restante = 'O restante não pode vencer antes do pagamento.';
  }
  return e;
}

/** Corpo da baixa. Chame só depois de validar. */
export function corpoBaixa(f: FormBaixa, valorLancamento: number): BaixaLancamento {
  const v = lerValor(f.valor);
  if (v === null || v <= 0) throw new Error('Valor inválido.');
  const parcial = restanteDaBaixa(valorLancamento, f.valor) !== null;
  return { pago_em: f.pago_em, conta_id: f.conta_id, forma_pagamento: f.forma || null, valor_pago: Math.round(v * 100) / 100,
    vencimento_restante: parcial ? f.vencimento_restante : null };
}

/** Corpo do PATCH /api/app/financeiro/lancamentos/{id}: os campos do novo lançamento, sem tipo nem repetição. */
export type AlteracaoLancamento = Omit<NovoLancamento, 'tipo' | 'parcelas' | 'recorrencia'> & { contrato: string | null };

export function corpoAlteracao(f: FormLancamento): AlteracaoLancamento {
  const { tipo: _t, parcelas: _p, recorrencia: _r, ...resto } = corpoLancamento({ ...f, repeticao: 'unico' });
  return { ...resto, contrato: f.contrato.trim() ? f.contrato.trim() : null };
}

/** O que muda no Alterar, para o "antes → depois" da confirmação. Valor e datas comparados pelo que vai ao ERP. */
export function mudancasAlteracao(antes: FormLancamento, depois: FormLancamento,
  contas: Array<{ id: number; nome: string }> = [], planos: Array<{ codigo: string; nome: string }> = []): Array<{ campo: string; antes: string; depois: string }> {
  const br = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');
  const reais = (t: string) => { const v = lerValor(t); return v === null ? t || '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  const conta = (id: number | null) => (id === null ? '—' : contas.find((c) => c.id === id)?.nome ?? `#${id}`);
  const plano = (c: string) => (c ? `${c} · ${planos.find((p) => p.codigo === c)?.nome ?? ''}`.trim() : '—');
  const t = (x: string) => x.trim() || '—';
  const campos: Array<[string, string, string]> = [
    ['Descrição', t(antes.descricao), t(depois.descricao)],
    [antes.tipo === 'receber' ? 'Cliente' : 'Fornecedor', antes.parte?.nome ?? '—', depois.parte?.nome ?? '—'],
    ['Valor', reais(antes.valor), reais(depois.valor)],
    ['Vencimento', br(antes.vencimento), br(depois.vencimento)],
    ['Emissão', br(antes.emissao), br(depois.emissao)],
    ['Competência', antes.competencia, depois.competencia],
    ['Plano de contas', plano(antes.plano), plano(depois.plano)],
    ['Forma de pagamento', t(antes.forma), t(depois.forma)],
    ['Conta bancária', conta(antes.conta_id), conta(depois.conta_id)],
    ['Nº do documento', t(antes.documento), t(depois.documento)],
    ['Nº da nota fiscal', t(antes.nf), t(depois.nf)],
    ['Nº do contrato', t(antes.contrato), t(depois.contrato)],
    ['Observação', t(antes.observacao), t(depois.observacao)],
  ];
  return campos.filter(([, a, d]) => a !== d).map(([campo, a, d]) => ({ campo, antes: a, depois: d }));
}

/** Formulário de alteração a partir do lançamento salvo. */
export function formDoLancamento(l: {
  tipo: TipoLancamento; descricao: string; parte_id?: number | null; parte: string | null; valor: number; vencimento: string | null;
  emissao?: string | null; competencia?: string | null; forma_pagamento?: string | null; conta_id?: number | null; plano_codigo?: string | null;
  documento?: string | null; nf_numero?: string | null; observacao?: string | null; contrato?: string | null;
}, hoje: string): FormLancamento {
  const v = l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return { ...formVazio(l.tipo, l.emissao ?? hoje), descricao: l.descricao,
    parte: l.parte_id && l.parte ? { id: l.parte_id, nome: l.parte } : null, valor: v, vencimento: l.vencimento ?? '',
    competencia: l.competencia ?? (l.emissao ?? hoje).slice(0, 7), forma: l.forma_pagamento ?? '', conta_id: l.conta_id ?? null,
    plano: l.plano_codigo ?? '', documento: l.documento ?? '', nf: l.nf_numero ?? '', observacao: l.observacao ?? '', contrato: l.contrato ?? '' };
}
