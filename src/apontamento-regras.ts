// Apontamento por QR (P8, tela 02): regras puras da tela, sem Capacitor, para o teste rodar em Node.
// Contrato: memory/requisitos/AppMobile/api/tela-02-apontamento.md no ERP (#9447).
//
// O cronômetro é só exibição: o tempo que vale é o do servidor. A conta parte do `iniciado_em` que o ERP
// gravou e desconta o desvio do relógio do aparelho (header Date, `drift()` do api.ts), para um celular
// adiantado não mostrar minutos a mais.

/** QR da etiqueta: `oimpresso:p:<business_hash 12 hex>:<id da OS>` (EtiquetaProducao::codigo no ERP). */
const QR = /^oimpresso:p:[0-9a-f]{12}:[1-9]\d{0,9}$/;

/** Texto lido pela câmera → código para o ERP, ou null se não é etiqueta de produção do oimpresso. */
export function codigoDoQr(lido: string): string | null {
  const t = lido.trim().toLowerCase();
  return QR.test(t) ? t : null;
}

/** Número digitado: o id da OS (só dígitos) ou o número (`OS-2026-00012`, sem diferença de maiúscula). */
export function numeroDigitado(texto: string): string | null {
  const t = texto.trim().toUpperCase();
  if (/^[1-9]\d{0,9}$/.test(t)) return t;
  if (/^OS-\d{4}-\d{1,8}$/.test(t)) return t;
  return null;
}

/** Segundos desde o início, pelo relógio do servidor. `driftSeg` = aparelho − servidor (null = ainda não medido). */
export function segundosDecorridos(iniciadoEm: string, agoraAparelhoMs: number, driftSeg: number | null): number {
  const inicio = Date.parse(iniciadoEm);
  if (Number.isNaN(inicio)) return 0;
  const agoraServidor = agoraAparelhoMs - (driftSeg ?? 0) * 1000;
  return Math.max(0, Math.floor((agoraServidor - inicio) / 1000));
}

/** 3725 → "01:02:05". Passa de 99 h sem cortar. */
export function relogio(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const dois = (n: number) => String(n).padStart(2, '0');
  return `${dois(Math.floor(s / 3600))}:${dois(Math.floor(s / 60) % 60)}:${dois(s % 60)}`;
}

/** Minutos do servidor → "1 h 05 min" / "12 min" / "menos de 1 min". */
export function duracao(minutos: number): string {
  if (minutos < 1) return 'menos de 1 min';
  const h = Math.floor(minutos / 60), m = Math.round(minutos % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** Motivo do cancelamento: 5 a 500 letras, como a web (ApontamentoController). null = válido. */
export function erroMotivo(motivo: string): string | null {
  const n = motivo.trim().length;
  if (n < 5) return 'Escreva o motivo (pelo menos 5 letras).';
  if (n > 500) return 'Motivo longo demais (até 500 letras).';
  return null;
}

/** m² produzido digitado ("4,5", "4.5", "12") → texto do contrato com ponto e 3 casas ("4.500").
 *  Vazio = não informado (null). Inválido = 'invalido'. */
export function m2Digitado(texto: string): string | null | 'invalido' {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(t)) return 'invalido';
  const [int, dec = ''] = t.split('.');
  return `${Number(int)}.${dec.padEnd(3, '0')}`;
}

/** Trava da escrita (regra 8 do playbook): sem internet nada sai do aparelho, sem fila. null = pode enviar. */
export const motivoBloqueio = (online: boolean): string | null =>
  online ? null : 'Sem conexão. Apontar precisa de internet.';

const statusDe = (e: unknown) => (e as { status?: number } | null)?.status ?? 0;
const codigoDe = (e: unknown) => (e as { codigo?: string } | null)?.codigo ?? '';

/** Erro da API do apontamento → frase da tela (a mensagem do ERP quando ela é a melhor resposta). */
export function mensagemDoErro(e: unknown): string {
  const st = statusDe(e), cod = codigoDe(e);
  const msg = e instanceof Error && e.message ? e.message : '';
  if (cod === 'sem_conexao') return msg;
  if (st === 404 || cod === 'nao_encontrado') return 'Etiqueta não encontrada nesta empresa. Confira o código.';
  if (st === 403 || cod === 'sem_permissao') return 'Seu usuário não pode apontar produção.';
  if (cod === 'etapa_mudou') return 'A etapa deste pedido mudou. Leia a etiqueta de novo.';
  if (cod === 'bloqueado') return msg || 'Este pedido ou apontamento já foi encerrado.';
  if (cod === 'idempotencia_conflito') return 'O envio anterior ainda está valendo. Toque de novo.';
  if (st === 429) return 'Muitas tentativas seguidas. Espere um minuto.';
  if (st === 0 || st >= 500) return 'Não foi possível falar com o ERP. Toque de novo: nada é gravado duas vezes.';
  return msg || 'Não foi possível apontar agora.';
}
