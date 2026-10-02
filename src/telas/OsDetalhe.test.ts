import { describe, expect, it } from 'vitest';
import { ETIQUETA_ITEM, textoFotos, textoKm } from './OsDetalhe';

describe('tela 03 · Detalhe da OS — textos', () => {
  it('quilometragem com separador de milhar; sem km, nada', () => {
    expect(textoKm(48312)).toBe('48.312 km');
    expect(textoKm(0)).toBe('0 km');
    expect(textoKm(null)).toBeNull();
  });
  it('fotos de entrada: só a contagem, no singular e no plural; nenhuma esconde a linha', () => {
    expect(textoFotos(3)).toBe('3 fotos de entrada — veja no computador');
    expect(textoFotos(1)).toBe('1 foto de entrada — veja no computador');
    expect(textoFotos(0)).toBeNull();
  });
  it('etiqueta curta do item com nome por extenso para o leitor de tela', () => {
    expect(ETIQUETA_ITEM.servico).toEqual(['SRV', 'Serviço']);
    expect(ETIQUETA_ITEM.peca).toEqual(['PÇA', 'Peça']);
  });
});
