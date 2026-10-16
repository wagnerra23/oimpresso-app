// Fila do apontamento (P8): única porta de escrita da tela. Decisão [W] 2026-10-15 (exceção à regra 8, só aqui).
// Todo toque (iniciar, pausar, retomar, concluir, corrigir) vira um item guardado no Preferences ANTES de sair do aparelho; depois a
// fila envia na ordem, com a chave e o `momento` do toque. Com internet isso acontece na hora; sem, quando a rede
// volta (o App chama `enviarFila` ao voltar a conexão e ao voltar do segundo plano). Regras em apontamento-fila-regras.ts.
import { useSyncExternalStore } from 'react';
import { Preferences } from '@capacitor/preferences';
import { apontamentoApi, ErroApi } from './api';
import { donoAtual } from './apontamento-dono';
import {
  aposFalha, aposSucesso, descartar, enfileirar, esquecerPausa, FILA_VAZIA, pausar, proximoEnvio, tipoDaFalha, type Fila, type ItemFila,
  type Pausada,
} from './apontamento-fila-regras';
import { mensagemDoErro } from './apontamento-regras';
import { novaChave } from './venda';

const CHAVE = 'oi.apontamento.fila';
let fila: Fila = FILA_VAZIA;
let carregada: Promise<void> | null = null;
let dono = '';
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

function carregar(): Promise<void> {
  carregada ??= (async () => {
    dono = await donoAtual();
    try {
      const v = (await Preferences.get({ key: CHAVE })).value;
      if (v) fila = JSON.parse(v) as Fila;
    } catch { /* fila ilegível: começa vazia */ }
    avisar();
  })();
  return carregada;
}

async function gravar(f: Fila) {
  fila = f;
  avisar();
  await Preferences.set({ key: CHAVE, value: JSON.stringify(f) });
}

/** Itens do usuário logado, na ordem de envio. */
export function useFila(): { itens: ItemFila[]; dono: string; fila: Fila } {
  const f = useSyncExternalStore(assinar, () => fila, () => fila);
  return { itens: f.itens.filter((i) => i.dono === dono), dono, fila: f };
}
function assinar(fn: () => void) {
  ouvintes.add(fn);
  void carregar();
  return () => { ouvintes.delete(fn); };
}

export type NovoItem = Omit<ItemFila, 'local' | 'dono' | 'chave' | 'estado' | 'tentativas'>;

/** Dados da etapa que a pausa guarda para o "Retomar". */
export type DadosPausa = Omit<Pausada, 'dono' | 'por' | 'momento' | 'motivo'>;

/** Guarda o toque (já com a chave gerada) e tenta enviar se houver conexão. Pausar leva os dados da etapa. */
export async function apontar(novo: NovoItem, online: boolean, pausa?: DadosPausa): Promise<ResultadoEnvio> {
  await carregar();
  dono = await donoAtual();
  const item: ItemFila = { ...novo, local: novaChave(), dono, chave: novaChave(), estado: 'pendente', tentativas: 0 };
  await gravar(item.acao === 'pausar' && pausa ? pausar(fila, item, pausa) : enfileirar(fila, item));
  return online ? enviarFila() : { enviados: [], parou: null };
}

/** Tira uma etapa pausada da lista deste celular (não mexe no ERP). */
export async function esquecerPausada(programacao: number): Promise<void> {
  await carregar();
  await gravar(esquecerPausa(fila, dono, programacao));
}

/** Descarta um item que o ERP recusou (e o que dependia dele). */
export async function descartarItem(local: string): Promise<void> {
  await carregar();
  await gravar(descartar(fila, local));
}

export interface ResultadoEnvio {
  /** Itens confirmados pelo ERP nesta rodada, com a resposta. */
  enviados: Array<{ item: ItemFila; resposta: unknown }>;
  /** Onde a fila parou: sem rede/servidor fora (`tentar_de_novo`) ou recusa do ERP (`recusado`). */
  parou: { item: ItemFila; tipo: 'tentar_de_novo' | 'recusado'; mensagem: string } | null;
}

let enviando: Promise<ResultadoEnvio> | null = null;

/** Envia o que for do usuário logado, na ordem, até acabar ou parar. Uma rodada por vez. */
export function enviarFila(): Promise<ResultadoEnvio> {
  enviando ??= rodada().finally(() => { enviando = null; });
  return enviando;
}

async function rodada(): Promise<ResultadoEnvio> {
  await carregar();
  dono = await donoAtual();
  const r: ResultadoEnvio = { enviados: [], parou: null };
  for (let n = 0; n < 50; n++) {
    const p = proximoEnvio(fila, dono);
    if (!p) break;
    const { item, apontamentoId } = p;
    if (item.acao !== 'iniciar' && apontamentoId === null) {
      const mensagem = 'O início deste apontamento não chegou ao ERP.';
      await gravar(aposFalha(fila, item.local, 'recusado', mensagem));
      r.parou = { item, tipo: 'recusado', mensagem };
      break;
    }
    try {
      const resposta = await enviarItem(item, apontamentoId);
      await gravar(aposSucesso(fila, item.local, item.acao === 'iniciar' ? (resposta as { id: number }).id : undefined));
      r.enviados.push({ item, resposta });
    } catch (e) {
      const tipo = tipoDaFalha((e as { status?: number } | null)?.status ?? 0);
      const mensagem = mensagemDoErro(e);
      await gravar(aposFalha(fila, item.local, tipo, mensagem));
      r.parou = { item, tipo, mensagem };
      break;
    }
  }
  return r;
}

function enviarItem(item: ItemFila, apontamentoId: number | null): Promise<unknown> {
  if (item.acao === 'iniciar') {
    if (!item.programacao_id) return Promise.reject(new ErroApi(422, 'validacao', 'Etapa não informada.'));
    return apontamentoApi.iniciar({ programacao_id: item.programacao_id, momento: item.momento, ...(item.codigo ? { codigo: item.codigo } : {}) }, item.chave);
  }
  if (item.acao === 'pausar') {
    if (!item.motivo_id) return Promise.reject(new ErroApi(422, 'validacao', 'Motivo da pausa não informado.'));
    return apontamentoApi.pausar(apontamentoId!, { motivo_id: item.motivo_id, momento: item.momento }, item.chave);
  }
  if (item.acao === 'concluir') return apontamentoApi.concluir(apontamentoId!, { momento: item.momento }, item.chave);
  return apontamentoApi.corrigir(apontamentoId!, { momento: item.hora_certa ?? item.momento, justificativa: item.justificativa ?? '' }, item.chave);
}

/** Só para teste: volta ao estado inicial. */
export function _reiniciarFila() { fila = FILA_VAZIA; carregada = null; dono = ''; enviando = null; }
