import { describe, expect, it } from 'vitest';
import { dataOs, textoVeiculo } from './Veiculos';

describe('tela 08 · Veículos — textos', () => {
  it('linha de km e cor pula o que vier vazio', () => {
    expect(textoVeiculo({ km: 48312, cor: 'Branco' })).toBe('48.312 km · Branco');
    expect(textoVeiculo({ km: 72415, cor: null })).toBe('72.415 km');
    expect(textoVeiculo({ km: null, cor: 'Prata' })).toBe('Prata');
    expect(textoVeiculo({ km: null, cor: null })).toBe('');
  });
  it('data curta do histórico de OS', () => {
    expect(dataOs('2026-06-12')).toBe('12/06');
    expect(dataOs('2025-11-18T10:00:00-03:00')).toBe('18/11');
  });
});
