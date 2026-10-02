import { describe, expect, it } from 'vitest';
import { quando, textoMovimento } from './Movimentacoes';

describe('Movimentações (tela 29, só leitura) — histórico', () => {
  it('quantidade com sinal e unidade, sem zeros sobrando', () => {
    expect(textoMovimento(50, 'm²')).toBe('+50 m²');
    expect(textoMovimento(-3.6, 'm²')).toBe('−3,6 m²');
    expect(textoMovimento(-1.25, null)).toBe('−1,25');
    expect(textoMovimento(0, 'un')).toBe('0 un');
  });

  it('data curta no fuso do aparelho: hoje, ontem ou dia/mês', () => {
    const agora = new Date(2026, 9, 2, 15, 0);
    expect(quando(new Date(2026, 9, 2, 8, 10).toISOString(), agora)).toBe('hoje 08:10');
    expect(quando(new Date(2026, 9, 1, 23, 50).toISOString(), agora)).toBe('ontem 23:50');
    expect(quando(new Date(2026, 8, 26, 11, 5).toISOString(), agora)).toBe('26/09');
  });
});
