// P3 · protocolo de entrega (tela 22). Regras puras da tela de entrega, sem Capacitor nem React, para o teste de
// unidade rodar em Node. Contrato: memory/requisitos/AppMobile/api/tela-22-entrega.md (ERP #9464). Quem recusa de
// verdade é a rota (conferência, assinatura/motivo, ajustes da empresa, FSM); o app só não deixa enviar o que já
// sabe que vai voltar 422 e reage ao código de erro.
import type { AjustesEmpresa } from './ajustes-regras';

/** Localização no momento da entrega (registro; só trava com `app_entrega_exige_localizacao`). */
export interface LocalEntrega { lat: number; lng: number; precisao_m: number }

/** O que a tela colheu até agora. */
export interface Entrega {
  /** `linha_id` de cada linha conferida. */
  conferidos: readonly number[];
  recebidoPor: string;
  /** "Recebido sem assinatura" marcado (só vale quando a empresa não exige assinatura). */
  semAssinatura: boolean;
  motivo: string;
  /** Há traço no quadro de assinatura. */
  assinou: boolean;
  local: LocalEntrega | null;
}

type Exige = Pick<AjustesEmpresa, 'app_entrega_exige_assinatura' | 'app_entrega_exige_localizacao'>;

/** Limites do contrato. */
export const RECEBIDO_MIN = 2, RECEBIDO_MAX = 120, MOTIVO_MIN = 5, MOTIVO_MAX = 200, ASSINATURA_MAX_BYTES = 200 * 1024;

/** A opção "Recebido sem assinatura" aparece? Com o ajuste ligado, o app esconde. */
export const podeSemAssinatura = (aj: Exige) => !aj.app_entrega_exige_assinatura;

/** A entrega vai sem assinatura (marcou a opção e a empresa permite). */
export const vaiSemAssinatura = (e: Entrega, aj: Exige) => e.semAssinatura && podeSemAssinatura(aj);

/** Todas as linhas do pedido conferidas (nem a mais, nem a menos). */
export const tudoConferido = (linhas: readonly number[], conferidos: readonly number[]) =>
  linhas.length > 0 && linhas.every((l) => conferidos.includes(l));

/** O que falta para registrar, na ordem da tela; '' = pronto. */
export function faltaNaEntrega(linhas: readonly number[], e: Entrega, aj: Exige): string {
  if (!tudoConferido(linhas, e.conferidos)) return 'Confira todos os itens.';
  const nome = e.recebidoPor.trim();
  if (nome.length < RECEBIDO_MIN) return 'Informe quem recebeu.';
  if (nome.length > RECEBIDO_MAX) return `O nome tem no máximo ${RECEBIDO_MAX} caracteres.`;
  if (vaiSemAssinatura(e, aj)) {
    const m = e.motivo.trim();
    if (m.length < MOTIVO_MIN) return 'Diga por que ficou sem assinatura.';
    if (m.length > MOTIVO_MAX) return `O motivo tem no máximo ${MOTIVO_MAX} caracteres.`;
  } else if (!e.assinou) {
    return podeSemAssinatura(aj) ? 'Falta a assinatura — ou marque "Recebido sem assinatura".' : 'Falta a assinatura.';
  }
  if (aj.app_entrega_exige_localizacao && !e.local) return 'A empresa exige a localização da entrega.';
  return '';
}

