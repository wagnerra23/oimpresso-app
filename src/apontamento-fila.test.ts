// Fila do apontamento de ponta a ponta pelo `chamar` real, com o HTTP nativo e o Preferences simulados: o toque fica
// guardado antes de sair; sem rede nada se perde; o reenvio leva a MESMA chave e o mesmo momento; o concluir de um início
// que estava na fila vai para o id do ERP; recusa para a fila; outro usuário não envia o que não é dele.
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

const fila = await import('./apontamento-fila');
const { guardarDono } = await import('./apontamento-dono');

const resp = (status: number, data: unknown = {}) => ({ status, data, headers: {}, url: '' });
const chamada = (n: number) => request.mock.calls[n][0] as { url: string; data: Record<string, unknown>; headers: Record<string, string> };
const pedido = { id: 4812, numero: 'OS-2026-04812', resumo: null, cliente: null };
const salvo = () => JSON.parse(guardado['oi.apontamento.fila'] ?? '{"itens":[]}') as { itens: Array<{ estado: string; chave: string }> };

beforeEach(async () => {
  request.mockReset();
  for (const k of Object.keys(guardado)) delete guardado[k];
  fila._reiniciarFila();
  await guardarDono('Marcos');
});

describe('fila do apontamento', () => {
  it('sem internet guarda no celular e não chama o ERP', async () => {
    const r = await fila.apontar({ acao: 'iniciar', momento: '2026-10-15T14:03:00-03:00', programacao_id: 77, pedido, etapa: 'Impressão' }, false);
    expect(r).toEqual({ enviados: [], parou: null });
    expect(request).not.toHaveBeenCalled();
    expect(salvo().itens).toHaveLength(1);
  });

  it('rede volta: envia na ordem, com a chave e o momento do toque; o concluir vai para o id do ERP', async () => {
    await fila.apontar({ acao: 'iniciar', momento: '2026-10-15T14:03:00-03:00', programacao_id: 77, pedido, etapa: 'Impressão' }, false);
    const ini = (salvo().itens[0] as unknown as { local: string }).local;
    await fila.apontar({ acao: 'concluir', alvo: { ref: ini }, momento: '2026-10-15T15:10:00-03:00', pedido, etapa: 'Impressão' }, false);
    // 1ª tentativa: sem rede no iniciar → nada sai da fila.
    request.mockRejectedValueOnce(new Error('sem rede'));
    const r1 = await fila.enviarFila();
    expect(r1.parou?.tipo).toBe('tentar_de_novo');
    expect(salvo().itens).toHaveLength(2);
    // 2ª: o ERP grava o início (id 501) e a conclusão.
    request.mockResolvedValueOnce(resp(201, { id: 501, programacao_id: 77, iniciado_em: '2026-10-15T17:03:00+00:00' }))
      .mockResolvedValueOnce(resp(201, { id: 501, encerrado_por: 'fim', origem: 'app', encerrado_em: 'x', minutos: 67 }));
    const r2 = await fila.enviarFila();
    expect(r2.enviados.map((e) => e.item.acao)).toEqual(['iniciar', 'concluir']);
    expect(chamada(1).headers['Idempotency-Key']).toBe(chamada(0).headers['Idempotency-Key']);
    expect(chamada(1).data).toEqual({ programacao_id: 77, momento: '2026-10-15T14:03:00-03:00' });
    expect(chamada(2).url).toMatch(/\/apontamentos\/501\/concluir$/);
    expect(chamada(2).data).toEqual({ momento: '2026-10-15T15:10:00-03:00' });
    expect(salvo().itens).toHaveLength(0);
  });

  it('recusa do ERP para a fila com a mensagem; só sai quando o operador descarta', async () => {
    request.mockResolvedValueOnce(resp(422, { erro: 'validacao', mensagem: 'Confira os campos.', campos: { momento: 'Envio vencido; peça a correção ao gestor' } }));
    const r = await fila.apontar({ acao: 'iniciar', momento: '2026-10-11T08:00:00-03:00', programacao_id: 77, pedido, etapa: 'Impressão' }, true);
    expect(r.parou).toMatchObject({ tipo: 'recusado', mensagem: 'Envio vencido; peça a correção ao gestor' });
    expect(salvo().itens[0].estado).toBe('recusado');
    await fila.enviarFila();
    expect(request).toHaveBeenCalledTimes(1);
    await fila.descartarItem((salvo().itens[0] as unknown as { local: string }).local);
    expect(salvo().itens).toHaveLength(0);
  });

  it('outro usuário no mesmo celular não envia o que não é dele', async () => {
    await fila.apontar({ acao: 'iniciar', momento: '2026-10-15T14:03:00-03:00', programacao_id: 77, pedido, etapa: 'Impressão' }, false);
    await guardarDono('ana');
    await fila.enviarFila();
    expect(request).not.toHaveBeenCalled();
    expect(salvo().itens).toHaveLength(1);
  });

  it('pausa sem internet: guarda o motivo e a etapa; ao voltar vai para o id do ERP com a mesma chave', async () => {
    await fila.apontar({ acao: 'iniciar', momento: '2026-10-15T14:03:00-03:00', programacao_id: 80, pedido, etapa: 'Roland' }, false);
    const ini = (salvo().itens[0] as unknown as { local: string }).local;
    await fila.apontar({ acao: 'pausar', alvo: { ref: ini }, motivo_id: 31, motivo: 'Troca de bobina', momento: '2026-10-15T14:40:00-03:00', pedido, etapa: 'Roland' },
      false, { programacao_id: 80, pedido, etapa: 'Roland', maquina: true });
    expect(JSON.parse(guardado['oi.apontamento.fila']).pausadas).toMatchObject([{ programacao_id: 80, motivo: 'Troca de bobina', dono: 'marcos' }]);
    request.mockResolvedValueOnce(resp(201, { id: 601, programacao_id: 80, iniciado_em: 'x' }))
      .mockResolvedValueOnce(resp(503, {}));
    expect((await fila.enviarFila()).parou?.tipo).toBe('tentar_de_novo');
    request.mockResolvedValueOnce(resp(201, { id: 601, encerrado_por: 'pausa', origem: 'app', encerrado_em: 'x', minutos: 37 }));
    const r = await fila.enviarFila();
    expect(r.enviados.map((e) => e.item.acao)).toEqual(['pausar']);
    expect(chamada(1).url).toMatch(/\/apontamentos\/601\/pausar$/);
    expect(chamada(2).headers['Idempotency-Key']).toBe(chamada(1).headers['Idempotency-Key']);
    expect(chamada(2).data).toEqual({ motivo_id: 31, momento: '2026-10-15T14:40:00-03:00' });
    expect(salvo().itens).toHaveLength(0);
    // Continua pausada até o Retomar (um iniciar na mesma etapa).
    expect(JSON.parse(guardado['oi.apontamento.fila']).pausadas).toHaveLength(1);
    await fila.apontar({ acao: 'iniciar', momento: '2026-10-15T15:00:00-03:00', programacao_id: 80, pedido, etapa: 'Roland' }, false);
    expect(JSON.parse(guardado['oi.apontamento.fila']).pausadas).toEqual([]);
  });
});
