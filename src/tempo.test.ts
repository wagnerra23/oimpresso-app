// Contrato: tela 16 do protótipo v4 — "há 12 min", "há 1 h", "ontem" nas notificações.
// Datas construídas no fuso local, para o teste valer em qualquer máquina e no CI.
import { describe, expect, it } from 'vitest';
import { haQuanto } from './tempo';

const agora = new Date(2026, 9, 2, 15, 0, 0).getTime(); // 02/10/2026 15:00 local
const antes = (min: number) => new Date(agora - min * 60000).toISOString();

describe('haQuanto', () => {
  it('menos de 1 minuto é "agora"', () => expect(haQuanto(antes(0), agora)).toBe('agora'));
  it('minutos', () => expect(haQuanto(antes(12), agora)).toBe('há 12 min'));
  it('horas, até 23 h', () => {
    expect(haQuanto(antes(60), agora)).toBe('há 1 h');
    expect(haQuanto(antes(23 * 60 + 59), agora)).toBe('há 23 h');
  });
  it('24 h ou mais no dia anterior é "ontem"', () => {
    expect(haQuanto(new Date(2026, 9, 1, 9, 0).toISOString(), agora)).toBe('ontem');
  });
  it('mais antigo que ontem vira dd/mm', () => {
    expect(haQuanto(new Date(2026, 8, 28, 9, 0).toISOString(), agora)).toBe('28/09');
  });
  it('data inválida não quebra a tela', () => expect(haQuanto('xx', agora)).toBe(''));
});
