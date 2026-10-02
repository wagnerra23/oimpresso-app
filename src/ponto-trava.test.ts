// A trava do botão "Bater ponto" (src/telas/Ponto.tsx usa motivoBloqueio para o disabled).
// Os limites vêm do servidor: MobileMarcacaoService::GPS_ACCURACY_MAX_METROS = 500 e
// ::TIMESTAMP_DRIFT_MAX_SEG = 30. Acima deles o POST /ponto/api/marcar volta 422, então o
// app não deixa enviar. Exatamente no limite ainda vale (o servidor usa ">").
import { beforeEach, describe, expect, it } from 'vitest';
import { aplicarLimites, motivoBloqueio, type Gps } from './ponto-regras';

const ok = (accuracy: number): Gps => ({ estado: 'ok', lat: -28.1, lng: -49.1, accuracy });

describe('trava do botão Bater ponto', () => {
  beforeEach(() => aplicarLimites({ accuracy_max: 500, drift_max: 30 }));

  it('libera com conexão, GPS bom e relógio certo', () => {
    expect(motivoBloqueio(true, ok(20), 0)).toBeNull();
  });

  it('libera quando ainda não se sabe o desvio do relógio', () => {
    expect(motivoBloqueio(true, ok(20), null)).toBeNull();
  });

  it('trava sem conexão, mesmo com GPS e relógio bons', () => {
    expect(motivoBloqueio(false, ok(20), 0)).toMatch(/Sem conexão/);
  });

  it.each([
    [{ estado: 'buscando' } as Gps, /Buscando sua localização/],
    [{ estado: 'negado' } as Gps, /Sem permissão de localização/],
    [{ estado: 'erro' } as Gps, /Não foi possível obter a localização/],
  ])('trava enquanto o GPS não está ok (%o)', (gps, msg) => {
    expect(motivoBloqueio(true, gps, 0)).toMatch(msg);
  });

  it('GPS: 500 m ainda libera, 501 m trava', () => {
    expect(motivoBloqueio(true, ok(500), 0)).toBeNull();
    expect(motivoBloqueio(true, ok(501), 0)).toMatch(/Sinal de GPS fraco/);
  });

  it('relógio: 30 s ainda libera, 31 s trava nos dois sentidos', () => {
    expect(motivoBloqueio(true, ok(20), 30)).toBeNull();
    expect(motivoBloqueio(true, ok(20), -30)).toBeNull();
    expect(motivoBloqueio(true, ok(20), 31)).toMatch(/fora de sincronia \(31 s\)/);
    expect(motivoBloqueio(true, ok(20), -31)).toMatch(/fora de sincronia \(-31 s\)/);
  });

  it('usa o limite que o servidor mandou (aplicarLimites), não o padrão', () => {
    aplicarLimites({ accuracy_max: 100, drift_max: 10 });
    expect(motivoBloqueio(true, ok(101), 0)).toMatch(/Sinal de GPS fraco/);
    expect(motivoBloqueio(true, ok(20), 11)).toMatch(/fora de sincronia/);
  });

  it('a primeira causa vence: sem conexão aparece antes de GPS fraco e relógio errado', () => {
    expect(motivoBloqueio(false, ok(9999), 999)).toMatch(/Sem conexão/);
    expect(motivoBloqueio(true, ok(9999), 999)).toMatch(/Sinal de GPS fraco/);
  });
});
