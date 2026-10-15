import { describe, expect, it } from 'vitest';
import { numeroDoIcone } from './badge-regras';

describe('numeroDoIcone (P7)', () => {
  it('mostra o número de não lidas que veio do ERP', () => {
    expect(numeroDoIcone(3)).toBe(3);
    expect(numeroDoIcone(120)).toBe(120);
  });

  it('zero tira o contador do ícone', () => {
    expect(numeroDoIcone(0)).toBe(0);
  });

  it('número quebrado ou negativo vira um inteiro válido', () => {
    expect(numeroDoIcone(2.7)).toBe(2);
    expect(numeroDoIcone(-1)).toBe(0);
  });

  it('ERP sem o campo (ou valor estranho) não mexe no ícone', () => {
    expect(numeroDoIcone(undefined)).toBeNull();
    expect(numeroDoIcone(null)).toBeNull();
    expect(numeroDoIcone('3')).toBeNull();
    expect(numeroDoIcone(Number.NaN)).toBeNull();
  });
});
