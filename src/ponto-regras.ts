// Regras do ponto que a tela precisa saber ANTES de enviar. O servidor confere
// tudo de novo (MobileMarcacaoService) — isto só evita mandar o que vai voltar 422.

/** MobileMarcacaoService::GPS_ACCURACY_MAX_METROS e ::TIMESTAMP_DRIFT_MAX_SEG.
 *  Valores de partida; o GET /ponto/api/me traz os do servidor e sobrescreve (aplicarLimites). */
export const LIMITES = { accuracy_max: 500, drift_max: 30 };
export const aplicarLimites = (l: { accuracy_max: number; drift_max: number }) => {
  LIMITES.accuracy_max = Number(l.accuracy_max) || LIMITES.accuracy_max;
  LIMITES.drift_max = Number(l.drift_max) || LIMITES.drift_max;
};

export const TIPOS = [
  { id: 'ENTRADA', label: 'Entrada', hint: 'início da jornada' },
  { id: 'ALMOCO_INICIO', label: 'Saída almoço', hint: 'intervalo' },
  { id: 'ALMOCO_FIM', label: 'Retorno almoço', hint: 'volta do intervalo' },
  { id: 'SAIDA', label: 'Saída', hint: 'fim da jornada' },
] as const;

export const rotuloTipo = (id: string) => TIPOS.find((t) => t.id === id)?.label ?? id;

/** IntercorrenciaController::tiposDisponiveis() — os 8 que o StoreIntercorrenciaRequest aceita.
 *  Só fallback: a tela usa GET /ponto/api/intercorrencias/tipos quando existe. */
export const MOTIVOS: Array<{ value: string; label: string }> = [
  { value: 'CONSULTA_MEDICA', label: 'Consulta médica' },
  { value: 'ATESTADO_MEDICO', label: 'Atestado médico' },
  { value: 'REUNIAO_EXTERNA', label: 'Reunião externa' },
  { value: 'VISITA_CLIENTE', label: 'Visita a cliente' },
  { value: 'HORA_EXTRA_AUTORIZADA', label: 'Hora extra autorizada' },
  { value: 'ESQUECIMENTO_MARCACAO', label: 'Esquecimento de marcação' },
  { value: 'PROBLEMA_EQUIPAMENTO', label: 'Problema no equipamento' },
  { value: 'OUTRO', label: 'Outro' },
];

export const fmtMin = (min: number) => {
  const s = min < 0 ? '−' : '';
  const a = Math.abs(min);
  return `${s}${Math.floor(a / 60)}h${String(a % 60).padStart(2, '0')}`;
};

/** ISO 8601 com o fuso do aparelho (o servidor compara com o relógio dele). */
export const agoraIsoLocal = () => {
  const d = new Date();
  const off = -d.getTimezoneOffset();
  const p = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const local = new Date(d.getTime() + off * 60000).toISOString().slice(0, 19);
  return `${local}${off >= 0 ? '+' : '-'}${p(off / 60)}:${p(off % 60)}`;
};

export const hojeIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Estado do GPS como a tela de ponto o conhece. */
export type Gps =
  | { estado: 'buscando' }
  | { estado: 'negado' }
  | { estado: 'erro' }
  | { estado: 'ok'; lat: number; lng: number; accuracy: number };

/** Por que o botão "Bater ponto" está travado — ou null quando pode enviar.
 *  A ordem importa: a primeira condição que falha é a mensagem mostrada. */
export function motivoBloqueio(online: boolean, gps: Gps, drift: number | null): string | null {
  if (!online) return 'Sem conexão — a marcação precisa do servidor (NSR e hash vêm de lá).';
  if (gps.estado === 'buscando') return 'Buscando sua localização…';
  if (gps.estado === 'negado') return 'Sem permissão de localização. Libere em Ajustes › Apps › oimpresso › Localização.';
  if (gps.estado === 'erro') return 'Não foi possível obter a localização. Ative o GPS e toque em Atualizar local.';
  if (gps.accuracy > LIMITES.accuracy_max) return 'Sinal de GPS fraco — aproxime-se de área aberta';
  if (drift !== null && Math.abs(drift) > LIMITES.drift_max) return `Relógio do aparelho fora de sincronia (${drift} s) — ative a hora automática.`;
  return null;
}
