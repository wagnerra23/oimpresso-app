// Tela 30: escolha de até 3 módulos, na ordem do toque.
import { describe, expect, it } from 'vitest';
import { alternar, mesmaOrdem } from './PerfilMenu';

describe('alternar (tela 30)', () => {
  it('põe no fim, na ordem do toque', () => expect(alternar(['tarefas'], 'financeiro')).toEqual({ sel: ['tarefas', 'financeiro'], cheia: false }));
  it('tocar de novo tira', () => expect(alternar(['tarefas', 'financeiro'], 'tarefas')).toEqual({ sel: ['financeiro'], cheia: false }));
  it('com 3 escolhidos, o 4º não entra e avisa', () => {
    const r = alternar(['tarefas', 'pedidos', 'producao'], 'ponto');
    expect(r.cheia).toBe(true);
    expect(r.sel).toEqual(['tarefas', 'pedidos', 'producao']);
  });
  it('com 3 escolhidos ainda dá para tirar', () => expect(alternar(['tarefas', 'pedidos', 'producao'], 'pedidos').sel).toEqual(['tarefas', 'producao']));
});

describe('mesmaOrdem', () => {
  it('a ordem conta', () => expect(mesmaOrdem(['tarefas', 'pedidos'], ['pedidos', 'tarefas'])).toBe(false));
  it('igual é igual', () => expect(mesmaOrdem(['tarefas'], ['tarefas'])).toBe(true));
});
