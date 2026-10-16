// P1 · avançar etapa do pedido (tela 22). Regras puras do rodapé do Detalhe, sem Capacitor nem React,
// para o teste de unidade rodar em Node. Contrato: memory/requisitos/AppMobile/api/tela-22-avancar-etapa.md
// (ERP #9445). Quem recusa de verdade é a rota (lista segura + `app_acoes_fsm_liberadas` + RBAC da FSM);
// o app só esconde o botão e reage ao código de erro.

/** `pede_motivo` (contrato novo, ex. pausar/retomar produção): a confirmação mostra um motivo opcional. */
export interface AcaoPedido { chave: string; rotulo: string; pode: boolean; pede_motivo?: boolean }

/** Destino das ações da lista segura do ERP (`AcoesDoPedido::SEGURAS`), para a folha "Mover para …?".
 *  Ação que não está aqui usa o próprio rótulo. O app não filtra ações por chave: aparece o que o ERP manda em acoes[]
 *  e a empresa liberou (`app_acoes_fsm_liberadas`), então ação nova (ex. retomar_producao) não precisa de mudança aqui. */
const DESTINO: Record<string, string> = {
  iniciar_producao: 'Em produção',
  pausar_producao: 'Em espera',
  retomar_producao: 'Em produção',
  concluir: 'Concluída',
};

/** Ações liberadas pela empresa: `[]` = todas as que o ERP mandou (ele já cortou fora da lista segura). */
const liberada = (a: AcaoPedido, liberadas: readonly string[]) => liberadas.length === 0 || liberadas.includes(a.chave);

/** Botões do rodapé: liberadas pela empresa e que o usuário pode executar (sem permissão, o botão some). */
export const acoesDoRodape = (acoes: readonly AcaoPedido[], liberadas: readonly string[]): AcaoPedido[] =>
  acoes.filter((a) => a.pode && liberada(a, liberadas));

/** Há ação liberada nesta etapa, mas o usuário não pode nenhuma: "Seu usuário só consulta este pedido." */
export const soConsulta = (acoes: readonly AcaoPedido[], liberadas: readonly string[]): boolean =>
  acoes.some((a) => liberada(a, liberadas)) && acoesDoRodape(acoes, liberadas).length === 0;

/** Título da folha de confirmação. */
export const tituloConfirmacao = (a: AcaoPedido): string => (DESTINO[a.chave] ? `Mover para ${DESTINO[a.chave]}?` : `${a.rotulo}?`);

/** Limite do motivo no POST (422 validacao acima disso). */
export const MOTIVO_ACAO_MAX = 500;

/** Corpo do POST: `etapa_esperada` = a etapa que a tela mostrava (diferente da atual → 409 etapa_mudou). */
export const corpoAcao = (acao: string, etapaEsperada: string, motivo: string | null = null) =>
  ({ acao, motivo: motivo?.trim() ? motivo.trim() : null, etapa_esperada: etapaEsperada });

/** O que a tela faz com o erro do POST (tabela de códigos do contrato). */
export type Reacao =
  /** 409 etapa_mudou: recarrega o pedido e avisa. */
  | 'recarregar'
  /** 403 sem_permissao: tira o botão. */
  | 'sumir'
  /** 404 nao_encontrado: volta para a lista. */
  | 'voltar'
  /** Rede, 5xx, 429, 409 em_andamento: avisa e deixa tentar de novo com a MESMA chave. */
  | 'repetir'
  /** Outros 4xx (422 validacao, idempotencia_conflito): avisa; a próxima tentativa leva chave nova. */
  | 'avisar';

export function reacaoAoErro(status: number, codigo: string): { reacao: Reacao; mensagem: string; manterChave: boolean } {
  if (status === 409 && codigo === 'em_andamento') return { reacao: 'repetir', mensagem: 'Ainda processando a mudança. Aguarde e confira.', manterChave: true };
  if (status === 409) return { reacao: 'recarregar', mensagem: 'O pedido mudou de etapa. Confira antes de mover.', manterChave: false };
  if (status === 403) return { reacao: 'sumir', mensagem: 'Seu usuário não pode mover este pedido.', manterChave: false };
  // 404 sem `nao_encontrado` = ERP sem a rota ainda (página do Laravel): não manda o usuário embora.
  if (status === 404 && codigo === 'nao_encontrado') return { reacao: 'voltar', mensagem: 'Este pedido não existe ou não é desta empresa.', manterChave: false };
  if (status === 429) return { reacao: 'repetir', mensagem: 'Tente de novo em instantes.', manterChave: true };
  if (status === 0 || status >= 500) return { reacao: 'repetir', mensagem: 'Não foi possível avançar o pedido. Tente de novo.', manterChave: true };
  return { reacao: 'avisar', mensagem: 'Não foi possível avançar o pedido.', manterChave: false };
}

/** Uma linha do histórico de etapas (FORMATO PROVISÓRIO, pedido ao ERP: `historico[]` do GET /pedidos/{id}). */
export interface MudancaEtapa { em: string; quem: string | null; de: string | null; para: string; origem?: 'app' | 'web' | null }

/** "Em produção → Em espera" (ou só o destino, na criação). */
export const textoMudanca = (m: MudancaEtapa): string => (m.de ? `${m.de} → ${m.para}` : m.para);
