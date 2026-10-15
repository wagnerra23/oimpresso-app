// Envio do apontamento (P8) pelo `chamar` real, com o HTTP nativo simulado: sem internet nada sai do aparelho,
// a Idempotency-Key se repete enquanto a mesma ação não tiver resposta definitiva e muda depois dela.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: (o: unknown) => request(o) } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));

const { apontamentoDoConflito, cancelarApontamento, finalizarApontamento, iniciarApontamento } = await import('./apontamento-envio');

const resp = (status: number, data: unknown = {}) => ({ status, data, headers: {}, url: '' });
const chaveDa = (n: number) => (request.mock.calls[n][0] as { headers: Record<string, string> }).headers['Idempotency-Key'];
const corpoDa = (n: number) => (request.mock.calls[n][0] as { data: unknown }).data;

beforeEach(() => request.mockReset());

describe('envio do apontamento', () => {
  it('sem internet não chama o ERP (regra 8, sem fila)', async () => {
    await expect(iniciarApontamento(false, 4812, 'producao', null)).rejects.toMatchObject({ codigo: 'sem_conexao' });
    await expect(finalizarApontamento(false, 1, null)).rejects.toMatchObject({ codigo: 'sem_conexao' });
    await expect(cancelarApontamento(false, 1, 'Pedido errado')).rejects.toMatchObject({ codigo: 'sem_conexao' });
    expect(request).not.toHaveBeenCalled();
  });

  it('manda pedido e etapa, sem hora do aparelho; o código só quando a empresa exige QR', async () => {
    request.mockResolvedValue(resp(201, { id: 9, iniciado_em: '2026-10-15T12:00:00Z' }));
    await iniciarApontamento(true, 4812, 'producao', null);
    await iniciarApontamento(true, 4812, 'producao', 'oimpresso:p:a1b2c3d4e5f6:4812');
    expect(corpoDa(0)).toEqual({ pedido_id: 4812, etapa: 'producao' });
    expect(corpoDa(1)).toEqual({ pedido_id: 4812, etapa: 'producao', codigo: 'oimpresso:p:a1b2c3d4e5f6:4812' });
    expect(chaveDa(0)).toBeTruthy();
    expect(chaveDa(1)).not.toBe(chaveDa(0));
  });

  it('falha de rede ou 5xx: o toque de novo repete a MESMA chave; depois do sucesso, chave nova', async () => {
    request.mockRejectedValueOnce(new Error('sem rede')).mockResolvedValueOnce(resp(502)).mockResolvedValue(resp(200, { id: 5, minutos: 12 }));
    await expect(finalizarApontamento(true, 5, '4.500')).rejects.toMatchObject({ codigo: 'rede' });
    await expect(finalizarApontamento(true, 5, '4.500')).rejects.toMatchObject({ status: 502 });
    await expect(finalizarApontamento(true, 5, '4.500')).resolves.toEqual({ id: 5, minutos: 12 });
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(chaveDa(2)).toBe(chaveDa(0));
    expect(corpoDa(2)).toEqual({ m2_produzido: '4.500' });
    await finalizarApontamento(true, 5, '4.500');
    expect(chaveDa(3)).not.toBe(chaveDa(0));
  });

  it('409 em_andamento sem item (a mesma chave ainda gravando) mantém a chave', async () => {
    request.mockResolvedValueOnce(resp(409, { erro: 'em_andamento', mensagem: 'Gravando.' })).mockResolvedValue(resp(200, { id: 6, cancelado: true }));
    await expect(cancelarApontamento(true, 6, 'Pedido errado')).rejects.toMatchObject({ status: 409 });
    await cancelarApontamento(true, 6, 'Pedido errado');
    expect(chaveDa(1)).toBe(chaveDa(0));
    expect(corpoDa(1)).toEqual({ motivo: 'Pedido errado' });
  });

  it('409 em_andamento com item: outro apontamento aberto; recusa definitiva troca a chave', async () => {
    const item = { id: 3, pedido: { id: 4815, numero: 'OS-2026-04815', resumo: null, cliente: null }, etapa: { chave: 'producao', rotulo: 'Produção' }, iniciado_em: '2026-10-15T11:00:00Z' };
    request.mockResolvedValueOnce(resp(409, { erro: 'em_andamento', mensagem: 'Já há um.', item }))
      .mockResolvedValueOnce(resp(422, { erro: 'bloqueado', mensagem: 'Encerrada.' }))
      .mockResolvedValue(resp(201, { id: 10, iniciado_em: '2026-10-15T12:00:00Z' }));
    const e = await iniciarApontamento(true, 4812, 'producao', null).catch((x: unknown) => x);
    expect(apontamentoDoConflito(e)).toEqual(item);
    await expect(iniciarApontamento(true, 4812, 'producao', null)).rejects.toMatchObject({ codigo: 'bloqueado' });
    await iniciarApontamento(true, 4812, 'producao', null);
    expect(new Set([chaveDa(0), chaveDa(1), chaveDa(2)]).size).toBe(3);
  });
});
