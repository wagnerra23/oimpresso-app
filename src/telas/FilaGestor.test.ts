// Tela 39: a fila só muda depois que o servidor confirma a decisão (validar ou gravar anulação).
import { describe, expect, it } from 'vitest';
import { aplicarDecisao } from './FilaGestor';
import type { ListaValidacao, MarcacaoAValidar } from '../api';

const m = (id: number, estado: MarcacaoAValidar['estado']): MarcacaoAValidar => ({
  id, colaborador_nome: 'X', tipo: 'ENTRADA', local_texto: null, marcada_em: '2026-10-02T10:00:00Z', nsr: 100 + id,
  gps_precisao_m: 40, dispositivo: null, hash_curto: 'abc', estado,
});
const lista = (): ListaValidacao => ({
  itens: [m(1, 'pendente'), m(2, 'pendente'), m(3, 'validada')],
  contadores: { pendente: 2, validada: 1, recusada: 0, todas: 3 },
});

describe('aplicarDecisao (tela 39)', () => {
  it('validar no filtro "A validar" tira o item da lista e move o contador', () => {
    const d = aplicarDecisao(lista(), 1, 'validada', 'pendente');
    expect(d.itens.map((x) => x.id)).toEqual([2]);
    expect(d.contadores).toEqual({ pendente: 1, validada: 2, recusada: 0, todas: 3 });
  });
  it('recusar no filtro "Todas" mantém o item com o estado novo', () => {
    const d = aplicarDecisao(lista(), 2, 'recusada', 'todas');
    expect(d.itens.find((x) => x.id === 2)?.estado).toBe('recusada');
    expect(d.contadores.recusada).toBe(1);
    expect(d.contadores.todas).toBe(3);
  });
  it('item já decidido não muda nada', () => {
    const l = lista();
    expect(aplicarDecisao(l, 3, 'recusada', 'todas')).toBe(l);
  });
  it('id desconhecido não muda nada', () => {
    const l = lista();
    expect(aplicarDecisao(l, 99, 'validada', 'pendente')).toBe(l);
  });
});
