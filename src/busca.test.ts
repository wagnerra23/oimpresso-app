// Contrato da busca nas listas: nome sem acento, número parcial e placa com ou sem hífen.
import { describe, expect, it } from 'vitest';
import { casaBusca } from './busca';

describe('casaBusca', () => {
  it('texto vazio casa com tudo', () => expect(casaBusca('  ', ['Clínica Vita'])).toBe(true));
  it('nome do cliente sem acento e sem diferença de maiúsculas', () => {
    expect(casaBusca('clinica', ['Clínica Vita'])).toBe(true);
    expect(casaBusca('VITA', ['Clínica Vita'])).toBe(true);
  });
  it('número parcial da OS e do pedido', () => {
    expect(casaBusca('1044', ['OS-01044'])).toBe(true);
    expect(casaBusca('0042', ['0042'])).toBe(true);
  });
  it('placa com ou sem hífen', () => {
    expect(casaBusca('rlv-2e48', ['RLV2E48'])).toBe(true);
    expect(casaBusca('RLV2', ['RLV-2E48'])).toBe(true);
  });
  it('ignora campos nulos e não casa o que não existe', () => {
    expect(casaBusca('padaria', [null, undefined, 'Clínica Vita'])).toBe(false);
  });
});
