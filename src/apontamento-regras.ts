// Apontamento por QR (P8, tela 02): regras puras da tela, sem Capacitor, para o teste rodar em Node.
// Contrato: memory/requisitos/AppMobile/api/tela-02-apontamento.md no ERP (#9447) — grava no PCP (Modules/Producao,
// ADR 0431). A fila sem internet tem as regras dela em apontamento-fila-regras.ts.
//
// O cronômetro é só exibição: o tempo que vale é o que o ERP gravou. A conta parte do `iniciado_em` devolvido e
// desconta o desvio do relógio do aparelho (header Date, `drift()` do api.ts), para um celular adiantado não mostrar
// minutos a mais.

/** QR da etiqueta (EtiquetaProducao::codigo no ERP, PR 07 #9474): `oimpresso:p:<business_hash 12 hex>:<os_tipo>:<id da OS>`,
 *  ex. `oimpresso:p:3f9a0c1b2d4e:comvis_os:501`. O antigo, sem `os_tipo`, ainda vale (= comvis_os). O app manda o texto
 *  lido inteiro; o ERP confere empresa e tipo. */
const QR = /^oimpresso:p:[0-9a-f]{12}:(?:[a-z_]{1,40}:)?[1-9]\d{0,9}$/;

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

/** Justificativa do pedido de correção: 5 a 500 letras (ProducaoController::corrigir). null = válida. */
export function erroJustificativa(texto: string): string | null {
  const n = texto.trim().length;
  if (n < 5) return 'Diga por que o horário está errado (pelo menos 5 letras).';
  if (n > 500) return 'Justificativa longa demais (até 500 letras).';
  return null;
}

/** "HH:MM" digitado + o dia de referência (ISO) → Date local daquele dia, ou null se a hora é inválida. */
export function horaNoDia(hhmm: string, diaIso: string): Date | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  const base = new Date(diaIso);
  if (!m || Number.isNaN(base.getTime())) return null;
  base.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return base;
}

/** Hora local "HH:MM" de um ISO. */
export function horaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const statusDe = (e: unknown) => (e as { status?: number } | null)?.status ?? 0;
const codigoDe = (e: unknown) => (e as { codigo?: string } | null)?.codigo ?? '';

/** Erro da API do apontamento → frase da tela (a mensagem do ERP quando ela é a melhor resposta). */
export function mensagemDoErro(e: unknown): string {
  const st = statusDe(e), cod = codigoDe(e);
  const msg = e instanceof Error && e.message ? e.message : '';
  const campos = (e as { campos?: Record<string, string> } | null)?.campos;
  if (cod === 'rede' && st === 0) return 'Sem conexão. Ler uma etiqueta nova precisa de internet.';
  if (st === 404 || cod === 'nao_encontrado') return 'Etiqueta não encontrada nesta empresa. Confira o código.';
  if (st === 403 || cod === 'sem_permissao') return 'Seu usuário não pode apontar produção.';
  if (cod === 'etapa_alheia') return msg || 'Esta etapa está com outra pessoa. Nada foi apontado.';
  if (cod === 'em_andamento') return 'Você já tem uma etapa aberta. Conclua a anterior antes de iniciar outra.';
  if (cod === 'bloqueado') return msg || 'Esta etapa ou apontamento já foi encerrado.';
  if (cod === 'idempotencia_conflito') return 'Este envio já foi usado com outros dados. Descarte e aponte de novo.';
  if (campos && Object.keys(campos).length) return Object.values(campos)[0];
  if (st === 429) return 'Muitas tentativas seguidas. Espere um minuto.';
  if (st === 0 || st >= 500) return 'Não foi possível falar com o ERP agora.';
  return msg || 'Não foi possível apontar agora.';
}

/** Motivo de pausa do cadastro do posto (ERP, thread 03). */
export interface MotivoPausa { id: number; nome: string }

/** Resposta de GET /api/app/producao/motivos-pausa → motivos do posto, na ordem do ERP, sem repetidos nem inválidos.
 *  Aceita a lista solta ou dentro de `itens`/`motivos`; se vier `posto_id` em cada motivo, fica só o do posto. */
export function motivosDoPosto(resposta: unknown, postoId: number | null): MotivoPausa[] {
  const r = resposta as { itens?: unknown; motivos?: unknown } | null;
  const lista = Array.isArray(resposta) ? resposta : Array.isArray(r?.itens) ? r.itens : Array.isArray(r?.motivos) ? r.motivos : [];
  const vistos = new Set<number>();
  const fora: MotivoPausa[] = [];
  for (const m of lista as Array<Record<string, unknown> | null>) {
    const id = Number(m?.id), nome = typeof m?.nome === 'string' ? m.nome.trim() : '';
    if (!Number.isInteger(id) || id <= 0 || !nome || vistos.has(id)) continue;
    if (m?.ativo === false) continue;
    if (postoId !== null && m?.posto_id != null && Number(m.posto_id) !== postoId) continue;
    vistos.add(id);
    fora.push({ id, nome });
  }
  return fora;
}
