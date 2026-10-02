// Tela 25: quando dá para enviar e como a hora aparece na bolha.
import { describe, expect, it } from 'vitest';
import { horaCurta, podeEnviar } from './Assistente';

describe('podeEnviar (tela 25)', () => {
  it('envia texto com conteúdo, online e sem resposta pendente', () => expect(podeEnviar('Oi', false, true)).toBe(true));
  it('não envia só espaços', () => expect(podeEnviar('   ', false, true)).toBe(false));
  it('não envia enquanto espera a resposta da Jana', () => expect(podeEnviar('Oi', true, true)).toBe(false));
  it('não envia sem internet', () => expect(podeEnviar('Oi', false, false)).toBe(false));
});

describe('horaCurta', () => {
  it('formata HH:MM no fuso do aparelho', () => {
    const d = new Date(2026, 9, 2, 9, 5);
    expect(horaCurta(d.toISOString())).toBe('09:05');
  });
  it('data inválida não mostra hora', () => expect(horaCurta('')).toBe(''));
});
