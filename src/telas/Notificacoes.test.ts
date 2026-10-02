import { describe, expect, it } from 'vitest';
import { comLida } from './Notificacoes';
import type { ListaNotificacoes } from '../api';

const lista = (): ListaNotificacoes => ({
  pagina: 1, tem_mais: false, nao_lidas: 2,
  itens: [
    { id: 'a', origem: 'TAR', titulo: 'A', texto: null, lida: false, quando: '2026-10-02T10:00:00Z', destino: { tipo: 'tarefa', id: 'todo:1' } },
    { id: 'b', origem: 'FIN', titulo: 'B', texto: null, lida: false, quando: '2026-10-02T09:00:00Z', destino: { tipo: null, id: null } },
    { id: 'c', origem: 'SIS', titulo: 'C', texto: null, lida: true, quando: '2026-10-01T09:00:00Z', destino: { tipo: null, id: null } },
  ],
});

describe('marcar notificação como lida (tela 16)', () => {
  it('marca a notificação e desconta do contador', () => {
    const d = comLida(lista(), 'b', true);
    expect(d.itens.find((x) => x.id === 'b')?.lida).toBe(true);
    expect(d.nao_lidas).toBe(1);
  });
  it('marcar a que já está lida não muda nada (idempotente)', () => {
    const l = lista();
    expect(comLida(l, 'c', true)).toBe(l);
  });
  it('desfazer (servidor recusou) devolve ao contador', () => {
    const d = comLida(comLida(lista(), 'a', true), 'a', false);
    expect(d.nao_lidas).toBe(2);
    expect(d.itens.find((x) => x.id === 'a')?.lida).toBe(false);
  });
  it('id desconhecido não muda nada', () => {
    const l = lista();
    expect(comLida(l, 'zzz', true)).toBe(l);
  });
});
