// Contrato do app com o servidor do ponto. Cada valor esperado aqui vem do ERP
// (wagnerra23/oimpresso.com, Modules/Ponto), não deste arquivo: se o app divergir,
// o servidor devolve 422 e o colaborador não consegue bater o ponto.
//   - MobileMarcacaoService::GPS_ACCURACY_MAX_METROS = 500.0
//   - MobileMarcacaoService::TIMESTAMP_DRIFT_MAX_SEG  = 30
//   - MobileMarcacaoController (POST /ponto/api/marcar): tipo in:ENTRADA,SAIDA,ALMOCO_INICIO,ALMOCO_FIM
//   - IntercorrenciaController::tiposDisponiveis(): os 8 motivos
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LIMITES,
  MOTIVOS,
  TIPOS,
  agoraIsoLocal,
  aplicarLimites,
  fmtMin,
  hojeIso,
  rotuloTipo,
} from './ponto-regras';

const PADRAO = { accuracy_max: 500, drift_max: 30 };
// Fotografado no import, ANTES de qualquer beforeEach: é o valor que o código traz.
// (Comparar LIMITES depois do beforeEach testaria o próprio PADRAO, não o código.)
const NO_IMPORT = { ...LIMITES };

describe('limites de GPS e relógio', () => {
  beforeEach(() => {
    // LIMITES é estado compartilhado do módulo; cada teste parte do padrão.
    aplicarLimites(PADRAO);
  });

  it('partem dos valores do servidor: GPS 500 m e relógio 30 s', () => {
    expect(NO_IMPORT).toEqual(PADRAO);
  });

  it('o GET /ponto/api/me sobrescreve os dois limites', () => {
    aplicarLimites({ accuracy_max: 250, drift_max: 10 });
    expect(LIMITES).toEqual({ accuracy_max: 250, drift_max: 10 });
  });

  it('aceita número vindo como texto do JSON', () => {
    aplicarLimites({ accuracy_max: '300' as unknown as number, drift_max: '20' as unknown as number });
    expect(LIMITES).toEqual({ accuracy_max: 300, drift_max: 20 });
  });

  it('valor inválido ou zero NÃO desliga a trava: mantém o limite anterior', () => {
    aplicarLimites({ accuracy_max: 0, drift_max: Number.NaN });
    expect(LIMITES).toEqual(PADRAO);
    aplicarLimites({ accuracy_max: undefined as unknown as number, drift_max: null as unknown as number });
    expect(LIMITES).toEqual(PADRAO);
  });
});

describe('tipos de marcação', () => {
  it('são exatamente os 4 que o servidor aceita, na ordem da jornada', () => {
    expect(TIPOS.map((t) => t.id)).toEqual(['ENTRADA', 'ALMOCO_INICIO', 'ALMOCO_FIM', 'SAIDA']);
  });

  it('todo tipo tem rótulo e dica para a tela', () => {
    for (const t of TIPOS) {
      expect(t.label.trim()).not.toBe('');
      expect(t.hint.trim()).not.toBe('');
    }
  });

  it('rotuloTipo traduz o id e devolve o próprio id quando não conhece', () => {
    expect(rotuloTipo('ALMOCO_INICIO')).toBe('Saída almoço');
    expect(rotuloTipo('SAIDA')).toBe('Saída');
    expect(rotuloTipo('DESCONHECIDO')).toBe('DESCONHECIDO');
  });
});

describe('motivos de justificativa', () => {
  it('são os 8 que o StoreIntercorrenciaRequest aceita', () => {
    expect(MOTIVOS.map((m) => m.value).sort()).toEqual(
      [
        'ATESTADO_MEDICO',
        'CONSULTA_MEDICA',
        'ESQUECIMENTO_MARCACAO',
        'HORA_EXTRA_AUTORIZADA',
        'OUTRO',
        'PROBLEMA_EQUIPAMENTO',
        'REUNIAO_EXTERNA',
        'VISITA_CLIENTE',
      ],
    );
  });

  it('nenhum motivo repetido nem sem rótulo', () => {
    expect(new Set(MOTIVOS.map((m) => m.value)).size).toBe(MOTIVOS.length);
    for (const m of MOTIVOS) expect(m.label.trim()).not.toBe('');
  });
});

describe('fmtMin (banco de horas)', () => {
  it('formata horas e minutos com dois dígitos', () => {
    expect(fmtMin(135)).toBe('2h15');
    expect(fmtMin(0)).toBe('0h00');
    expect(fmtMin(5)).toBe('0h05');
  });

  it('saldo negativo leva o sinal de menos tipográfico', () => {
    expect(fmtMin(-75)).toBe('−1h15');
  });
});

describe('datas enviadas ao servidor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('agoraIsoLocal é ISO 8601 com o fuso do aparelho e aponta para o instante atual', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T13:45:30.000Z'));
    const iso = agoraIsoLocal();
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    // O servidor compara com o relógio dele: lido de volta, tem de ser o mesmo instante.
    expect(new Date(iso).getTime()).toBe(new Date('2026-10-02T13:45:30.000Z').getTime());
  });

  it('hojeIso é a data local AAAA-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0));
    expect(hojeIso()).toBe('2026-01-05');
  });
});
