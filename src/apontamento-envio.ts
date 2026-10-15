// Envio do apontamento (P8). Única porta de escrita da tela: trocar por fila sem internet, se o [W] confirmar
// a exceção à regra 8 (ADR 0431, #9447), muda só este arquivo.
//
// Hoje, pelo playbook:
// - sem internet nada sai do aparelho (sem fila) e o tempo que vale é o do servidor (o app não manda hora);
// - cada ação leva uma Idempotency-Key que se repete enquanto a MESMA ação não tiver resposta definitiva
//   (rede, 5xx, 409 da mesma chave em gravação). Assim o toque de novo depois de uma falha não aponta duas vezes.
import { apontamentoApi, ErroApi, type ApontamentoAberto } from './api';
import { motivoBloqueio } from './apontamento-regras';
import { novaChave } from './venda';

const chaves = new Map<string, string>();
const statusDe = (e: unknown) => (e as { status?: number } | null)?.status ?? 0;
const codigoDe = (e: unknown) => (e as { codigo?: string } | null)?.codigo ?? '';

/** Recusa definitiva: a próxima tentativa é outra ação, com chave nova. Não é definitiva a falha sem resposta
 *  (rede, 5xx) nem o 409 em_andamento SEM item — é a mesma chave ainda sendo gravada. O 409 com item é outro
 *  apontamento aberto do operador. */
const definitiva = (e: unknown) => {
  const st = statusDe(e);
  if (st === 409 && codigoDe(e) === 'em_andamento') return apontamentoDoConflito(e) !== null;
  return st >= 400 && st < 500;
};

async function enviar<T>(online: boolean, assinatura: string, fazer: (chave: string) => Promise<T>): Promise<T> {
  const bloqueio = motivoBloqueio(online);
  if (bloqueio) throw new ErroApi(0, 'sem_conexao', bloqueio);
  const chave = chaves.get(assinatura) ?? novaChave();
  chaves.set(assinatura, chave);
  try {
    const r = await fazer(chave);
    chaves.delete(assinatura);
    return r;
  } catch (e) {
    if (definitiva(e)) chaves.delete(assinatura);
    throw e;
  }
}

export const iniciarApontamento = (online: boolean, pedidoId: number, etapa: string, codigoQr: string | null) =>
  enviar(online, `iniciar:${pedidoId}:${etapa}:${codigoQr ?? ''}`, (chave) =>
    apontamentoApi.iniciar({ pedido_id: pedidoId, etapa, ...(codigoQr ? { codigo: codigoQr } : {}) }, chave));

export const finalizarApontamento = (online: boolean, id: number, m2: string | null) =>
  enviar(online, `finalizar:${id}:${m2 ?? ''}`, (chave) => apontamentoApi.finalizar(id, m2 ? { m2_produzido: m2 } : {}, chave));

export const cancelarApontamento = (online: boolean, id: number, motivo: string) =>
  enviar(online, `cancelar:${id}:${motivo.trim()}`, (chave) => apontamentoApi.cancelar(id, motivo.trim(), chave));

/** O apontamento aberto que veio num 409 em_andamento (ErroApi.extra no app, campo solto na demo). */
export function apontamentoDoConflito(e: unknown): ApontamentoAberto | null {
  const x = e as { item?: unknown; extra?: { item?: unknown } } | null;
  const item = (x?.extra?.item ?? x?.item) as ApontamentoAberto | undefined;
  return item && typeof item.id === 'number' ? item : null;
}
