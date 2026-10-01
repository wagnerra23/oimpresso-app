// Camada de dados do app. Fala com a API do ponto do ERP (/ponto/api, Passport)
// por token — o app não tem sessão web. As chamadas saem pelo HTTP nativo do
// Capacitor (CapacitorHttp), por isso não dependem do CORS do ERP.
//
// Contrato espelhado de Modules/Ponto/Http/Controllers/Api/MobileMarcacaoController.
import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { demo } from './demo';

export const BASE = 'https://oimpresso.com';
export const DEMO = import.meta.env.VITE_DEMO === '1';
const CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID ?? '';
const CHAVE_TOKEN = 'oi.token';

export type TipoMarcacao = 'ENTRADA' | 'ALMOCO_INICIO' | 'ALMOCO_FIM' | 'SAIDA';

export interface MarcacaoHoje {
  id: string; nsr: number; tipo: string; origem: string;
  hora: string | null; hash_trunc: string; revisar: boolean;
}
export interface Kpis { marcacoes_hoje: number; intercorrencias_pendentes: number; saldo_minutos: number }
export interface Saldo { usa_banco_horas: boolean; saldo_minutos: number; ultima_movimentacao: string | null }
export interface EscalaHoje {
  data: string;
  escala: { id: number; nome: string } | null;
  turno: { hora_entrada: string | null; hora_almoco_inicio: string | null; hora_almoco_fim: string | null; hora_saida: string | null } | null;
}
export interface Intercorrencia {
  id: string; codigo: string | null; tipo: string; estado: string; data: string | null;
  dia_todo: boolean; intervalo_inicio: string | null; intervalo_fim: string | null;
}
export interface NovaIntercorrencia {
  tipo: string; data: string; dia_todo: boolean;
  intervalo_inicio?: string | null; intervalo_fim?: string | null; justificativa: string;
}
export interface MarcacaoCriada {
  id: string; nsr: number; tipo: string; momento: string; hash_trunc: string; origem: string; revisar: boolean;
}

// ── Pedidos (API-CONTRATO-v1 §2, ERP #8492). Pedido = venda do ERP; etapas agrupam a FSM. ──
export type GrupoEtapa = 'orcamento' | 'aprovacao' | 'producao' | 'entrega' | 'concluido';
export type FiltroPedidos = 'ativos' | 'atrasados' | 'concluidos' | 'todos';
export interface PedidoResumo {
  id: number; numero: string; cliente: string; valor: number; prazo: string | null; atrasado: boolean;
  etapa: { chave: string; rotulo: string; grupo: GrupoEtapa }; progresso: number;
}
export interface ListaPedidos {
  itens: PedidoResumo[]; contadores: Record<FiltroPedidos, number>; pagina: number; tem_mais: boolean;
}
export interface PedidoDetalhe extends PedidoResumo {
  itens_venda: Array<{ produto: string; quantidade: number; total: number }>;
  etapas: Array<{ grupo: GrupoEtapa; rotulo: string; estado: 'feito' | 'atual' | 'futuro' }>;
  acoes: Array<{ chave: string; rotulo: string; pode: boolean }>;
}
/** No detalhe o contrato manda `cliente` como objeto; na lista, como texto. */
export type PedidoDetalheApi = Omit<PedidoDetalhe, 'cliente'> & { cliente: { id: number; nome: string; telefone: string | null } };

/** GET /ponto/api/me (ERP #8481). */
export interface Me { nome: string; matricula: string | null; empresa: string; limites: { accuracy_max: number; drift_max: number } }

/** Saída de EspelhoController::buildTotaisEspelho / buildLinhasEspelho. */
export interface Espelho {
  totais: { trabalhado: number; atraso: number; falta: number; he_diurna: number; he_noturna: number; divergencias: number } | null;
  linhas: Array<{
    data: string; dow: string; dia: number; is_weekend: boolean; trabalhado: number;
    divergencia: boolean; estado: string; marcacoes: Array<{ hora: string; tipo: string; origem: string }>;
  }>;
}

/** Erro com a mensagem que o servidor devolveu (em PT-BR), pronta para a tela. */
export class ErroApi extends Error {
  constructor(public status: number, public codigo: string, mensagem: string) { super(mensagem); }
}

let token: string | null = null;
/** Diferença relógio do aparelho − servidor, em segundos, medida pelo header Date. */
let driftSeg: number | null = null;
export const drift = () => driftSeg;

export async function carregarToken(): Promise<boolean> {
  if (DEMO) { token = 'demo'; return demo.logado(); }
  token = (await Preferences.get({ key: CHAVE_TOKEN })).value;
  return !!token;
}

