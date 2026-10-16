// Contrato do apontamento (P8, tela 02) na demo, que imita o ERP #9447 (grava no PCP): QR com hash da empresa, etapa =
// programação, etapa alheia, uma etapa de pessoa por operador, máquina rodando junto, `momento` do toque com os limites
// do serviço, idempotência e app_apontamento_exige_qr. Não substitui a prova contra o ERP real.
import { afterEach, describe, expect, it } from 'vitest';
import { demo, QR_DEMO } from './demo';
import type { EmAndamento, EtiquetaProducao } from './api';
import { momentoIso } from './apontamento-fila-regras';

const etiqueta = (c: string) => demo.chamar<EtiquetaProducao>('GET', '/api/app/producao/etiqueta/' + encodeURIComponent(c));
const emAndamento = () => demo.chamar<EmAndamento>('GET', '/api/app/producao/apontamentos/em-andamento');
const post = <T,>(caminho: string, corpo: unknown, chave: string | null) =>
  demo.chamar<T>('POST', '/api/app/producao/apontamentos/' + caminho, corpo, chave ? { 'Idempotency-Key': chave } : {});
const agora = () => momentoIso(new Date());
const iniciar = (corpo: Record<string, unknown>, chave: string) =>
  post<{ id: number; programacao_id: number; iniciado_em: string }>('iniciar', { momento: agora(), ...corpo }, chave);
let k = 0;

afterEach(async () => {
  demo.definirAjustes();
  const r = await emAndamento();
  for (const a of [...(r.pessoa ? [r.pessoa] : []), ...r.maquinas]) await post(`${a.id}/concluir`, {}, `limpa-${++k}`);
});

