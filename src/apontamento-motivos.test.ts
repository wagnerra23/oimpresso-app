// Motivos de pausa guardados no celular (P8 · A4): com rede atualiza a lista; sem rede (ou ERP fora) vale a guardada;
// cada usuário e posto tem a sua.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
const guardado: Record<string, string> = {};
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: (o: unknown) => request(o) } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: guardado[key] ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { guardado[key] = value; },
    remove: async ({ key }: { key: string }) => { delete guardado[key]; },
  },
}));

const { motivosDe } = await import('./apontamento-motivos');
const { guardarDono } = await import('./apontamento-dono');
const resp = (status: number, data: unknown = {}) => ({ status, data, headers: {}, url: '' });

beforeEach(async () => {
  request.mockReset();
  for (const k of Object.keys(guardado)) delete guardado[k];
  await guardarDono('Marcos');
});

describe('motivos de pausa no celular', () => {
  it('com rede busca o do posto e guarda; sem rede devolve o guardado sem chamar o ERP', async () => {
    request.mockResolvedValueOnce(resp(200, [{ id: 31, nome: 'Troca de bobina' }]));
    expect(await motivosDe(5, true)).toEqual({ motivos: [{ id: 31, nome: 'Troca de bobina' }], guardadaEm: null });
    expect((request.mock.calls[0][0] as { url: string }).url).toMatch(/\/motivos-pausa\?posto_id=5$/);
    const off = await motivosDe(5, false);
    expect(off.motivos).toEqual([{ id: 31, nome: 'Troca de bobina' }]);
    expect(off.guardadaEm).toEqual(expect.any(String));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ERP fora: vale a guardada; sem guardada para o posto ou para o usuário, erro de rede', async () => {
    request.mockResolvedValueOnce(resp(200, [{ id: 11, nome: 'Setup' }]));
    await motivosDe(3, true);
    // Rota ainda não publicada (404) ou ERP fora: fica a última lista que veio.
    request.mockResolvedValueOnce(resp(404, { erro: 'nao_encontrado' }));
    expect((await motivosDe(3, true)).motivos).toEqual([{ id: 11, nome: 'Setup' }]);
    await expect(motivosDe(4, false)).rejects.toMatchObject({ codigo: 'rede' });
    await guardarDono('ana');
    await expect(motivosDe(3, false)).rejects.toMatchObject({ codigo: 'rede' });
  });

  it('duas buscas ao mesmo tempo (postos diferentes) guardam as duas', async () => {
    request.mockResolvedValueOnce(resp(200, [{ id: 11, nome: 'Setup' }])).mockResolvedValueOnce(resp(200, [{ id: 31, nome: 'Bobina' }]));
    await Promise.all([motivosDe(3, true), motivosDe(5, true)]);
    expect((await motivosDe(3, false)).motivos[0].id).toBe(11);
    expect((await motivosDe(5, false)).motivos[0].id).toBe(31);
  });
});
