// Contrato do apontamento (P8, tela 02) na demo, que imita o ERP #9447: QR com hash da empresa, número digitado,
// um aberto por operador, idempotência e app_apontamento_exige_qr. Não substitui a prova contra o ERP real.
import { afterEach, describe, expect, it } from 'vitest';
import { demo, QR_DEMO } from './demo';
import type { ApontamentoAberto, EtiquetaProducao } from './api';

const etiqueta = (c: string) => demo.chamar<EtiquetaProducao>('GET', '/api/app/producao/etiqueta/' + encodeURIComponent(c));
const emAndamento = () => demo.chamar<{ item: ApontamentoAberto | null }>('GET', '/api/app/producao/apontamentos/em-andamento');
const post = <T,>(caminho: string, corpo: unknown, chave: string | null) =>
  demo.chamar<T>('POST', '/api/app/producao/apontamentos/' + caminho, corpo, chave ? { 'Idempotency-Key': chave } : {});
const iniciar = (corpo: unknown, chave: string) => post<{ id: number; iniciado_em: string }>('iniciar', corpo, chave);

afterEach(async () => {
  demo.definirAjustes();
  const { item } = await emAndamento();
  if (item) await post(`${item.id}/cancelar`, { motivo: 'Limpeza do teste' }, 'limpa-' + item.id);
});

describe('apontamento na demo', () => {
  it('resolve o QR e o número; QR de outra empresa ou OS inexistente → 404', async () => {
    const e = await etiqueta(QR_DEMO);
    expect(e).toMatchObject({ pedido: { id: 4812, numero: 'OS-2026-04812' }, etapa: { chave: 'producao' }, pode_apontar: true });
    expect((await etiqueta('4815')).pedido.id).toBe(4815);
    expect((await etiqueta('os-2026-04815')).pedido.id).toBe(4815);
    await expect(etiqueta('oimpresso:p:ffffffffffff:4812')).rejects.toMatchObject({ status: 404 });
    await expect(etiqueta('9999')).rejects.toMatchObject({ status: 404 });
    expect((await etiqueta('4790')).pode_apontar).toBe(false);
  });

  it('inicia, repete a chave sem abrir outro, recusa o 2º e finaliza', async () => {
    const a = await iniciar({ pedido_id: 4812, etapa: 'producao' }, 'k1');
    expect(await iniciar({ pedido_id: 4812, etapa: 'producao' }, 'k1')).toEqual(a);
    expect((await emAndamento()).item).toMatchObject({ id: a.id, pedido: { id: 4812 }, iniciado_em: a.iniciado_em });
    await expect(iniciar({ pedido_id: 4815, etapa: 'finalizando' }, 'k2')).rejects.toMatchObject({ status: 409, codigo: 'em_andamento', item: { id: a.id } });
    await expect(iniciar({ pedido_id: 4815, etapa: 'producao' }, 'k1')).rejects.toMatchObject({ codigo: 'idempotencia_conflito' });
    const f = await post<{ id: number; minutos: number }>(`${a.id}/finalizar`, { m2_produzido: '4.500' }, 'k3');
    expect(f).toEqual({ id: a.id, minutos: 0 });
    expect((await emAndamento()).item).toBeNull();
    await expect(post(`${a.id}/cancelar`, { motivo: 'Tarde demais' }, 'k4')).rejects.toMatchObject({ codigo: 'bloqueado' });
  });

  it('recusa sem chave, etapa velha, OS encerrada e motivo curto', async () => {
    await expect(post('iniciar', { pedido_id: 4812, etapa: 'producao' }, null)).rejects.toMatchObject({ status: 422 });
    await expect(iniciar({ pedido_id: 4812, etapa: 'arte' }, 'e1')).rejects.toMatchObject({ status: 409, codigo: 'etapa_mudou' });
    await expect(iniciar({ pedido_id: 4790, etapa: 'concluida' }, 'e2')).rejects.toMatchObject({ codigo: 'bloqueado' });
    const a = await iniciar({ pedido_id: 4812, etapa: 'producao' }, 'e3');
    await expect(post(`${a.id}/cancelar`, { motivo: 'erro' }, 'e4')).rejects.toMatchObject({ campos: { motivo: expect.any(String) } });
    await expect(post(`${a.id}/cancelar`, { motivo: 'Pedido errado' }, 'e5')).resolves.toEqual({ id: a.id, cancelado: true });
  });

  it('com app_apontamento_exige_qr: número recusado e iniciar só com o QR do mesmo pedido', async () => {
    demo.definirAjustes({ app_apontamento_exige_qr: true });
    await expect(etiqueta('4812')).rejects.toMatchObject({ status: 422, campos: { codigo: expect.any(String) } });
    await expect(iniciar({ pedido_id: 4812, etapa: 'producao' }, 'q1')).rejects.toMatchObject({ campos: { codigo: expect.any(String) } });
    await expect(iniciar({ pedido_id: 4815, etapa: 'finalizando', codigo: QR_DEMO }, 'q2')).rejects.toMatchObject({ status: 404 });
    await expect(iniciar({ pedido_id: 4812, etapa: 'producao', codigo: QR_DEMO }, 'q3')).resolves.toMatchObject({ iniciado_em: expect.any(String) });
  });
});
