// Tela 41 · Atendimento WhatsApp (P5, playbook propostas-app PR 19). Regras puras, sem Capacitor nem React, para o
// teste de unidade rodar em Node. Contrato: memory/requisitos/AppMobile/api/tela-41-atendimento.md (ERP PR 18).
//
// O app só esconde, avisa e trava; quem recusa de verdade é a rota do ERP (consentimento conferido no servidor antes
// de gravar a mensagem). LGPD Art. 7º, I: envio ATIVO só com `whatsapp_consent = true`; responder dentro da janela de
// 24 h que o cliente abriu é permitido. O consentimento não é ajuste da empresa — `app_atendimento_atalhos` só liga
// ou desliga os atalhos.

/** Conversa da lista (GET /api/app/atendimento). */
export interface ConversaAtendimento {
  id: number;
  /** `id` null = conversa ainda não ligada a um cliente (o nome cai para o da conversa ou o telefone). */
  contato: { id: number | null; nome: string };
  ultima: string | null;
  quando: string | null;
  nao_lidas: number;
  /** `whatsapp_consent = true` na ficha (nulo conta como não). */
  consentimento: boolean;
  /** Última mensagem do cliente + 24 h; null se a janela já fechou. */
  janela_aberta_ate: string | null;
}

export interface MensagemAtendimento {
  id: number;
  de: 'cliente' | 'eu' | 'sistema';
  texto: string | null;
  /** Imagem, áudio, vídeo, documento ou figurinha: só tipo e nome na v1 (sem URL). */
  midia: { tipo: string; nome: string | null } | null;
  quando: string | null;
  status: string;
}

export interface ListaAtendimento {
  canal: { ligado: boolean; numero: string | null };
  conversas: ConversaAtendimento[];
  pagina: number; tem_mais: boolean;
}

export interface DetalheAtendimento { conversa: ConversaAtendimento; mensagens: MensagemAtendimento[] }

/** Atalhos: o ERP monta o texto (valor e link vêm dele). O app nunca digita valor. */
export type TipoAtalho = 'orcamento' | 'status_pedido' | 'link_arte';
export const ATALHOS: Array<{ tipo: TipoAtalho; rotulo: string; escolha: string }> = [
  { tipo: 'orcamento', rotulo: 'Orçamento', escolha: 'Qual orçamento enviar?' },
  { tipo: 'status_pedido', rotulo: 'Status do pedido', escolha: 'Status de qual pedido?' },
  { tipo: 'link_arte', rotulo: 'Link da arte', escolha: 'Arte de qual ordem de produção?' },
];

/** A janela de 24 h que o cliente abriu ainda vale agora. */
export function janelaAberta(c: Pick<ConversaAtendimento, 'janela_aberta_ate'>, agora: number = Date.now()): boolean {
  if (!c.janela_aberta_ate) return false;
  const fim = Date.parse(c.janela_aberta_ate);
  return !Number.isNaN(fim) && fim > agora;
}

export const MSG_OFFLINE = 'Sem conexão. Enviar mensagem precisa de internet.';
export const MSG_SEM_CONSENTIMENTO = 'Este cliente não autorizou mensagens no WhatsApp (LGPD). Só dá para responder quando ele escrever.';

/** Por que o envio está travado agora (null = pode enviar). Offline trava sempre; sem consentimento, só fora da janela. */
export function bloqueioDoEnvio(c: Pick<ConversaAtendimento, 'consentimento' | 'janela_aberta_ate'>, online: boolean, agora: number = Date.now()): string | null {
  if (!online) return MSG_OFFLINE;
  if (!c.consentimento && !janelaAberta(c, agora)) return MSG_SEM_CONSENTIMENTO;
  return null;
}

/** Aviso fixo na conversa sem consentimento enquanto a janela está aberta (dá para responder, não para envio ativo). */
export function avisoDeConsentimento(c: Pick<ConversaAtendimento, 'consentimento' | 'janela_aberta_ate'>, agora: number = Date.now()): string | null {
  return !c.consentimento && janelaAberta(c, agora)
    ? 'A ficha não registra autorização (LGPD Art. 7º, I). Dá para responder ao que o cliente mandou até a janela de 24 h fechar.'
    : null;
}

/** Atalhos aparecem com o ajuste ligado e a conversa ligada a um cliente (o ERP confere o registro contra ele). */
export const mostraAtalhos = (ligado: boolean, c: Pick<ConversaAtendimento, 'contato'>) => ligado && c.contato.id !== null;

/** Soma das não lidas, para o sobretítulo ("3 não lidas · WhatsApp"). */
export const totalNaoLidas = (cs: ReadonlyArray<Pick<ConversaAtendimento, 'nao_lidas'>>) => cs.reduce((s, c) => s + Math.max(0, c.nao_lidas || 0), 0);

const MIDIA: Record<string, string> = { image: 'imagem', audio: 'áudio', video: 'vídeo', document: 'documento', sticker: 'figurinha' };

/** Texto da bolha: mídia vira "[imagem · nome]" (a v1 não abre o arquivo). */
export function textoDaMensagem(m: Pick<MensagemAtendimento, 'texto' | 'midia'>): string {
  const t = (m.texto ?? '').trim();
  if (!m.midia) return t;
  const rotulo = `[${MIDIA[m.midia.tipo] ?? m.midia.tipo}${m.midia.nome ? ` · ${m.midia.nome}` : ''}]`;
  return t ? `${rotulo} ${t}` : rotulo;
}

/** Erro → texto em PT-BR para a tela. Aceita o ErroApi e o erro da demo (os dois trazem `status` e `codigo`). */
export function mensagemDeErro(e: unknown): string {
  const x = (e ?? {}) as { status?: number; codigo?: string; message?: string; campos?: Record<string, string> };
  switch (x.codigo) {
    case 'sem_consentimento': return MSG_SEM_CONSENTIMENTO;
    case 'janela_fechada': return 'Passaram 24 h desde a última mensagem do cliente. Use um modelo aprovado pela web.';
    case 'bloqueado': return 'Este canal ainda não envia pelo app. Responda pela web.';
    case 'falha_envio': return 'O WhatsApp não aceitou a mensagem agora. Tente de novo.';
    case 'sem_configuracao': return 'O canal do WhatsApp está desligado.';
    case 'em_andamento': return 'Esta mensagem ainda está sendo enviada. Espere um instante.';
    case 'sem_permissao': return x.message || 'Seu usuário não pode enviar mensagens.';
    case 'nao_encontrado': return x.message || 'Registro não encontrado para este cliente.';
    case 'rede': return MSG_OFFLINE;
  }
  if (x.status === 429) return 'Muitas mensagens em pouco tempo. Espere um minuto e tente de novo.';
  const campo = x.campos ? Object.values(x.campos)[0] : undefined;
  return campo || x.message || 'Não foi possível enviar.';
}

/**
 * A chave de idempotência da tentativa continua valendo para reenviar o MESMO corpo? Rede, 5xx e 409 (ainda enviando)
 * mantêm a chave: o reenvio não manda a mensagem duas vezes. 4xx de regra (consentimento, validação…) descarta, e o
 * 502 `falha_envio` também: o ERP grava essa resposta na chave, então repetir a chave só devolveria a mesma falha.
 */
export const manterChave = (status: number, codigo = '') =>
  codigo !== 'falha_envio' && (status === 0 || status === 409 || status >= 500);
