// Contrato: só leitura é repetida, e só quando o servidor está momentaneamente fora (deploy do ERP
// em `artisan down` devolve 503; LiteSpeed devolve 502/503/504). Escrita nunca repete.
import { describe, expect, it } from 'vitest';
import { deveRetentar, ESPERAS_MS, esperaMs } from './rede';

describe('deveRetentar', () => {
  it('GET em 503 (deploy do ERP) repete', () => expect(deveRetentar('GET', 503, 0)).toBe(true));
  it('GET em 502/504 e sem rede (0) repete', () => {
    expect(deveRetentar('GET', 502, 0)).toBe(true);
    expect(deveRetentar('GET', 504, 1)).toBe(true);
    expect(deveRetentar('GET', 0, 2)).toBe(true);
  });
  it('escrita nunca repete, mesmo em 503', () => {
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) expect(deveRetentar(m, 503, 0)).toBe(false);
  });
  it('erro do pedido (4xx, 500) não repete', () => {
    for (const s of [400, 401, 403, 404, 422, 429, 500]) expect(deveRetentar('GET', s, 0)).toBe(false);
  });
  it('para depois da última espera', () => expect(deveRetentar('GET', 503, ESPERAS_MS.length)).toBe(false));
});

describe('esperaMs', () => {
  it('segue a tabela sem Retry-After', () => {
    expect(esperaMs(0)).toBe(2000);
    expect(esperaMs(2)).toBe(10000);
  });
  it('Retry-After curto vale quando é maior que a espera da tabela', () => expect(esperaMs(0, '4')).toBe(4000));
  it('Retry-After de 60 s do deploy é cortado em 10 s', () => expect(esperaMs(0, '60')).toBe(10000));
  it('Retry-After inválido é ignorado', () => expect(esperaMs(1, 'Wed, 21 Oct 2026 07:28:00 GMT')).toBe(5000));
});
