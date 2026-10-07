// Contrato do `chamar` (o chokepoint, não só a política em rede.ts): leitura em 503 de deploy repete e
// se recupera sozinha; escrita não repete; 503 do próprio ERP (com `erro`) não repete; a mensagem crua
// "Service Unavailable" do Laravel não chega à tela.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.fn();
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: (o: unknown) => request(o) } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));

const { api, houveFalhaDeLeitura } = await import('./api');

const resp = (status: number, data: unknown = {}) => ({ status, data, headers: {}, url: '' });
const deploy503 = () => resp(503, '<html><title>Atualizando o sistema — oimpresso</title></html>');

beforeEach(() => { request.mockReset(); vi.useFakeTimers(); });
afterEach(() => vi.useRealTimers());

describe('chamar — servidor momentaneamente fora', () => {
  it('GET em 503 do deploy repete e entrega quando o servidor volta', async () => {
    request.mockResolvedValueOnce(deploy503()).mockResolvedValueOnce(deploy503()).mockResolvedValueOnce(resp(200, { ok: 1 }));
    const p = api.dashboard();
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: 1 });
    expect(request).toHaveBeenCalledTimes(3);
    expect(houveFalhaDeLeitura()).toBe(false);
  });

  it('GET que segue em 503 desiste com mensagem nossa e marca a falha', async () => {
    request.mockResolvedValue(resp(503, { message: 'Service Unavailable' }));
    const p = api.dashboard();
    const pego = expect(p).rejects.toMatchObject({ status: 503, codigo: 'indisponivel' });
    await vi.runAllTimersAsync();
    await pego;
    await expect(p).rejects.not.toThrow('Service Unavailable');
    expect(request).toHaveBeenCalledTimes(4);
    expect(houveFalhaDeLeitura()).toBe(true);
  });

  it('escrita em 503 não repete (pode já ter gravado)', async () => {
    request.mockResolvedValue(deploy503());
    const p = api.criarPessoa({} as never);
    const pego = expect(p).rejects.toMatchObject({ status: 503 });
    await vi.runAllTimersAsync();
    await pego;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('503 do ERP com `erro` (ex.: sem_configuracao) não repete e mantém a mensagem do ERP', async () => {
    request.mockResolvedValue(resp(503, { erro: 'sem_configuracao', mensagem: 'A oficina não está disponível.' }));
    const p = api.dashboard();
    const pego = expect(p).rejects.toMatchObject({ codigo: 'sem_configuracao', message: 'A oficina não está disponível.' });
    await vi.runAllTimersAsync();
    await pego;
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('sem rede: GET repete e, se voltar, entrega', async () => {
    request.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(resp(200, { ok: 2 }));
    const p = api.dashboard();
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ ok: 2 });
  });
});