export async function entrar(usuario: string, senha: string): Promise<void> {
  if (DEMO) { await demo.entrar(usuario, senha); token = 'demo'; return; }
  if (!CLIENT_ID) {
    throw new ErroApi(0, 'sem_client', 'Este build do app não tem o client_id do ERP configurado.');
  }
  const r = await CapacitorHttp.post({
    url: `${BASE}/oauth/token`,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    data: { grant_type: 'password', client_id: CLIENT_ID, username: usuario, password: senha, scope: '' },
  });
  if (r.status === 400 || r.status === 401) {
    throw new ErroApi(r.status, 'credenciais', 'Usuário ou senha incorretos.');
  }
  if (r.status !== 200 || !r.data?.access_token) {
    throw new ErroApi(r.status, 'login', 'Não foi possível entrar agora. Tente de novo.');
  }
  token = String(r.data.access_token);
  await Preferences.set({ key: CHAVE_TOKEN, value: token });
}

export async function sair(): Promise<void> {
  token = null;
  if (DEMO) { demo.sair(); return; }
  await Preferences.remove({ key: CHAVE_TOKEN });
}

function medirDrift(r: HttpResponse) {
  const h = r.headers ?? {};
  const data = h['Date'] ?? h['date'];
  if (!data) return;
  const servidor = Date.parse(data);
  if (!Number.isNaN(servidor)) driftSeg = Math.round((Date.now() - servidor) / 1000);
}

/** Chamado quando o servidor recusa o token: a tela volta ao login. */
let aoExpirar: () => void = () => {};
export const quandoExpirar = (fn: () => void) => { aoExpirar = fn; };

async function chamar<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  if (DEMO) return demo.chamar<T>(metodo, caminho, corpo);
  let r: HttpResponse;
  try {
    r = await CapacitorHttp.request({
      method: metodo,
      url: `${BASE}${caminho}`,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token ?? ''}`,
      },
      data: corpo,
    });
  } catch {
    throw new ErroApi(0, 'rede', 'Sem conexão com o servidor. Verifique a internet.');
  }
  medirDrift(r);
  if (r.status === 401) {
    await sair();
    aoExpirar();
    throw new ErroApi(401, 'nao_autenticado', 'Sua sessão terminou. Entre de novo.');
  }
  if (r.status >= 400) {
    const d = (r.data ?? {}) as Record<string, unknown>;
    const errosCampo = d.errors as Record<string, string[]> | undefined;
    const primeiro = errosCampo ? Object.values(errosCampo)[0]?.[0] : undefined;
    const msg = (primeiro ?? d.mensagem ?? d.message ?? 'Algo deu errado. Tente de novo.') as string;
    throw new ErroApi(r.status, String(d.erro ?? 'erro'), msg);
  }
  return r.data as T;
}

export const api = {
  marcacoesHoje: () => chamar<{ data: string; marcacoes: MarcacaoHoje[] }>('GET', '/ponto/api/marcacoes/hoje'),
  kpis: () => chamar<Kpis>('GET', '/ponto/api/dashboard/kpis'),
  saldo: () => chamar<Saldo>('GET', '/ponto/api/saldo'),
  escalaHoje: () => chamar<EscalaHoje>('GET', '/ponto/api/escala/hoje'),
  intercorrencias: () => chamar<{ intercorrencias: Intercorrencia[] }>('GET', '/ponto/api/intercorrencias'),
  justificar: (i: NovaIntercorrencia) =>
    chamar<{ sucesso: boolean; intercorrencia: Intercorrencia }>('POST', '/ponto/api/intercorrencias', i),
  marcar: (p: { tipo: TipoMarcacao; lat: number; lng: number; accuracy: number; device_uuid: string; timestamp_device: string }) =>
    chamar<{ sucesso: boolean; marcacao: MarcacaoCriada }>('POST', '/ponto/api/marcar', p),
  // ERP #8481. Enquanto não estiverem em produção, o servidor devolve 404 e o app usa o fallback.
  me: () => chamar<Me>('GET', '/ponto/api/me'),
  tipos: () => chamar<Array<{ value: string; label: string }>>('GET', '/ponto/api/intercorrencias/tipos'),
  espelho: (mes: string) => chamar<Espelho>('GET', `/ponto/api/espelho?mes=${mes}`),
  pedidos: (filtro: FiltroPedidos, pagina = 1, q = '') =>
    chamar<ListaPedidos>('GET', `/api/app/pedidos?filtro=${filtro}&pagina=${pagina}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  pedido: (id: number) => chamar<PedidoDetalheApi>('GET', `/api/app/pedidos/${id}`),
  // Lembrete de ponto (ADR 0423, sessão PUSH — PR #8457 no ERP).
  registrarPush: (t: string, plataforma: 'android' | 'ios') =>
    chamar<{ ativo: boolean }>('POST', '/ponto/api/push/dispositivo', { token: t, plataforma }),
};
