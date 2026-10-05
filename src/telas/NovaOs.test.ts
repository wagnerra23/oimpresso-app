import { describe, expect, it } from 'vitest';
import { kmDigitado, textoOuNulo } from './NovaOs';

describe('Nova OS — campos', () => {
  it('km aceita inteiro com ou sem ponto de milhar', () => {
    expect(kmDigitado('48312')).toBe(48312);
    expect(kmDigitado('48.312')).toBe(48312);
    expect(kmDigitado('1.234.567')).toBe(1234567);
    expect(kmDigitado(' 0 ')).toBe(0);
  });
  it('km vazio é "não informado"', () => {
    expect(kmDigitado('')).toBeNull();
    expect(kmDigitado('   ')).toBeNull();
  });
  it('km com vírgula, letra ou ponto fora do milhar é recusado', () => {
    expect(kmDigitado('48,3')).toBe('invalido');
    expect(kmDigitado('48.31')).toBe('invalido');
    expect(kmDigitado('12km')).toBe('invalido');
    expect(kmDigitado('-5')).toBe('invalido');
  });
  it('texto opcional em branco vira null e perde os espaços das pontas', () => {
    expect(textoOuNulo('  Elevador 1 ')).toBe('Elevador 1');
    expect(textoOuNulo('   ')).toBeNull();
  });
});
