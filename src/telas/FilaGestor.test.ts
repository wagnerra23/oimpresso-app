// Tela 39: a fila só muda depois que o servidor confirma a decisão (validar ou gravar anulação).
import { describe, expect, it } from 'vitest';
import { aplicarDecisao } from './FilaGestor';
import type { ListaValidacao, MarcacaoAValidar } from '../api';

const m = (id: string, estado: MarcacaoAValidar['estado']): MarcacaoAValidar => ({
  id, colaborador_nome: 'X', tipo: 'ENTRADA', local_texto: null, marcada_em: '2026-10-02T10:00:00Z', nsr: 100,
  gps_precisao_m: null, dispositivo: null, hash_curto: 'abc', estado,
});
const lista = (): ListaValidacao => ({
  itens: [m('u1', 'pendente'), m('u2', 'pendente'), m('u3', 'validada')],
  contadores: { pendente: 2, validada: 1, recusada: 0, todas: 3 }, pode_recusar: true,
});

describe('aplicarDecisao (tela 39)', () => {
  it('validar no filtro "A validar" tira o item da lista e move o contador', () => {
    const d = aplicarDecisao(lista(), 'u1', 'validada', 'pendente');
    expect(d.itens.map((x) => x.id)).toEqual(['u2']);
    expect(d.contadores).toEqual({ pendente: 1, validada: 2, recusada: 0, todas: 3 });
  });
  it('recusar no filtro "Todas" mantém o item com o estado novo', () => {
    const d = aplicarDecisao(lista(), 'u2', 'recusada', 'todas');
    expect(d.itens.find((x) => x.id === 'u2')?.estado).toBe('recusada');
    expect(d.contadores.recusada).toBe(1);
    expect(d.contadores.todas).toBe(3);
    expect(d.pode_recusar).toBe(true);
  });
  it('item já decidido não muda nada', () => {
    const l = lista();
    expect(aplicarDecisao(l, 'u3', 'recusada', 'todas')).toBe(l);
  });
  it('id desconhecido não muda nada', () => {
    const l = lista();
    expect(aplicarDecisao(l, 'zzz', 'validada', 'pendente')).toBe(l);
  });
});
