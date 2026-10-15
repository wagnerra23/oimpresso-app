// O acesso central (ajustes.ts) é alimentado pelo api.inicio(): o que as telas leem é sempre o bloco completo.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AJUSTES_PADRAO } from './ajustes-regras';

const request = vi.fn();
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request: (o: unknown) => request(o) } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: { get: vi.fn(), set: vi.fn(), remove: vi.fn() } }));

const { api, sair } = await import('./api');
const { ajustesDaEmpresa } = await import('./ajustes');
const { demo } = await import('./demo');

const painel = (extra: Record<string, unknown> = {}) => ({ status: 200, headers: {}, url: '', data: {
  perfil: 'erp', abre_em: 'inicio', areas: ['inicio', 'mais'], usuario: 'U', empresa: 'E', faturado_hoje: null, meta_dia: null,
  kpis: { pedidos_ativos: null, pedidos_atrasados: null, estoque_baixo: null }, financeiro: null, proximas_tarefas: [], ...extra } });

beforeEach(() => request.mockReset());

describe('ajustes da empresa no app', () => {
  it('antes do /inicio vale o padrão do ERP', () => {
    expect(ajustesDaEmpresa()).toEqual(AJUSTES_PADRAO);
  });

  it('ERP antigo sem `ajustes`: o /inicio devolve e guarda o padrão', async () => {
    request.mockResolvedValueOnce(painel());
    const p = await api.inicio();
    expect(p.ajustes).toEqual(AJUSTES_PADRAO);
    expect(ajustesDaEmpresa()).toEqual(AJUSTES_PADRAO);
  });

  it('bloco do ERP (mesmo incompleto) é completado e guardado; sair volta ao padrão', async () => {
    request.mockResolvedValueOnce(painel({ ajustes: { app_anexos_camera: false, app_acoes_fsm_liberadas: ['put_on_hold'] } }));
    const p = await api.inicio();
    expect(p.ajustes).toEqual({ ...AJUSTES_PADRAO, app_anexos_camera: false, app_acoes_fsm_liberadas: ['put_on_hold'] });
    expect(ajustesDaEmpresa()).toBe(p.ajustes);
    await sair();
    expect(ajustesDaEmpresa()).toEqual(AJUSTES_PADRAO);
  });

  it('/inicio que falha mantém os últimos ajustes', async () => {
    request.mockResolvedValueOnce(painel({ ajustes: { app_orcamento_rapido: true } }));
    await api.inicio();
    request.mockResolvedValue({ status: 403, headers: {}, url: '', data: { erro: 'sem_permissao', mensagem: 'x' } });
    await expect(api.inicio()).rejects.toBeTruthy();
    expect(ajustesDaEmpresa().app_orcamento_rapido).toBe(true);
  });

  it('a demo manda o bloco completo, nos dois perfis, e aceita troca de ajuste', async () => {
    await demo.entrar('demo', 'abc');
    const erp = await demo.chamar<{ ajustes: unknown }>('GET', '/api/app/inicio');
    // A empresa da demo liga o orçamento rápido (P4); no ERP ele nasce desligado.
    const DEMO = { ...AJUSTES_PADRAO, app_orcamento_rapido: true };
    expect(erp.ajustes).toEqual(DEMO);
    demo.definirAjustes({ app_entrega_exige_assinatura: true });
    expect((await demo.chamar<{ ajustes: { app_entrega_exige_assinatura: boolean } }>('GET', '/api/app/inicio')).ajustes.app_entrega_exige_assinatura).toBe(true);
    demo.definirAjustes();
    await demo.entrar('revisor.ponto', 'abc');
    expect((await demo.chamar<{ ajustes: unknown }>('GET', '/api/app/inicio')).ajustes).toEqual(DEMO);
  });
});
