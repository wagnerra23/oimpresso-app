// Política de nova tentativa das chamadas ao ERP. Funções puras: o api.ts decide quando chamar,
// aqui só se decide SE e QUANTO esperar — assim dá para testar sem o HTTP nativo.
//
// Por que existe: o ERP em produção fica alguns segundos em 503 a cada deploy (`artisan down`,
// janela mediana ~78 s, várias por dia) e o LiteSpeed da Hostinger também devolve 502/503/504
// quando falta processo. Antes, a primeira falha virava erro na tela e só sumia reabrindo o app.

/** Status que indicam servidor momentaneamente fora — a mesma requisição pode dar certo daqui a pouco. */
export const STATUS_TRANSITORIOS = [502, 503, 504] as const;

/** Esperas entre as tentativas (ms). 3 novas tentativas, ~17 s no total antes de mostrar o erro. */
export const ESPERAS_MS = [2000, 5000, 10000] as const;

/** Teto para o Retry-After do servidor: o deploy manda 60 s, longo demais para segurar a tela. */
const TETO_RETRY_AFTER_MS = 10000;

export const transitorio = (status: number) => status === 0 || (STATUS_TRANSITORIOS as readonly number[]).includes(status);

/**
 * Só leitura (GET) é repetida. POST/PATCH/PUT/DELETE nunca: podem já ter gravado no servidor
 * (ponto, cadastro, pagamento) e repetir duplicaria. `status` 0 = falha de rede (sem resposta).
 */
export function deveRetentar(metodo: string, status: number, tentativa: number): boolean {
  return metodo === 'GET' && transitorio(status) && tentativa < ESPERAS_MS.length;
}

/** Quanto esperar antes da tentativa `tentativa` (0 = primeira repetição). Respeita Retry-After curto. */
export function esperaMs(tentativa: number, retryAfter?: string | null): number {
  const base = ESPERAS_MS[Math.min(tentativa, ESPERAS_MS.length - 1)];
  const seg = retryAfter != null ? Number(retryAfter) : NaN;
  if (!Number.isFinite(seg) || seg <= 0) return base;
  return Math.min(Math.max(base, seg * 1000), TETO_RETRY_AFTER_MS);
}

/** Mensagem da tela quando as tentativas acabaram e o servidor seguia fora. */
export const MSG_INDISPONIVEL = 'O sistema está sendo atualizado ou fora do ar. Tente de novo em instantes.';
