// Novo lançamento do Financeiro (tela 06, "+ Novo"). Arquivo sem dependência do Capacitor, para o teste rodar em Node.
//
// Mexe em VALOR (regra mestre Tier 0): o valor é digitado pelo usuário e o ERP revalida tudo. O lançamento nasce
// em aberto; baixar (pagar/receber) continua na tela 15. Cada tentativa leva uma Idempotency-Key que só muda quando
// o formulário muda, para um reenvio por falha de rede não criar o lançamento duas vezes.
import { lerValor } from './financeiro-filtros';

export type TipoLancamento = 'receber' | 'pagar';

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
}

/** Corpo do POST /api/app/financeiro/lancamentos (formato proposto ao ERP). */
export interface NovoLancamento {
  tipo: TipoLancamento;
  descricao: string;
  contato_id: number | null;
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
}

export function formVazio(tipo: TipoLancamento, hoje: string): FormLancamento {
  return { tipo, descricao: '', parte: null, valor: '', vencimento: '', emissao: hoje, competencia: hoje.slice(0, 7),
    forma: '', conta_id: null, plano: '', documento: '', nf: '', observacao: '' };
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
const MES = /^\d{4}-\d{2}$/;

/** Erros por campo, em PT-BR. Vazio = pode enviar. */
export function validarLancamento(f: FormLancamento, planos: Array<{ codigo: string }>): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.descricao.trim()) e.descricao = 'Escreva uma descrição.';
  else if (f.descricao.trim().length > 120) e.descricao = 'Use até 120 caracteres.';
  const v = lerValor(f.valor);
  if (f.valor.trim() === '') e.valor = 'Informe o valor.';
  else if (v === null) e.valor = 'Valor inválido. Use números, ex.: 1.250,00.';
  else if (v <= 0) e.valor = 'O valor precisa ser maior que zero.';
  else if (Math.round(v * 100) !== Math.round(v * 1000) / 10) e.valor = 'Use no máximo 2 casas depois da vírgula.';
  if (!DATA.test(f.vencimento)) e.vencimento = 'Escolha a data de vencimento.';
  if (!DATA.test(f.emissao)) e.emissao = 'Escolha a data de emissão.';
  else if (DATA.test(f.vencimento) && f.vencimento < f.emissao) e.vencimento = 'O vencimento não pode ser antes da emissão.';
  if (!MES.test(f.competencia)) e.competencia = 'Escolha o mês de competência.';
  if (!f.plano) e.plano = 'Escolha a conta do plano de contas.';
  else if (planos.length && !planos.some((p) => p.codigo === f.plano)) e.plano = 'Conta não encontrada no plano de contas.';
  else if (planos.length && !contaAnalitica(f.plano, planos)) e.plano = 'Escolha uma conta, não um grupo.';
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
  };
}