/** Bytes de um data URL base64 depois de decodificado (o limite do ERP é sobre o PNG). */
export function bytesDataUrl(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

/** O PNG cabe no contrato (data URL `data:image/png;base64,` até 200 KB). */
export const assinaturaValida = (png: string | null) =>
  !!png && png.startsWith('data:image/png;base64,') && bytesDataUrl(png) <= ASSINATURA_MAX_BYTES;

/** Corpo do POST /pedidos/{id}/entrega. Com assinatura o motivo não vai; sem, a assinatura não vai. */
export function corpoEntrega(linhas: readonly number[], e: Entrega, aj: Exige, assinaturaPng: string | null, etapaEsperada: string) {
  const sem = vaiSemAssinatura(e, aj);
  return {
    itens: linhas.map((linha_id) => ({ linha_id, conferido: e.conferidos.includes(linha_id) })),
    recebido_por: e.recebidoPor.trim(),
    documento: null,
    assinatura_png: sem ? null : assinaturaPng,
    sem_assinatura_motivo: sem ? e.motivo.trim() : null,
    lat: e.local?.lat ?? null,
    lng: e.local?.lng ?? null,
    precisao_m: e.local ? Math.round(e.local.precisao_m) : null,
    etapa_esperada: etapaEsperada,
  };
}
export type CorpoEntrega = ReturnType<typeof corpoEntrega>;

/** Botão "Registrar entrega" no rodapé do detalhe: `entrega` vem do GET /pedidos/{id} (null fora da etapa). */
export const botaoEntrega = (entrega: { pode: boolean } | null | undefined, recusada: boolean) => !!entrega?.pode && !recusada;

/** O que a tela faz com o erro do POST (tabela de códigos do contrato). */
export type ReacaoEntrega =
  /** 409 etapa_mudou: fecha a entrega, recarrega o pedido e avisa. */
  | 'recarregar'
  /** 403 sem_permissao: fecha a entrega e tira o botão. */
  | 'sumir'
  /** 404 nao_encontrado: volta para a lista. */
  | 'voltar'
  /** Rede, 5xx, 503 sem_configuracao, 429, 409 em_andamento: avisa e deixa tentar de novo com a MESMA chave. */
  | 'repetir'
  /** 422 validacao: mostra no campo; a próxima tentativa leva chave nova. */
  | 'campos'
  /** Outros (422 bloqueado, idempotencia_conflito): mostra a mensagem do ERP; chave nova. */
  | 'avisar';

export function reacaoAoErroEntrega(status: number, codigo: string): { reacao: ReacaoEntrega; mensagem: string; manterChave: boolean } {
  if (status === 409 && codigo === 'em_andamento') return { reacao: 'repetir', mensagem: 'Ainda registrando a entrega. Aguarde e confira.', manterChave: true };
  if (status === 409) return { reacao: 'recarregar', mensagem: 'O pedido mudou de etapa. Confira antes de entregar.', manterChave: false };
  if (status === 403) return { reacao: 'sumir', mensagem: 'Seu usuário não pode registrar esta entrega.', manterChave: false };
  // 404 sem `nao_encontrado` = ERP sem a rota ainda (página do Laravel): não manda o usuário embora.
  if (status === 404 && codigo === 'nao_encontrado') return { reacao: 'voltar', mensagem: 'Este pedido não existe ou não é desta empresa.', manterChave: false };
  if (status === 429) return { reacao: 'repetir', mensagem: 'Tente de novo em instantes.', manterChave: true };
  if (status === 503 && codigo === 'sem_configuracao') return { reacao: 'repetir', mensagem: 'O ERP não está pronto para guardar a assinatura. Tente mais tarde.', manterChave: true };
  if (status === 0 || status >= 500) return { reacao: 'repetir', mensagem: 'Não foi possível registrar a entrega. Tente de novo.', manterChave: true };
  if (status === 422 && codigo === 'validacao') return { reacao: 'campos', mensagem: 'Confira os campos da entrega.', manterChave: false };
  return { reacao: 'avisar', mensagem: 'Não foi possível registrar a entrega.', manterChave: false };
}

/** Campo do 422 → parte da tela onde a mensagem aparece. */
export function parteDoCampo(campo: string): 'itens' | 'recebido' | 'assinatura' | 'local' | 'geral' {
  if (campo === 'itens' || campo.startsWith('itens.')) return 'itens';
  if (campo === 'recebido_por' || campo === 'documento') return 'recebido';
  if (campo === 'assinatura_png' || campo === 'sem_assinatura_motivo') return 'assinatura';
  if (campo === 'lat' || campo === 'lng' || campo === 'precisao_m') return 'local';
  return 'geral';
}

/** "-26.89770, -49.23160 · ±12 m" (sem geocodificação reversa: nada sai do aparelho além do que vai ao ERP). */
export const textoLocal = (l: LocalEntrega | null) =>
  (l ? `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)} · ±${Math.round(l.precisao_m)} m` : 'Sem localização');
