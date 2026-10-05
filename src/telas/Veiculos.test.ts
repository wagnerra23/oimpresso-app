import { describe, expect, it } from 'vitest';
import { dataOs, placaAntiga, textoVeiculo } from './Veiculos';

describe('tela 08 · Veículos — textos', () => {
  it('linha de km, ano e cor pula o que vier vazio', () => {
    expect(textoVeiculo({ km: 312040, ano: '2019/2020', cor: 'Prata' })).toBe('312.040 km · 2019/2020 · Prata');
    expect(textoVeiculo({ km: 72415, ano: null, cor: null })).toBe('72.415 km');
    expect(textoVeiculo({ km: null, ano: null, cor: null })).toBe('');
  });
  it('data curta do histórico de OS', () => {
    expect(dataOs('2026-06-12')).toBe('12/06');
    expect(dataOs('2025-11-18T10:00:00-03:00')).toBe('18/11');
  });
  it('desenho da placa sai do formato: antiga é 3 letras + 4 números', () => {
    expect(placaAntiga('MLK4109')).toBe(true);
    expect(placaAntiga('mlk-4109')).toBe(true);
    expect(placaAntiga('RLV2E48')).toBe(false);
    expect(placaAntiga('XYZ')).toBe(false);
  });
});
