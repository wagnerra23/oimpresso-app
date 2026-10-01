// Regras do ponto que a tela precisa saber ANTES de enviar. O servidor confere
// tudo de novo (MobileMarcacaoService) — isto só evita mandar o que vai voltar 422.

/** MobileMarcacaoService::GPS_ACCURACY_MAX_METROS e ::TIMESTAMP_DRIFT_MAX_SEG. */
export const LIMITES = { accuracy_max: 500, drift_max: 30 };

export const TIPOS = [
  { id: 'ENTRADA', label: 'Entrada', hint: 'início da jornada' },
  { id: 'ALMOCO_INICIO', label: 'Saída almoço', hint: 'intervalo' },
  { id: 'ALMOCO_FIM', label: 'Retorno almoço', hint: 'volta do intervalo' },
  { id: 'SAIDA', label: 'Saída', hint: 'fim da jornada' },
] as const;

export const rotuloTipo = (id: string) => TIPOS.find((t) => t.id === id)?.label ?? id;

/** IntercorrenciaController::tiposDisponiveis() — os 8 que o StoreIntercorrenciaRequest aceita. */
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