describe('apontamento na demo', () => {
  it('resolve QR e número com a etapa (posto e responsável); outra empresa → 404; etapa alheia não pode apontar', async () => {
    const e = await etiqueta(QR_DEMO);
    expect(e).toMatchObject({ pedido: { id: 4812, numero: 'OS-2026-04812' }, etapa: { programacao_id: 77, posto: { nome: 'Impressão', tipo: 'pessoa' } }, pode_apontar: true });
    expect((await etiqueta('os-2026-04815')).etapa.responsavel?.nome).toBe('Felipe Andrade');
    expect((await etiqueta('4815')).pode_apontar).toBe(false);
    expect((await etiqueta('4790')).pode_apontar).toBe(false);
    await expect(etiqueta('oimpresso:p:ffffffffffff:4812')).rejects.toMatchObject({ status: 404 });
    // QR antigo (sem os_tipo) ainda vale; outro tipo de OS → 404.
    expect((await etiqueta('oimpresso:p:a1b2c3d4e5f6:4812')).pedido.id).toBe(4812);
    await expect(etiqueta('oimpresso:p:a1b2c3d4e5f6:repair:4812')).rejects.toMatchObject({ status: 404 });
    await expect(etiqueta('9999')).rejects.toMatchObject({ status: 404 });
  });

  it('inicia com o momento do toque, repete a chave sem abrir outro e conclui com os minutos do ERP', async () => {
    const toque = new Date(Date.now() - 30 * 60000);
    const a = await iniciar({ programacao_id: 77, momento: momentoIso(toque) }, 'k1');
    expect(Date.parse(a.iniciado_em)).toBe(Math.floor(toque.getTime() / 1000) * 1000);
    expect(await iniciar({ programacao_id: 77, momento: momentoIso(toque) }, 'k1')).toEqual(a);
    expect((await emAndamento()).pessoa).toMatchObject({ id: a.id, etapa: { programacao_id: 77 } });
    await expect(iniciar({ programacao_id: 80 }, 'k1')).rejects.toMatchObject({ codigo: 'idempotencia_conflito' });
    const f = await post<{ minutos: number; encerrado_por: string }>(`${a.id}/concluir`, { momento: agora() }, 'k2');
    expect(f).toMatchObject({ id: a.id, encerrado_por: 'fim', minutos: 30 });
    await expect(post(`${a.id}/concluir`, { momento: agora() }, 'k3')).rejects.toMatchObject({ codigo: 'bloqueado' });
  });

  it('uma etapa de pessoa por vez; a máquina roda junto', async () => {
    const p = await iniciar({ programacao_id: 77 }, 'p1');
    const m = await iniciar({ programacao_id: 80 }, 'm1');
    const r = await emAndamento();
    expect(r.pessoa?.id).toBe(p.id);
    expect(r.maquinas.map((x) => x.id)).toEqual([m.id]);
    await expect(iniciar({ programacao_id: 79 }, 'p2')).rejects.toMatchObject({ codigo: 'bloqueado' });
  });

  it('recusa etapa alheia, outro em andamento, sem chave e momento fora dos limites', async () => {
    await expect(iniciar({ programacao_id: 78 }, 'r1')).rejects.toMatchObject({ status: 409, codigo: 'etapa_alheia', etapa: { responsavel: { nome: 'Felipe Andrade' } } });
    await expect(post('iniciar', { programacao_id: 77 }, null)).rejects.toMatchObject({ status: 422 });
    await expect(iniciar({ programacao_id: 77, momento: momentoIso(new Date(Date.now() + 10 * 60000)) }, 'r2'))
      .rejects.toMatchObject({ campos: { momento: 'Hora do aparelho errada; acerte o relógio' } });
    await expect(iniciar({ programacao_id: 77, momento: momentoIso(new Date(Date.now() - 73 * 3600000)) }, 'r3'))
      .rejects.toMatchObject({ campos: { momento: 'Envio vencido; peça a correção ao gestor' } });
    const a = await iniciar({ programacao_id: 77 }, 'r4');
    await expect(iniciar({ programacao_id: 77 }, 'r5')).rejects.toMatchObject({ status: 409, codigo: 'em_andamento', apontamento_id: a.id });
  });

  it('pedido de correção: hora certa + justificativa, vai para o gestor', async () => {
    const a = await iniciar({ programacao_id: 77 }, 'c1');
    await expect(post(`${a.id}/corrigir`, { momento: agora(), justificativa: 'erro' }, 'c2')).rejects.toMatchObject({ campos: { justificativa: expect.any(String) } });
    await expect(post(`${a.id}/corrigir`, { momento: agora(), justificativa: 'Comecei às 8h' }, 'c3')).resolves.toMatchObject({ apontamento_id: a.id, situacao: 'aguardando_gestor' });
  });

  it('com app_apontamento_exige_qr: número recusado e iniciar só com o QR da OS da etapa', async () => {
    demo.definirAjustes({ app_apontamento_exige_qr: true });
    await expect(etiqueta('4812')).rejects.toMatchObject({ status: 422, campos: { codigo: expect.any(String) } });
    await expect(iniciar({ programacao_id: 77 }, 'q1')).rejects.toMatchObject({ campos: { codigo: expect.any(String) } });
    await expect(iniciar({ programacao_id: 80, codigo: QR_DEMO }, 'q2')).rejects.toMatchObject({ status: 404 });
    await expect(iniciar({ programacao_id: 77, codigo: QR_DEMO }, 'q3')).resolves.toMatchObject({ programacao_id: 77 });
  });

  it('pausa com motivo do posto encerra o apontamento; retomar = iniciar de novo na mesma etapa', async () => {
    expect(await demo.chamar('GET', '/api/app/producao/motivos-pausa?posto_id=5')).toContainEqual({ id: 31, nome: 'Troca de bobina' });
    expect(await demo.chamar('GET', '/api/app/producao/motivos-pausa?posto_id=999')).toEqual([]);
    const a = await iniciar({ programacao_id: 80 }, 'pa1');
    // Motivo de outro posto (Impressão) → 422 campos.motivo_id.
    await expect(post(`${a.id}/pausar`, { motivo_id: 11, momento: agora() }, 'pa2')).rejects.toMatchObject({ status: 422, campos: { motivo_id: expect.any(String) } });
    const corpo = { motivo_id: 31, momento: agora() };
    const p = await post<{ encerrado_por: string }>(`${a.id}/pausar`, corpo, 'pa3');
    expect(p).toMatchObject({ id: a.id, encerrado_por: 'pausa' });
    expect(await post(`${a.id}/pausar`, corpo, 'pa3')).toEqual(p);
    expect((await emAndamento()).maquinas).toEqual([]);
    await expect(post(`${a.id}/concluir`, { momento: agora() }, 'pa4')).rejects.toMatchObject({ codigo: 'bloqueado' });
    const b = await iniciar({ programacao_id: 80 }, 'pa5');
    expect(b.id).not.toBe(a.id);
    expect((await emAndamento()).maquinas.map((x) => x.id)).toEqual([b.id]);
  });
});
