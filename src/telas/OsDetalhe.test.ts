import { describe, expect, it } from 'vitest';
import { ETIQUETA_ITEM, textoFotos, textoKm, textoQuantidade, tintaDetalhe } from './OsDetalhe';

describe('tela 03 · Detalhe da OS — textos', () => {
  it('quilometragem com separador de milhar; sem km, nada', () => {
    expect(textoKm(48312)).toBe('48.312 km');
    expect(textoKm(null)).toBeNull();
  });
  it('fotos do laudo: só a contagem, no singular e no plural; nenhuma esconde a linha', () => {
    expect(textoFotos(3)).toBe('3 fotos no laudo — veja no computador');
    expect(textoFotos(1)).toBe('1 foto no laudo — veja no computador');
    expect(textoFotos(0)).toBeNull();
  });
  it('quantidade × valor unitário, sem zeros sobrando', () => {
    expect(textoQuantidade(2, 141)).toMatch(/^2 × R\$\s?141,00$/);
    expect(textoQuantidade(1.5, 80)).toMatch(/^1,5 × R\$\s?80,00$/);
  });
  it('os três tipos de item do ERP têm etiqueta e nome por extenso', () => {
    expect(ETIQUETA_ITEM.peca[1]).toBe('Peça');
    expect(ETIQUETA_ITEM.mao_obra[1]).toBe('Mão de obra');
    expect(ETIQUETA_ITEM.servico_terceiro[1]).toBe('Serviço de terceiro');
  });
  it('cor da etapa: fora do fluxo e terminal neutras, travada vermelha, última verde', () => {
    const e = (indice: number | null, terminal = false) => ({ chave: 'x', rotulo: 'X', indice, total_etapas: 6, terminal });
    expect(tintaDetalhe({ etapa: null, travada: false })).toBe('var(--text-dim)');
    expect(tintaDetalhe({ etapa: e(null, true), travada: false })).toBe('var(--text-dim)');
    expect(tintaDetalhe({ etapa: e(4), travada: true })).toBe('var(--danger)');
    expect(tintaDetalhe({ etapa: e(6), travada: false })).toBe('var(--ok)');
    expect(tintaDetalhe({ etapa: e(5), travada: false })).toBe('var(--accent-text)');
  });
});
