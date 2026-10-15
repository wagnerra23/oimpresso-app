// Ajustes da empresa do app das lojas (propostas P1–P9). Arquivo sem dependência do Capacitor nem do React,
// para o teste de unidade rodar em Node.
//
// O ERP grava cada ajuste como chave `app_*` em `business.pos_settings` e manda o bloco `ajustes` em
// GET /api/app/inicio, sempre com todas as chaves (contrato §6.2). ERP antigo não manda o bloco; ERP com
// chave nova ou valor estranho manda incompleto. Nos dois casos vale o padrão daqui, que é cópia do mapa
// `App\Services\AppLojas\AjustesDaEmpresa::CHAVES` do ERP — mudou lá, muda aqui.
//
// O app só esconde ou mostra. Quem recusa o que o ajuste proíbe é a rota do ERP.

export interface AjustesEmpresa {
  /** P3: `true` = some "Recebido sem assinatura"; a rota exige `assinatura_png`. */
  app_entrega_exige_assinatura: boolean;
  /** P3: `true` = sem GPS a entrega não é registrada. */
  app_entrega_exige_localizacao: boolean;
  /** P1: ações da FSM do pedido que aparecem no app. Vazio = todas as ações seguras. */
  app_acoes_fsm_liberadas: string[];
  /** P2: `false` = anexo da OS só da galeria. */
  app_anexos_camera: boolean;
  /** P8: `true` = some "Digitar número"; só vale o QR da etiqueta. */
  app_apontamento_exige_qr: boolean;
  /** P4: liga o "+ Novo" em Orçamentos. */
  app_orcamento_rapido: boolean;
  /** P5: atalhos de orçamento, status e arte na conversa. O consentimento LGPD vale sempre. */
  app_atendimento_atalhos: boolean;
  /** P6: o vendedor vê a própria comissão; `false` = só quem tem `commission_agent.view`. */
  app_comissao_vendedor_ve_propria: boolean;
  /** P9: `false` = a opção de biometria some em Conta. O ponto nunca usa biometria. */
  app_biometria_login: boolean;
}

export type ChaveAjuste = keyof AjustesEmpresa;

/** Padrões idênticos aos do ERP (AjustesDaEmpresa::CHAVES). */
export const AJUSTES_PADRAO: Readonly<AjustesEmpresa> = Object.freeze({
  app_entrega_exige_assinatura: false,
  app_entrega_exige_localizacao: false,
  app_acoes_fsm_liberadas: [],
  app_anexos_camera: true,
  app_apontamento_exige_qr: false,
  app_orcamento_rapido: false,
  app_atendimento_atalhos: true,
  app_comissao_vendedor_ve_propria: true,
  app_biometria_login: true,
});

export const CHAVES_AJUSTES = Object.keys(AJUSTES_PADRAO) as ChaveAjuste[];

const VERDADE = ['1', 'true', 'on', 'yes'];
const FALSO = ['0', 'false', 'off', 'no', ''];
const ITEM_LISTA = /^[a-z0-9_]{1,80}$/;

/** Mesmo critério do `filter_var(…, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE)` do ERP; inválido = null. */
function comoBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === null) return false;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : null;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (VERDADE.includes(t)) return true;
    if (FALSO.includes(t)) return false;
  }
  return null;
}

/** Só chaves `[a-z0-9_]`, sem repetição, na ordem que vieram (como o ERP guarda). Não-lista = null. */
function comoLista(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.filter((i): i is string => typeof i === 'string' && ITEM_LISTA.test(i)))];
}

/**
 * O bloco `ajustes` do /inicio, completo: o que veio, normalizado, e o padrão onde falta ou é inválido.
 * Aceita qualquer coisa (ausente, null, objeto parcial, tipo errado) e nunca lança.
 */
export function completarAjustes(bruto: unknown): AjustesEmpresa {
  const dado = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? (bruto as Record<string, unknown>) : {};
  const tem = (k: ChaveAjuste) => Object.prototype.hasOwnProperty.call(dado, k);
  const bool = (k: Exclude<ChaveAjuste, 'app_acoes_fsm_liberadas'>) => (tem(k) ? comoBool(dado[k]) ?? AJUSTES_PADRAO[k] : AJUSTES_PADRAO[k]);
  return {
    app_entrega_exige_assinatura: bool('app_entrega_exige_assinatura'),
    app_entrega_exige_localizacao: bool('app_entrega_exige_localizacao'),
    app_acoes_fsm_liberadas: (tem('app_acoes_fsm_liberadas') ? comoLista(dado.app_acoes_fsm_liberadas) : null) ?? [...AJUSTES_PADRAO.app_acoes_fsm_liberadas],
    app_anexos_camera: bool('app_anexos_camera'),
    app_apontamento_exige_qr: bool('app_apontamento_exige_qr'),
    app_orcamento_rapido: bool('app_orcamento_rapido'),
    app_atendimento_atalhos: bool('app_atendimento_atalhos'),
    app_comissao_vendedor_ve_propria: bool('app_comissao_vendedor_ve_propria'),
    app_biometria_login: bool('app_biometria_login'),
  };
}
