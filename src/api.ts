// Camada de dados do app. Fala com a API do ponto do ERP (/ponto/api, Passport)
// por token — o app não tem sessão web. As chamadas saem pelo HTTP nativo do
// Capacitor (CapacitorHttp), por isso não dependem do CORS do ERP.
//
// Contrato espelhado de Modules/Ponto/Http/Controllers/Api/MobileMarcacaoController.
import { CapacitorHttp, type HttpResponse } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { demo } from './demo';
import { deveRetentar, esperaMs, MSG_INDISPONIVEL, transitorio } from './rede';
import type { CorpoVenda, ProdutoVenda } from './venda';
import type { NovoLinkPagamento, TipoReferencia } from './pagamento-regras';
import { completarAjustes, type AjustesEmpresa } from './ajustes-regras';
import { guardarAjustes, limparAjustes } from './ajustes';
import type { corpoAcao, MudancaEtapa } from './pedido-acao-regras';
import type { CorpoEntrega } from './entrega-regras';
// P5 · atendimento
import type { DetalheAtendimento, ListaAtendimento, MensagemAtendimento, TipoAtalho } from './atendimento-regras';

import { biometriaLigada, celularTemBiometria, conferirBiometria, guardarTokenSeguro, lerTokenSeguro, marcarDesligada, marcarLigada } from './biometria';
import type { ResultadoBiometria } from './biometria-regras';
import { guardarDono } from './apontamento-dono';

export type { AjustesEmpresa, ChaveAjuste } from './ajustes-regras';
import type { Situacao } from './financeiro-filtros';
import type { AlteracaoLancamento, BaixaLancamento, Frequencia, NovoLancamento } from './lancamento-regras';
import type { ReciboDados } from './recibo';

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
  id: number; numero: string; cliente: string;
  /** Nome do 1º item da venda (título do cartão no v4); null se a venda não tem item. */
  resumo: string | null;
  valor: number; prazo: string | null; atrasado: boolean;
  etapa: { chave: string; rotulo: string; grupo: GrupoEtapa }; progresso: number;
}
export interface ListaPedidos {
  itens: PedidoResumo[]; contadores: Record<FiltroPedidos, number>; pagina: number; tem_mais: boolean;
}
export interface PedidoDetalhe extends PedidoResumo {
  /** `linha_id` = linha de topo da venda, devolvida na conferência da entrega (P3, ERP #9464). */
  itens_venda: Array<{ produto: string; quantidade: number; total: number; linha_id?: number }>;
  etapas: Array<{ grupo: GrupoEtapa; rotulo: string; estado: 'feito' | 'atual' | 'futuro' }>;
  acoes: Array<{ chave: string; rotulo: string; pode: boolean }>;
  /** P1 · histórico de etapas, mais recente primeiro (FORMATO PROVISÓRIO, pedido ao ERP). Ausente = a tela não mostra. */
  historico?: MudancaEtapa[];
  /** P3 · `null` = a etapa não tem a ação `entregar`; `{ pode }` = o RBAC da FSM deixa (ERP #9464). Ausente = ERP antigo. */
  entrega?: { pode: boolean } | null;
}
// P3 · entrega — 201 do POST /pedidos/{id}/entrega.
export interface EntregaRegistrada {
  protocolo: string; registrado_em: string; recebido_por: string; com_assinatura: boolean;
  /** O mesmo JSON do GET /pedidos/{id}, já na etapa nova. */
  pedido: PedidoDetalheApi;
}
/** No detalhe o contrato manda `cliente` como objeto; na lista, como texto. */
export type PedidoDetalheApi = Omit<PedidoDetalhe, 'cliente'> & { cliente: { id: number; nome: string; telefone: string | null } };

// ── Pessoas (API-CONTRATO-v1 §4, ERP #8497). Papéis vêm das flags is_customer/is_supplier/is_employee. ──
export type FiltroPessoas = 'todos' | 'clientes' | 'fornecedores' | 'funcionarios' | 'em_debito';
export type PapelPessoa = 'cliente' | 'fornecedor' | 'funcionario';
export interface PessoaResumo {
  id: number; nome: string; tipo: 'PF' | 'PJ' | null; papeis: PapelPessoa[]; saldo_aberto: number; ativo: boolean;
}
export interface ListaPessoas {
  itens: PessoaResumo[]; contadores: Record<FiltroPessoas, number>; pagina: number; tem_mais: boolean;
}
/** Tela 34 · Dados cadastrais (D16, Onda A). Contrato §4.1 (ERP #8552). `sms` sai sempre null (o ERP não guarda SMS);
 *  campo que o ERP não tem vem null e a linha mostra "—". Pessoa de outra empresa → 404. */
export interface PessoaCadastro {
  id: number; nome: string; tipo: 'PF' | 'PJ' | null;
  /** documento vem MASCARADO (***.***.789-09): nunca devolver no PATCH. indicador_ie é o código 1/2/9. */
  identificacao: { razao_social: string | null; documento: string | null; indicador_ie: number | null; papeis: PapelPessoa[];
    /** Contrato §4.4 (ERP #8570); opcional para quem ainda não tem. Ausente = o campo abre vazio e não é enviado. */
    nome_fantasia?: string | null };
  endereco_fiscal: { cidade: string | null; uf: string | null; cep: string | null; codigo_ibge: string | null; email_nfe: string | null;
    logradouro?: string | null; numero?: string | null; complemento?: string | null; bairro?: string | null };
  contato?: { telefone: string | null; email: string | null };
  comercial: { classificacao: string | null; limite_credito: number | null; prazo_padrao_dias: number | null };
  /** LGPD Art. 7º: true = autorizado, false = não autorizado, null = sem registro. */
  consentimento: { whatsapp: boolean | null; email_nfe: boolean | null; sms: boolean | null; registrado_em: string | null };
}

/** Resposta 200 de GET /api/app/cep/{cep}. codigo_ibge pode vir null para CEP que já estava em cache. */
export interface EnderecoCep {
  cep: string; logradouro: string | null; complemento: string | null; bairro: string | null;
  cidade: string | null; uf: string | null; codigo_ibge: string | null;
}

/** Corpo do POST /api/app/pessoas (tela 09, contrato §4.2 · ERP #8559). Obrigatórios: tipo, nome, papeis.
 *  Papel "funcionario", limite de crédito e classificação não se cadastram pelo app. */
export interface NovaPessoa {
  tipo: 'PF' | 'PJ'; nome: string; nome_fantasia: string | null; documento: string | null;
  /** 1 contribuinte · 2 isento · 9 não contribuinte. */
  indicador_ie: 1 | 2 | 9 | null;
  papeis: Array<'cliente' | 'fornecedor'>;
  telefone: string | null; email: string | null; email_nfe: string | null;
  cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null;
  bairro: string | null; cidade: string | null; uf: string | null; codigo_ibge: string | null;
  prazo_padrao_dias: number | null;
  /** Chave ausente não muda nada no ERP. */
  consentimento: { whatsapp?: boolean; email_nfe?: boolean };
}

/** Corpo do PATCH /api/app/pessoas/{id}: os campos do POST menos tipo e papeis (mudar papel fica na web). */
export type EdicaoPessoa = Partial<Omit<NovaPessoa, 'tipo' | 'papeis'>>;

export interface PessoaDetalhe {
  id: number; nome: string; tipo: 'PF' | 'PJ' | null;
  /** Só vem com a permissão de ver contato completo (contrato §4); null caso contrário. */
  documento: string | null;
  papeis: PapelPessoa[]; ativo: boolean;
  contato: { telefone: string | null; email: string | null };
  endereco: { cidade: string | null; uf: string | null };
  kpis: { pedidos: number; ticket_medio: number; saldo_aberto: number };
  pedidos_recentes: Array<{ id: number; numero: string; data: string; valor: number }>;
}

// ── Produção (API-CONTRATO-v1 §5, ERP #8495): fila por etapa da venda, colunas fixas nesta ordem. ──
export const COLUNAS_PRODUCAO = ['quote_approved', 'in_production', 'on_hold', 'ready_for_invoice'] as const;
export type ColunaProducao = (typeof COLUNAS_PRODUCAO)[number];
export interface FilaProducao {
  /** Até 50 itens por coluna, prazo mais próximo primeiro; item igual ao da lista de pedidos.
   *  `total` é a contagem real da etapa (pode passar de 50). */
  colunas: Array<{ id: ColunaProducao; rotulo: string; total: number; itens: PedidoResumo[] }>;
}

// ── Tarefas (API-CONTRATO-v1 §3): ToDo do usuário + justificativas do Ponto. ──
export type OrigemTarefa = 'todo' | 'ponto';
export type FiltroTarefas = 'todas' | OrigemTarefa;
export type GrupoTarefa = 'atrasadas' | 'hoje' | 'amanha' | 'semana' | 'depois';
export interface Tarefa {
  id: string; origem: OrigemTarefa; titulo: string; subtitulo: string | null;
  prazo: string | null; atrasado: boolean; grupo: GrupoTarefa;
}
export interface ListaTarefas { itens: Tarefa[]; contadores: Record<FiltroTarefas, number> }

/** Tela 28 · Detalhe da tarefa (D16, Onda A) — só ToDo. Contrato §3.1 (ERP #8556). Hoje o ToDo do
 *  Essentials não tem checklist (sempre []), nem cliente e origem (sempre null): a tela esconde o que vier vazio. */
export interface TarefaDetalhe {
  /** Mesmo id da lista, ex.: "todo:15". */
  id: string; titulo: string;
  /** Rótulo pronto para o topo, igual ao da lista (ex.: "Tarefa · alta"); null quando não houver. */
  modulo: string | null;
  descricao: string | null;
  /** Atribuídos, separados por vírgula. */
  responsavel: string | null; cliente: string | null;
  /** Data (YYYY-MM-DD) ou data-hora (ISO) do prazo. */
  prazo: string | null; atrasado: boolean;
  /** De onde a tarefa veio, ex.: "Orçamento #4812"; null quando não houver. */
  origem: string | null;
  checklist: Array<{ texto: string; feito: boolean }>;
  /** Do mais antigo para o mais novo (a tela mostra o mais novo primeiro, como o protótipo). */
  comentarios: Array<{ quando: string; autor: string; texto: string; detalhe: string | null }>;
  concluida: boolean;
}

// ── Produtos (tela 19, Onda B). Contrato §9.1 (ERP #8574), 30 por página, por nome. Só leitura. ──
export interface ProdutoResumo {
  id: number; nome: string; codigo: string;
  /** Nome da categoria; null = sem categoria. */
  categoria: string | null;
  /** "por " + unidade curta ("por m²"); null sem unidade. */
  calculo: string | null;
  /** Preço de venda com imposto; com variação é o menor. null = sem preço cadastrado. */
  preco: number | null;
  /** Quantas variações; null quando o produto é simples. */
  variacoes: number | null;
  /** qtd = soma nos locais que o usuário vê; null quando não controla estoque ("sob demanda"). */
  estoque: { controla: boolean; qtd: number | null; unidade: string | null };
  /** Regra do alerta da web: alguma variação × local com qtd ≤ alert_quantity. */
  baixo: boolean;
}
export interface ListaProdutos {
  itens: ProdutoResumo[];
  /** Respeitam a busca, não o filtro de categoria. */
  categorias: Array<{ id: number; nome: string; total: number }>;
  total: number; baixo_estoque: number; pagina: number; tem_mais: boolean;
}

// ── Estoque (tela 05, Onda B). Contrato §9.2 (ERP #8577), 30 por página, por nome. Só leitura. ──
export type FiltroEstoque = 'todos' | 'baixo';
/** Uma linha por variação × loja; só produto que controla estoque e só lojas que o usuário vê. */
export interface ItemEstoque {
  /** variation_location_details.id (a linha), não o produto. */
  id: number; produto_id: number;
  /** Traz a variação quando o produto é variável ("Caneca · Azul"). */
  nome: string;
  /** SKU da variação ou do produto. */
  codigo: string | null;
  qtd: number;
  /** alert_quantity; null = sem mínimo (nunca "baixo"). */
  minimo: number | null;
  unidade: string | null;
  /** Nome da loja. */
  local: string;
  /** "rack · fileira · posição" (product_racks), ou null. */
  prateleira: string | null;
}
export interface ListaEstoque {
  itens: ItemEstoque[]; contadores: Record<FiltroEstoque, number>; pagina: number; tem_mais: boolean;
}

/** Tela 29 · Movimentações, SÓ LEITURA (Onda B). Contrato §9.3 (ERP #8581): 30 por página, do mais novo ao mais
 *  velho, o mesmo histórico da tela web. A tela só sai da demo quando o #8581 estiver em produção (DETALHE_ESTOQUE). A escrita (registrar movimento) espera decisão do Wagner: no ERP cada
 *  tipo é uma transação contábil (entrada = compra; saída/perda = ajuste com FIFO). */
export interface Movimento {
  id: number;
  /** Tipo da transação no ERP (purchase, sell, stock_adjustment, opening_stock, transferência…). */
  tipo: string;
  /** O mesmo texto da tela web ("Compra", "Venda", "Ajuste"…). */
  rotulo: string;
  /** "nº · fornecedor ou cliente" (só o nome), ou null. */
  referencia: string | null;
  /** ISO com hora. */
  quando: string;
  /** Com sinal: entrou +, saiu −. */
  qtd: number;
  /** Saldo acumulado depois deste movimento (calculado pelo ERP). */
  saldo: number;
}
export interface DetalheEstoque { item: ItemEstoque; historico: Movimento[]; pagina: number; tem_mais: boolean }
/** Tela 29 ligada no app de loja: o ERP #8581 está em produção (rota medida respondendo 401 sem token). */
export const DETALHE_ESTOQUE = true;

/** Tela 20 · Novo produto (Onda B escrita), contrato §9.4 (ERP #8582). Decisão [W] 2026-10-02: sem preço — o
 *  produto nasce com preço zerado e o preço se acerta na web, então a tela não grava valor. Só tipo simples. */
export interface OpcoesProduto {
  categorias: Array<{ id: number; nome: string }>;
  /** Unidades do business ("Metro quadrado" / "m²"). Não há m²/un/milheiro fixos. */
  unidades: Array<{ id: number; nome: string; curta: string }>;
}
export interface NovoProduto {
  nome: string; codigo: string | null; categoria_id: number | null; unidade_id: number;
  /** minimo vai como número JSON (ponto decimal): o ERP não passa pelo num_uf. */
  estoque: { controla: boolean; minimo: number | null };
  /** Vai para a loja padrão do usuário (a primeira permitida). */
  prateleira: { rack: string | null; fileira: string | null; posicao: string | null } | null;
  fiscal: { ncm: string | null; cest: string | null; cfop_interno: string | null; cfop_externo: string | null };
}
/** Tela 20 ligada no app de loja: o ERP #8582 está em produção (rotas medidas respondendo 401 sem token). */
export const ESCRITA_PRODUTO = true;

// ── Ordens de serviço (tela 07, Onda D). Formato fechado pela sessão ERP da Onda D: service_orders do
//    OficinaAuto, pipeline FSM oficina_mecanica_os. Lista = OS ativas (etapas terminais não entram). ──
export interface EtapaOs {
  chave: string; rotulo: string;
  /** Posição da etapa entre as não-terminais do pipeline (1 = primeira) e quantas são: desenha a barra de progresso. */
  indice: number; total_etapas: number;
}
export interface OsResumo {
  /** numero vem pronto do ERP, ex.: "OS-00042". */
  id: number; numero: string;
  placa: string | null;
  /** Tipo do veículo (o ERP não guarda marca/modelo); null quando não informado. */
  veiculo: string | null;
  cliente: string;
  /** Soma dos itens (peças + mão de obra), como o card da web; null quando a OS não tem item. */
  valor: number | null;
  etapa: EtapaOs;
  /** Aguardando aprovação ou aguardando peças. */
  travada: boolean;
}
export interface ListaOs {
  itens: OsResumo[];
  /** As etapas não-terminais do pipeline, sempre todas, na ordem do ERP, com a contagem (inclusive 0). */
  etapas: Array<{ chave: string; rotulo: string; total: number }>;
  total: number; travadas: number; pagina: number; tem_mais: boolean;
  /** Pode abrir OS: permissão oficinaauto.service_order.create E processo da oficina cadastrado (ERP #8639). Ausente = não mostra. */
  pode_criar?: boolean;
}
/** Corpo do POST /api/app/os (Nova OS, contrato tela-07, ERP #8639). O servidor fixa tipo mecânica, situação aberta,
 *  entrada agora e a empresa do token, põe a OS na Recepção e liga o veículo se estiver livre. Não gera item, valor nem venda. */
export interface NovaOs {
  vehicle_id: number;
  /** Cliente da OS; null = sem cliente (o veículo segue com o dono dele). */
  contact_id: number | null;
  /** km inteiro ≥ 0 · box até 60 caracteres · observações até 2000. */
  mileage_at_service: number | null; box_label: string | null; notes: string | null;
  /** OS aberta a partir de um agendamento (ERP #8784): na mesma transação o ERP marca o agendamento como atendido e liga à OS.
   *  422 campos.agendamento_id se for de outro veículo, não existir ou não estiver mais aberto (nenhuma OS é criada). */
  agendamento_id?: number | null;
}
/** Agendamento de revisão da Oficina (ERP #8784). "inicio" = "AAAA-MM-DDTHH:MM" no fuso da empresa. */
export interface Agendamento {
  id: number; inicio: string;
  veiculo: { id: number; placa: string; descricao: string | null };
  cliente: { id: number; nome: string } | null;
  observacao: string | null;
  status: 'agendado' | 'atendido' | 'cancelado';
  /** OS aberta a partir dele (status atendido). */
  os_id: number | null;
}
export interface ListaAgendamentos { itens: Agendamento[]; pode_criar?: boolean }
/** Corpo do POST /api/app/agendamentos. Mais de um no mesmo horário é permitido; dia passado é recusado (o próprio dia vale). */
export interface NovoAgendamento { vehicle_id: number; contact_id: number | null; inicio: string; observacao: string | null }
/** Liga a Agenda da Oficina (decisões [W] 2026-10-06). ERP #8784 em produção desde 2026-10-06. */
export const AGENDA_OFICINA = true;
/** Liga "+ Nova OS". Rota do ERP #8639 em produção desde 2026-10-05. */
export const NOVA_OS = true;

/** Tela 03 · Detalhe da OS. Formato fechado pela sessão ERP da Onda D. Totais calculados pelo ERP, nunca pelo app. */
export type TipoItemOs = 'peca' | 'mao_obra' | 'servico_terceiro';
export interface OsDetalhe {
  id: number; numero: string;
  /** Box/elevador como texto livre da OS (ex.: "Elevador 1"); null quando vazio. */
  local: string | null;
  /** Etapa terminal (entregue, cancelado…): indice null e terminal true. OS fora do fluxo da oficina: null. */
  etapa: { chave: string; rotulo: string; indice: number | null; total_etapas: number; terminal?: boolean } | null;
  travada: boolean;
  /** km = na entrada da OS. */
  veiculo: { placa: string | null; descricao: string | null; km: number | null } | null;
  cliente: { id: number; nome: string } | null;
  /** Observações da OS. O ERP não tem queixa nem diagnóstico separados. */
  observacoes: string | null;
  /** Vistoria digital: quantos itens em cada severidade. */
  vistoria: { ok: number; atencao: number; critico: number } | null;
  itens: Array<{ tipo: TipoItemOs; descricao: string; quantidade: number; valor_unitario: number; valor: number }>;
  totais: { pecas: number; mao_de_obra: number; terceiros: number; total: number };
  /** Fotos do laudo: só a contagem. As fotos em si vêm de GET /os/{id}/arquivos (aba Anexos, P2). */
  fotos_laudo: number;
  /** Ações de avanço que saem da etapa atual (contrato tela-03, ERP #8637), na ordem do processo. OS terminal ou fora
   *  do pipeline: []. Cancelar, recusar e garantia nunca vêm (ficam na web). Ausente = ERP sem a rota ainda. */
  acoes?: OsAcao[];
}
/** Uma ação de avanço da OS. `critica` = is_critical ou requires_confirmation (o app confirma antes);
 *  `bloqueio` = "Falta: <requisitos>." quando o gate barra, senão null. */
export interface OsAcao {
  chave: string; rotulo: string; critica: boolean; pode: boolean; bloqueio: string | null;
  /** "encerra" = cancelar OS, recusar orçamento ou acionar garantia (ERP #8646); ausente = avanço. */
  tipo?: 'avanco' | 'encerra';
  /** Etapa para onde a ação leva (ERP #8654); null/ausente = o app usa o texto padrão. */
  destino?: { chave: string; rotulo: string } | null;
  /** O ERP exige motivo (hoje só acionar_garantia, ERP #8654); ausente = o app decide pela chave. */
  motivo_obrigatorio?: boolean;
}
/** Liga "avançar etapa" na tela 03. Rota do ERP #8637 em produção desde 2026-10-05. */
export const ESCRITA_OS = true;
/** Liga cancelar OS e recusar orçamento na tela 03. Rota do ERP #8646 em produção desde 2026-10-05. */
export const ENCERRAR_OS = true;

// P2 · anexos — aba Anexos da OS (telas 03/22). Contrato tela-03-anexos do ERP (#9446): GET e POST /api/app/os/{id}/arquivos.
/** Um anexo da OS. `url` e `miniatura` são assinadas e valem 10 min (abrem sem token); PDF vem com miniatura null. */
export interface AnexoOs {
  id: number; nome: string; tipo: string; tamanho: number;
  legenda: string | null;
  /** Chave da etapa da OS quando o anexo foi enviado (gravada pelo servidor); null nos arquivos antigos. */
  etapa: string | null;
  enviado_em: string; enviado_por: string | null;
  url: string; miniatura: string | null;
}
export interface ListaAnexosOs { itens: AnexoOs[]; pode_enviar: boolean }
/** Arquivo pronto para o POST: conteúdo em base64 (sem o prefixo data:), sempre jpg, png ou pdf. */
export interface ArquivoAnexo { nome: string; tipo: string; base64: string }
/** Parte do multipart como o CapacitorHttp nativo espera (dataType "formData"). */
export interface ParteFormulario { key: string; value: string; type: 'string' | 'base64File'; fileName?: string; contentType?: string }
/** Liga a aba Anexos na tela 03. Desligar se o app for às lojas antes do ERP #9446 em produção. */
export const ANEXOS_OS = true;

/** Tela 08 · Veículos. Formato fechado pela sessão ERP da Onda D (tabela vehicles do OficinaAuto). Busca no servidor
 *  por placa (a principal e a do reboque), tipo ou nome do dono. Sem oficinaauto.vehicle.view → 403 sem_permissao. */
export interface VeiculoResumo {
  id: number; placa: string;
  /** Placa do reboque, quando houver. */
  placa_secundaria: string | null;
  /** Tipo do veículo (o ERP não guarda marca/modelo); null quando não informado. */
  descricao: string | null;
  /** Ano de fabricação/modelo, ex.: "2019/2020". */
  ano: string | null;
  /** Dono do veículo. */
  cliente: string | null;
  /** Id do dono (ERP #8639), para o app sugerir o cliente da Nova OS; ausente = não sugere. */
  cliente_id?: number | null;
  /** Último km conhecido (cadastro ou OS). */
  km: number | null;
  cor: string | null;
  /** Km da próxima revisão (ERP #8750, marcada à mão). Ausente ou null = sem lembrete. */
  proxima_revisao_km?: number | null;
}
export interface ListaVeiculos {
  itens: VeiculoResumo[]; total: number; pagina: number; tem_mais: boolean;
  /** Pode cadastrar veículo (oficinaauto.vehicle.create, ERP #8687). Ausente = não mostra "+ Veículo". */
  pode_criar?: boolean;
  /** Pode editar veículo (oficinaauto.vehicle.update, ERP #8708). Ausente = não mostra "Editar". */
  pode_editar?: boolean;
  /** Quantos veículos estão com revisão próxima ou atrasada (ERP #8750), independente do filtro e da busca. */
  revisao_proxima?: number;
  /** A partir de quantos km antes da revisão o ERP considera "próxima" (o app só mostra). */
  revisao_aviso_km?: number;
}
/** Tipos de veículo do ERP (TiposVeiculo do núcleo), na ordem dele. */
export interface OpcoesVeiculo {
  tipos: Array<{ chave: string; rotulo: string }>;
  /** A empresa tem consulta de placa com fornecedor real (ERP #8695). Ausente = false: o app esconde o "Buscar". */
  consulta_placa?: boolean;
}
/** Corpo do POST /api/app/veiculos (contrato tela-08, ERP #8687). O ERP normaliza as placas e grava na empresa do token;
 *  recusa placa que já esteja em outro veículo ativo (decisão [W]). Só insere o veículo: sem OS, valor, estoque nem cobrança. */
export interface NovoVeiculo {
  placa: string; tipo: string;
  placa_secundaria: string | null; ano_fabricacao: number | null; ano_modelo: number | null;
  cor: string | null; km: number | null; chassi: string | null; renavam: string | null;
  /** Dono do veículo (contato da empresa); null = sem dono. */
  contact_id: number | null;
  /** Km da próxima revisão (ERP #8750): inteiro ≥ 0 (pode ser menor que o km: revisão atrasada é válida) ou null.
   *  Só vai no corpo com REVISAO_KM ligado; aí vai SEMPRE, com o valor atual do formulário (o PUT substitui o cadastro). */
  proxima_revisao_km?: number | null;
}
/** Liga o cadastro de veículo. Rota do ERP #8687 em produção desde 2026-10-05. */
export const NOVO_VEICULO = true;
/** Veículo para editar: GET /api/app/veiculos/{id} (ERP #8708). Os campos do formulário, com o tipo como chave de
 *  veiculos/opcoes e os anos separados. ATENÇÃO: aqui "km" é o do CADASTRO (o que o PUT grava); na lista é o maior
 *  conhecido (cadastro ou OS). O formulário usa o daqui. */
export interface VeiculoEdicao extends NovoVeiculo {
  id: number; cliente: string | null; pode_editar?: boolean;
  /** Pode excluir (oficinaauto.vehicle.delete, ERP #8717; superadmin não entra). Ausente = não mostra "Excluir veículo". */
  pode_excluir?: boolean;
}
/** Liga editar veículo. Rotas do ERP #8708 em produção desde 2026-10-05. */
export const EDITAR_VEICULO = true;
/** Liga o lembrete de revisão por km (decisão [W] 2026-10-06: só a oficina é avisada, no app; conta pelo km real
 *  anotado; próxima revisão manual, aviso 1.000 km antes). ERP #8750 em produção desde 2026-10-06. */
export const REVISAO_KM = true;
/** Liga excluir veículo. Rota do ERP #8717 em produção desde 2026-10-05. */
export const EXCLUIR_VEICULO = true;
/** Resposta da consulta de placa (ERP #8695). Só dados técnicos, sem proprietário (LGPD); marca_modelo é só para mostrar. */
export interface ConsultaPlaca {
  encontrado: boolean; mensagem?: string | null;
  dados?: { placa: string; ano_fabricacao: number | null; ano_modelo: number | null; cor: string | null;
    chassi: string | null; renavam: string | null; marca_modelo: string | null } | null;
  /** A placa já está em outro veículo ativo da empresa: o app oferece usá-lo em vez de cadastrar. */
  veiculo_existente_id?: number | null;
}
/** Histórico de OS do veículo: todas, inclusive encerradas e fora do fluxo, da mais nova para a mais antiga.
 *  `cliente` é o da OS (pode não ser o dono do veículo); `etapa_rotulo` null = OS fora do fluxo da oficina. */
export interface HistoricoVeiculo {
  itens: Array<{ os_id: number; numero: string; data: string; etapa_rotulo: string | null; cliente: string | null; valor: number | null;
    /** Km na entrada da OS (ERP #8732). */
    km?: number | null;
    /** O que foi feito na OS: serviços e peças, sem valor (FORMATO PROVISÓRIO, pedido ao ERP). Ausente = ERP ainda sem
     *  o histórico de serviços: o app mostra só a linha da OS. */
    itens?: Array<{ tipo: TipoItemOs; descricao: string; quantidade: number }>;
    /** Total de itens da OS quando o ERP corta a lista (teto por OS); ausente = vieram todos. */
    itens_total?: number }>;
  /** Km do cadastro do veículo e o dia em que foi cadastrado (ERP #8732). Ausente = ERP
   *  ainda sem o histórico de km: o app esconde a seção "Km registrado". */
  km_cadastro?: number | null;
  cadastrado_em?: string | null;
}
/** Liga o histórico de OS da tela 08. Rota GET /api/app/veiculos/{id}/os no ERP (#8635), até 200 OS, da mais nova para a mais antiga. */
export const HISTORICO_VEICULO = true;

// ── Início (API-CONTRATO-v1 §6, ERP #8495). Bloco null = sem permissão: o app esconde o card. ──
/** Áreas do app (contrato §6): cada uma segue a regra da rota dela — aba visível = rota que responde. */
export type Area = 'inicio' | 'tarefas' | 'pedidos' | 'producao' | 'pessoas' | 'orcamentos' | 'produtos' | 'estoque' | 'financeiro' | 'fiscal' | 'relatorios' | 'dashboard' | 'assistente' | 'equipe' | 'oficina' | 'pagamentos' | 'ponto' | 'ponto_gestor' | 'mais' | 'atendimento';

/** Tela 39 · Marcações a validar (D16, Onda E). Decisão [W] 2026-10-02: só marcações FORA DO GEOFENCE (as
 *  justificativas da tela 38 ficam para outra tela). Contrato §12.1 (ERP #8586).
 *  Validar aceita a marcação; Recusar grava uma ANULAÇÃO — a marcação original nunca muda (Portaria 671). */
export type EstadoValidacao = 'pendente' | 'validada' | 'recusada';
export type FiltroValidacao = EstadoValidacao | 'todas';
export interface MarcacaoAValidar {
  /** UUID da marcação (chave de ponto_marcacoes). */
  id: string; colaborador_nome: string; tipo: string;
  /** Distância até o centro do geofence ("A 84,2 km do local de trabalho"); null sem geofence na empresa. */
  local_texto: string | null;
  /** ISO com hora. */
  marcada_em: string; nsr: number;
  /** Precisão do GPS em metros. Hoje sempre null: o REP-P não grava a precisão na marcação, só no log. */
  gps_precisao_m: number | null;
  dispositivo: string | null; hash_curto: string; estado: EstadoValidacao;
}
export interface ListaValidacao {
  itens: MarcacaoAValidar[]; contadores: Record<FiltroValidacao, number>;
  /** Só quem tem ponto.aprovacoes.manage recusa (regra da web); sem isso recusar devolve 403. Validar é livre. */
  pode_recusar: boolean;
}

/** Tela 26 · Equipe (D16, Onda E). Só leitura. Contrato §12 (ERP #8588): equipe inteira do business, inativos
 *  inclusos, em ordem alfabética; acesso = user.view (sem ela, 403 sem_permissao).
 *  `carga` = OS da Oficina abertas atribuídas ("2 OS"); null sem OS aberta — o ERP não atribui OP a ninguém.
 *  `status` vem montado pelo ERP: Inativo/ausente (usuário inativo) · Em serviço/ocupado (tem carga) · Disponível/livre. */
export type TomStatusEquipe = 'ocupado' | 'livre' | 'ausente';
export interface MembroEquipe { id: number; nome: string; funcao: string | null; carga: string | null; status: { rotulo: string; tom: TomStatusEquipe } }
export interface ListaEquipe { itens: MembroEquipe[] }

/** Tela 25 · Chat (D16, Onda E). Decisão [W] 2026-10-02: quem responde é a JANA (IA do ERP). Contrato §12 (ERP #8596).
 *  Área 'assistente' = módulo Jana no plano + jana.access + jana.chat, como no chat web; as conversas são as mesmas da web. */
export interface MensagemChat { de: 'eu' | 'jana'; texto: string; /** ISO com hora. */ criada_em: string }
export interface RespostaChat { conversa_id: string; resposta: MensagemChat }
export interface ConversaChat { conversa_id: string; mensagens: MensagemChat[] }

/** Tela 04 · Orçamentos (D16, Onda A). Contrato §2.1 (ERP #8555), 20 por página. `validade` e `area_m2`
 *  saem sempre null hoje (o ERP não guarda); a tela esconde os dois quando vêm null. */
export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'convertido';
export type FiltroOrcamentos = 'todos' | StatusOrcamento;
export interface OrcamentoResumo {
  id: number; numero: string;
  /** Nome do 1º item (como o resumo do pedido); null se não tiver item. */
  titulo: string | null;
  cliente: string; validade: string | null; status: StatusOrcamento; valor: number;
  /** Área total em m² (comunicação visual); null quando não se aplica. */
  area_m2: number | null;
  itens: number;
}
export interface ListaOrcamentos {
  itens: OrcamentoResumo[]; contadores: Record<FiltroOrcamentos, number>; pagina: number; tem_mais: boolean;
}
// P4 · orçamento rápido (tela 04, ERP PR 16 — memory/requisitos/AppMobile/api/tela-04-orcamento-rapido.md). Regra mestre:
// o app nunca calcula; mostra o que o /calcular devolveu e manda o mesmo total em `total_previsto` (dupla prova no ERP).
// Medidas e quantidade vão como TEXTO com ponto ("3.00", "1"): número em JSON é recusado (422).
export interface MaterialOrcamento { id: number; nome: string; categoria: string; unidade: string; preco_m2: number }
export interface CorpoCalculoOrcamento { material_id: number; largura_m: string; altura_m: string; quantidade: string }
/** 200 do /calcular: os números do ERP (área com 3 casas, total com 2). Não grava nada. */
export interface CalculoOrcamento { area_m2: number; preco_m2: number; total: number }
export interface CorpoNovoOrcamento { cliente_id: number | null; itens: Array<CorpoCalculoOrcamento & { total_previsto: string }> }
/** 201 do POST /orcamentos (200 na repetição da chave). `numero` = "ORC-<ano>-<5 dígitos>". */
export interface OrcamentoCriado { id: number; numero: string; status: 'rascunho'; total: number }
export interface PainelInicio {
  /** D6: colaborador abre direto no ponto; quem tem o ERP vê as abas da v1. */
  perfil: 'erp' | 'colaborador';
  abre_em: 'inicio' | 'ponto' | 'mais';
  /** Lista ordenada; "mais" sempre presente. */
  areas: Area[];
  /** Tela 30 (ERP #8592): módulos da barra entre Início e Mais, até 3, na ordem. Sempre = escolha salva ∩ areas;
   *  sem escolha (ou se nada sobrar), o padrão do ERP (tarefas, pedidos, producao, completado com outras áreas).
   *  Ausente/null = ERP sem a rota (versão antiga): o app usa o padrão dele. */
  barra?: Area[] | null;
  usuario: string; empresa: string;
  /** Só com dashboard.data. */
  faturado_hoje: { valor: number; ontem: number; variacao_pct: number | null } | null;
  /** Meta mensal da Jana ÷ dias úteis do mês; sempre derivada. Só com dashboard.data. */
  meta_dia: { valor: number; derivada: true } | null;
  kpis: { pedidos_ativos: number | null; pedidos_atrasados: number | null; estoque_baixo: number | null };
  /** Só com acesso ao Financeiro. */
  financeiro: { a_receber: number; a_pagar: number } | null;
  /** Até 3, mesmo item de /tarefas. */
  proximas_tarefas: Tarefa[];
  /** Notificações não lidas, para o ponto no sino (pedido ao ERP; ausente = sem ponto). */
  nao_lidas?: number | null;
  /** Ajustes da empresa (contrato §6.2, ERP #9442). O `api.inicio()` sempre devolve completo: o ERP antigo
   *  não manda o bloco e o app usa o padrão (ajustes-regras.ts). As telas leem por `useAjustes()` (ajustes.ts). */
  ajustes: AjustesEmpresa;
}

/** Tela 16 · Notificações (D16, Onda A). Contrato §6.1 (ERP #8557): tabela notifications do Laravel (o sino da web),
 *  20 por página, da mais nova para a mais antiga. `texto` sai null hoje; só tarefa nova traz destino (id "todo:<n>"). */
export type DestinoNotificacao = 'pedido' | 'orcamento' | 'tarefa' | 'ponto' | 'producao';
export interface Notificacao {
  id: string;
  /** Chip de origem: FIN, TAR, RH, CRM, IA, PAT, LOJ, DOC ou SIS (as sem cor própria saem em chip neutro). */
  origem: string;
  titulo: string; texto: string | null; lida: boolean;
  /** ISO com hora. */
  quando: string;
  destino: { tipo: DestinoNotificacao | null; id: number | string | null };
}
export interface ListaNotificacoes { itens: Notificacao[]; nao_lidas: number; pagina: number; tem_mais: boolean }

// ── Venda rápida (tela 11, D16 Onda A). Formato fechado com a sessão ERP da tela 11 em 2026-10-02; PR do ERP ainda em
//    rascunho. Mexe em VALOR e ESTOQUE (regra mestre Tier 0). A venda nasce pelo TransactionUtil como venda direta
//    (status final, fora da FSM), no 1º local ativo do usuário, e baixa o estoque na criação. ──
/** GET /api/app/venda/produtos?q=: até 20 itens; `id` é a variação; `estoque` null = o produto não controla estoque. */
export interface ListaProdutosVenda {
  itens: ProdutoVenda[];
  /** Ajuste da empresa (configurações de venda na web). true = produto com preço R$ 0,00 não se vende pelo app.
   *  Padrão false (decisão [W] 2026-10-05). Ausente (ERP antigo) = false. */
  bloqueia_preco_zero?: boolean;
}
/** 201 do POST /api/app/vendas. Repetir a mesma Idempotency-Key com o mesmo corpo devolve 200 com a MESMA venda. */
export interface VendaCriada {
  id: number;
  /** invoice_no do ERP. */
  numero: string;
  /** ISO com hora, do servidor. */
  data: string;
  /** Total recalculado e gravado pelo ERP, em reais. É o valor que a tela mostra. */
  total: number;
  /** Linhas como o ERP gravou. */
  itens: Array<{ variacao_id: number; nome: string; quantidade: number; preco_unitario: number; subtotal: number }>;
  /** Rótulo da forma de pagamento no ERP (o do PIX é configurável por empresa). */
  metodo: string;
}

/** Tela 06 · Financeiro (D16, Onda C) — só leitura. Contrato §10.1 (ERP #8584). 20 por página; receber/pagar = em aberto
 *  (aberto + parcial, valor = valor em aberto) por vencimento; extrato = quitados com última baixa no mês (valor = baixas).
 *  `resumo` e `contas` não mudam com a aba; só `itens` e a paginação. Valor sempre positivo: o sinal vem de `tipo`. */
export type AbaFinanceiro = 'receber' | 'pagar' | 'extrato';
export type StatusLancamento = 'aberto' | 'vencido' | 'liquidado';
export interface Lancamento {
  id: number; tipo: 'receber' | 'pagar'; descricao: string; parte: string | null;
  vencimento: string | null; pago_em: string | null; valor: number; status: StatusLancamento;
  /** Campos do filtro avançado (proposta para o §10.1, ainda não no ERP): opcionais até a rota mandar.
   *  `competencia` é AAAA-MM; as outras datas AAAA-MM-DD. */
  emissao?: string | null; competencia?: string | null; venda_em?: string | null; forma_pagamento?: string | null;
  conta_id?: number | null; nf_numero?: string | null; nosso_numero?: string | null;
  /** Conta do plano de contas (código "2.1.01") e nome; nº do documento; excluído no ERP (só vem com `registro=`). */
  plano_codigo?: string | null; plano_nome?: string | null; documento?: string | null; excluido?: boolean;
  /** Nº do contrato (lançamentos de recorrência). */
  contrato?: string | null;
}
/** GET /api/app/financeiro/lancamentos/{id} (formato proposto). `historico`: o que aconteceu, do mais antigo ao mais novo. */
export interface LancamentoDetalhe extends Lancamento {
  parte_id: number | null; observacao: string | null; recorrencia_id: number | null; parcela: string | null;
  conta_nome: string | null; motivo_exclusao: string | null; historico: Array<{ quando: string; texto: string }>;
  /** Pagamento parcial: o lançamento novo criado com o restante (neste) e de onde este restante veio (no novo). */
  restante: { id: number; valor: number; vencimento: string } | null;
  origem_id: number | null;
}
export interface PainelFinanceiro {
  /** `vencido` = parte vencida do a receber (já contida em `a_receber`). */
  resumo: { mes: string; recebido: number; pago: number; saldo: number; a_receber: number; vencido: number; a_pagar: number };
  /** `saldo` null quando o ERP não sabe o saldo da conta; `detalhe` é texto pronto (banco · agência). */
  contas: Array<{ id: number; nome: string; detalhe: string | null; saldo: number | null }>;
  itens: Lancamento[]; contadores: Record<AbaFinanceiro, number>; pagina: number; tem_mais: boolean;
  /** Formas de pagamento da empresa para o filtro avançado; sem ela, o app usa FORMAS_PADRAO. */
  formas_pagamento?: string[];
  /** Contagem por caixa de seleção (já com o filtro avançado), quando a rota recebe `situacao=`. */
  contadores_situacao?: Record<Situacao, number>;
  /** Plano de contas da empresa (grupos e contas, na ordem do código) para o filtro avançado; sem ele, o filtro some. */
  planos_conta?: Array<{ codigo: string; nome: string; tipo?: 'receita' | 'despesa' }>;
}
/** Liga o "Filtro avançado" do Financeiro. Só na demo até o ERP aceitar os filtros na rota §10.1
 *  (parâmetros em financeiro-filtros.ts → paramsFiltros); com o ERP pronto, vira true. */
export const FILTRO_FINANCEIRO = DEMO;
/** Liga "+ Novo" no Financeiro (POST /api/app/financeiro/lancamentos, formato em lancamento-regras.ts). Mexe em valor:
 *  regra mestre Tier 0 (dupla prova e ok do [W]). Só na demo até o ERP ter a rota. */
export const NOVO_LANCAMENTO = DEMO;
/** Liga a aba Recorrências do Financeiro (contratos e contas fixas, com "Interromper"). Só na demo até o ERP ter as rotas. */
export const RECORRENCIAS = DEMO;
/** Liga o detalhe do lançamento (tocar no cartão) com Receber/Pagar, Alterar, Excluir, Retornar e Reativar.
 *  Baixa e estorno mexem em valor: regra mestre Tier 0. Só na demo até o ERP ter as rotas. */
export const LANCAMENTO_ACOES = DEMO;
/** Recorrência (contrato ou conta fixa). `proxima_geracao`: dia em que o ERP cria o próximo lançamento (null se o
 *  contrato terminou); `gerados`: quantos lançamentos ela já criou. */
export interface Recorrencia {
  id: number; tipo: 'receber' | 'pagar'; descricao: string; parte: string | null; plano_nome: string | null; valor: number;
  frequencia: Frequencia; dia_geracao: number; dia_vencimento: number; inicio: string; termino: string | null;
  proxima_geracao: string | null; proximo_vencimento: string | null; gerados: number;
  status: 'ativa' | 'interrompida'; interrompida_em: string | null; contrato: string | null;
}

/** Tela 14 · Fiscal (D16, Onda C) — só leitura. Contrato §10.2 (ERP #8593). Emitir, consultar a SEFAZ,
 *  cancelar e abrir o DANFE ficam para o PR de escrita. */
export type StatusFiscal = 'rascunho' | 'processando' | 'autorizado' | 'cancelado' | 'rejeitado';
export type FiltroFiscal = 'todos' | StatusFiscal;
export interface DocumentoFiscal {
  /** Id da tabela de origem: NF-e e NFS-e podem repetir o mesmo número — a chave na lista é tipo + id (§10.2, ERP #8593). */
  id: number; tipo: 'NFe' | 'NFCe' | 'NFSe'; numero: string | null;
  /** Texto pronto, ex.: "Pedido #4790 · Clínica Vita". */
  referencia: string | null; valor: number; status: StatusFiscal;
  /** Chave de acesso (só autorizado). */
  chave: string | null;
  /** Motivo da rejeição, em PT-BR. */
  erro: string | null; emitido_em: string | null;
}
export interface ListaFiscal { itens: DocumentoFiscal[]; contadores: Record<FiltroFiscal, number>; pagina: number; tem_mais: boolean }

/** Tela 13 · Relatórios (D16, Onda C) — só leitura. Contrato §10.3 (entrou no ERP com o #8599). Só o bloco da aba pedida vem
 *  preenchido (os outros null). Permissão por bloco: `kpis` e `dre` seguem o Financeiro (sem ele, null), `vendas` o
 *  dashboard.data, `producao` quem vê vendas, `estoque` o stock_report.view. Exportar PDF/Excel fica no computador. */
export type PeriodoRelatorio = 'mes' | 'trimestre' | 'ano';
export type AbaRelatorio = 'dre' | 'vendas' | 'producao' | 'estoque' | AbaRelatorioP6;
export interface Relatorios extends RelatoriosP6 {
  periodo: { de: string; ate: string };
  /** null sem acesso ao Financeiro. `margem_pct` = saldo ÷ receitas × 100, null sem receita. */
  kpis: { receitas: number; despesas: number; saldo: number; margem_pct: number | null } | null;
  dre: { receitas_por_categoria: Array<{ nome: string; valor: number }>; despesas_por_categoria: Array<{ nome: string; valor: number }> } | null;
  /** `receita_por_dia`: últimos 14 dias; `top_clientes`: até 5. */
  vendas: { receita_por_dia: Array<{ data: string; valor: number }>; top_clientes: Array<{ nome: string; valor: number }> } | null;
  /** Mesma fila da Produção (§5), agora. */
  producao: { por_etapa: Array<{ rotulo: string; total: number }> } | null;
  /** Só com stock_report.view. */
  estoque: { baixo: Array<{ nome: string; quantidade: number; minimo: number; unidade: string | null }> } | null;
}

// P6 · lucratividade — abas `lucratividade` e `comissoes` da tela 13 (ERP #9448, api/tela-13-lucratividade.md). Só leitura:
// o app mostra os números do ERP e não refaz conta nenhuma. Bloco sem permissão → null (o app avisa e o Dashboard esconde o cartão).
export type AbaRelatorioP6 = 'lucratividade' | 'comissoes';
export interface MenorMargem { pedido_id: number; numero: string; resumo: string; valor: number; margem_pct: number }
/** Os números do Lucro/Prejuízo web no período (`getProfitLossDetails`). Exige `dashboard.data`. */
export interface Lucratividade {
  receita: number; custo_variavel: number; custo_fixo: number; margem_contribuicao: number;
  /** null sem receita. */
  margem_pct: number | null;
  /** null sem receita ou com margem ≤ 0. */
  ponto_equilibrio: number | null;
  /** Até 5 vendas finais do período, menor margem primeiro. */
  menores_margens: MenorMargem[];
}
/** `invoice_value` = sobre a venda; `payment_received` = sobre o recebido (pos_settings.cmmsn_calculation_type). */
export type BaseComissao = 'invoice_value' | 'payment_received';
export interface ComissaoVendedor { id: number; nome: string; percentual: number; vendido: number; recebido: number; comissao: number; a_liberar: number }
/** Com `commission_agent.view`, todos; sem ela, o vendedor vê só a própria linha (ajuste `app_comissao_vendedor_ve_propria`). */
export interface Comissoes { base: BaseComissao; vendedores: ComissaoVendedor[] }
export interface RelatoriosP6 {
  /** Ausente em ERP anterior ao #9448 — trate como null. */
  lucratividade?: Lucratividade | null;
  comissoes?: Comissoes | null;
}

/** Tela 35 · Dashboard (D16, Onda C) — só leitura. Contrato §10.4 (ERP #8599). Sem `dashboard.data` → 403 e a área
 *  não aparece. Por bloco: faturamento e meta com `dashboard.data`; pedidos e produção com a regra de quem vê vendas
 *  (§2/§5) — sem ela vêm null; `a_receber`/`vencido` com o Financeiro (mesmo serviço da tela 06) — sem ele, null. */
export interface Dashboard {
  /** `serie_semanal`: os 7 últimos dias, dia a dia (antigo → hoje); `variacao_pct` null sem base de comparação. */
  faturamento_30d: { valor: number; variacao_pct: number | null; serie_semanal: number[] };
  /** `pedidos_novos` = pedidos de hoje; `producao_em_curso` = coluna "em produção". */
  kpis: { pedidos_ativos: number | null; pedidos_novos: number | null; producao_em_curso: number | null; a_receber: number | null; vencido: number | null };
  /** Últimos 14 dias, do mais antigo para hoje; null sem acesso a vendas. */
  pedidos_por_dia: Array<{ data: string; total: number }> | null;
  /** Meta mensal da Jana; null quando não há meta cadastrada. `realizado_pct` inteiro. */
  meta_mes: { valor: number; realizado_pct: number } | null;
  /** concluídas = coluna "pronto para faturar"; total = soma das 4 colunas. null sem acesso a vendas. */
  producao_concluida: { concluidas: number; total: number } | null;
}

/** Tela 15 · Pagamentos (D16, Onda C) — leitura. Contrato §10.5 (ERP #8600): tabela `cobrancas`, a mesma da web
 *  /financeiro/cobranca; cobrança recusada pelo gateway não aparece; valor em reais; regra de acesso do Financeiro.
 *  Gerar link, cancelar e consultar o provedor mexem em valor: PR de escrita, pela regra mestre. */
export type StatusPagamento = 'pendente' | 'pago' | 'vencido' | 'cancelado';
export type FiltroPagamentos = 'todos' | StatusPagamento;
export type MetodoPagamento = 'qualquer' | 'pix' | 'boleto' | 'cartao';
export interface LinkPagamento {
  id: number;
  /** Texto pronto, ex.: "Pedido #4807 · Mercado Bom Preço". */
  descricao: string; valor: number; vencimento: string | null; metodo: MetodoPagamento; status: StatusPagamento;
  pago_em: string | null;
  /** PDF do boleto; null em PIX (e quando o provedor não devolveu). Bolepix sai com `metodo` "qualquer". */
  link: string | null;
}
/** Documento que pode virar link de pagamento (GET /api/app/pagamentos/referencias). `valor` = SALDO EM ABERTO do
 *  documento (decisão [W], 2026-10-02) e é só para exibir: o POST não manda valor — o ERP calcula o mesmo saldo. */
export interface ReferenciaCobranca { tipo: TipoReferencia; id: number; rotulo: string; cliente: string; valor: number }
export interface ListaPagamentos { itens: LinkPagamento[]; contadores: Record<FiltroPagamentos, number>; pagina: number; tem_mais: boolean }

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
  /** Erros por campo de um 422 ({ erro: "validacao", campos: { campo: "mensagem" } }). */
  constructor(public status: number, public codigo: string, mensagem: string, public campos?: Record<string, string>,
    /** Resto do corpo do erro (ex.: veiculo_existente_id na placa repetida). */
    public extra?: Record<string, unknown>) { super(mensagem); }
}

/** Erros por campo de qualquer erro (da API ou da demo). */
export const camposDoErro = (e: unknown): Record<string, string> =>
  ((e as { campos?: Record<string, string> } | null)?.campos) ?? {};

/** Placa repetida (ERP #8687): id do veículo ativo que já tem a placa, quando o erro traz; senão null. */
export function veiculoExistenteDoErro(e: unknown): number | null {
  const x = e as { extra?: Record<string, unknown>; veiculo_existente_id?: unknown } | null;
  const v = x?.extra?.veiculo_existente_id ?? x?.veiculo_existente_id;
  return typeof v === 'number' ? v : null;
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
  if (DEMO) { await demo.entrar(usuario, senha); token = 'demo'; await guardarDono(usuario); return; }
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
  // Biometria ligada (P9): o token novo vai para o Keychain/Keystore, não para o Preferences.
  if (await biometriaLigada()) await guardarTokenSeguro(token);
  else await Preferences.set({ key: CHAVE_TOKEN, value: token });
  // Fila do apontamento (P8): os toques guardados sem internet são de quem entrou.
  await guardarDono(usuario);
}

export async function sair(): Promise<void> {
  token = null;
  limparAjustes();
  // A biometria é escolha de quem ligou (ADR 0432): saiu da conta, desliga e apaga o token seguro.
  await marcarDesligada();
  if (DEMO) { demo.sair(); return; }
  await Preferences.remove({ key: CHAVE_TOKEN });
}

// ── Entrar com biometria (P9, ADR 0432 do ERP) ─────────────────────────────────────────────────────
// A biometria só destrava o token guardado no aparelho; nada vai ao servidor. A senha continua valendo.

/** Ao abrir o app: a biometria está ligada e o celular ainda a tem → a tela pede a digital antes de entrar.
 *  Biometria apagada do celular: desliga e o token volta ao Preferences (o app abre como antes). */
export async function precisaDestravar(): Promise<boolean> {
  if (!(await biometriaLigada())) return false;
  if (await celularTemBiometria()) return true;
  await desligarBiometria();
  return false;
}

/** Depois que a biometria confirmou: carrega o token do armazenamento seguro. false = não havia token (entra com senha). */
export async function destravarToken(): Promise<boolean> {
  const t = await lerTokenSeguro();
  if (!t) return false;
  token = t;
  if (DEMO) demo.retomar();
  return true;
}

/** Liga em Conta: pede a biometria uma vez (é a pessoa quem escolhe) e passa o token para o armazenamento seguro. */
export async function ligarBiometria(): Promise<ResultadoBiometria> {
  if (!token) return 'indisponivel';
  const r = await conferirBiometria();
  if (r !== 'ok') return r;
  await marcarLigada(token);
  if (!DEMO) await Preferences.remove({ key: CHAVE_TOKEN });
  return 'ok';
}

/** Desliga (em Conta, ou porque a empresa desligou `app_biometria_login`): o token deixa de ficar preso à biometria. */
export async function desligarBiometria(): Promise<void> {
  if (!(await biometriaLigada())) return;
  const t = (await marcarDesligada()) ?? token;
  if (t && !DEMO) await Preferences.set({ key: CHAVE_TOKEN, value: t });
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

/** Uma leitura terminou em servidor fora / sem rede (e nenhuma deu certo depois). O App usa para
 *  recarregar a tela quando o app volta do segundo plano ou a internet volta. */
let leituraFalhou = false;
export const houveFalhaDeLeitura = () => leituraFalhou;

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
/** 5xx com `erro` no corpo é resposta do ERP (ex.: 503 sem_configuracao da oficina): não é queda, não repete. */
const respostaDoErp = (r: HttpResponse) => !!r.data && typeof r.data === 'object' && 'erro' in (r.data as object);

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE', caminho: string, corpo?: unknown, extra: Record<string, string> = {},
  /** "formData" = multipart (corpo = ParteFormulario[]); o nativo monta o boundary. */
  dataType?: 'formData'): Promise<T> {
  if (DEMO) return demo.chamar<T>(metodo, caminho, corpo, extra);
  let r: HttpResponse | null = null;
  for (let tentativa = 0; ; tentativa++) {
    r = null;
    try {
      r = await CapacitorHttp.request({
        method: metodo,
        url: `${BASE}${caminho}`,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
          ...extra,
        },
        data: corpo,
        dataType,
      });
    } catch { /* sem resposta: status 0 */ }
    const status = r ? r.status : 0;
    if (r && respostaDoErp(r)) break;
    if (!deveRetentar(metodo, status, tentativa)) break;
    const h = r?.headers ?? {};
    await dormir(esperaMs(tentativa, h['Retry-After'] ?? h['retry-after']));
  }
  if (!r) {
    if (metodo === 'GET') leituraFalhou = true;
    throw new ErroApi(0, 'rede', 'Sem conexão com o servidor. Verifique a internet.');
  }
  if (metodo === 'GET') leituraFalhou = transitorio(r.status) && !respostaDoErp(r);
  if (transitorio(r.status) && !respostaDoErp(r)) {
    // Página HTML do deploy / LiteSpeed, ou o JSON cru do Laravel ("Service Unavailable"): mensagem nossa.
    throw new ErroApi(r.status, 'indisponivel', MSG_INDISPONIVEL);
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
    const campos = d.campos && typeof d.campos === 'object' ? (d.campos as Record<string, string>) : undefined;
    const msg = (primeiro ?? d.mensagem ?? d.message ?? (campos ? Object.values(campos)[0] : undefined) ?? 'Algo deu errado. Tente de novo.') as string;
    throw new ErroApi(r.status, String(d.erro ?? 'erro'), msg, campos, d);
  }
  return r.data as T;
}

/** Porta única do cadastro de produto (ESCRITA_PRODUTO desligada = nada sai do aparelho). */
function escritaProduto<T>(metodo: 'GET' | 'POST', caminho: string, corpo?: unknown): Promise<T> {
  if (!ESCRITA_PRODUTO) return Promise.reject(new ErroApi(0, 'indisponivel', 'Cadastro de produto pelo app ainda não está disponível.'));
  return chamar<T>(metodo, caminho, corpo);
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
  pessoas: (papel: FiltroPessoas, pagina = 1, q = '') =>
    chamar<ListaPessoas>('GET', `/api/app/pessoas?papel=${papel}&pagina=${pagina}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  pessoa: (id: number) => chamar<PessoaDetalhe>('GET', `/api/app/pessoas/${id}`),
  pessoaCadastro: (id: number) => chamar<PessoaCadastro>('GET', `/api/app/pessoas/${id}/cadastro`),
  /** Tela 09 · Nova pessoa. 201 { id } · 422 { erro: "validacao", campos } · 403 sem permissão para o papel. */
  criarPessoa: (p: NovaPessoa) => chamar<{ id: number }>('POST', '/api/app/pessoas', p),
  /** Editar cadastro (tela 34). PATCH PARCIAL: só as chaves enviadas mudam; null limpa o campo. Mesmas regras do POST
   *  (422 com `campos`); 403 sem_permissao (cliente exige customer.update, fornecedor supplier.update); 404 nao_encontrado. */
  editarPessoa: (id: number, p: EdicaoPessoa) => chamar<{ id: number }>('PATCH', `/api/app/pessoas/${id}`, p),
  /** "Buscar" do CEP na tela 09 (contrato §4.3, ERP #8560): proxy com cache do ERP, 60 buscas/min.
   *  404 nao_encontrado (CEP inexistente ou serviço fora) · 422 validacao (não tem 8 dígitos) ·
   *  429 é o throttle padrão do Laravel ({ message: "Too Many Attempts." } + Retry-After), tratado pelo status. */
  cep: (cep: string) => chamar<EnderecoCep>('GET', `/api/app/cep/${cep.replace(/\D/g, '')}`),
  producao: () => chamar<FilaProducao>('GET', '/api/app/producao'),
  /** Tela 19 · Produtos (contrato §9.1). Sem product.view → 403 sem_permissao. */
  produtos: (categoria: number | 'todas', pagina = 1, q = '') =>
    chamar<ListaProdutos>('GET', `/api/app/produtos?categoria=${categoria}&pagina=${pagina}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  /** Tela 05 · Estoque (contrato §9.2). Sem product.view → 403 sem_permissao. */
  estoque: (filtro: FiltroEstoque, pagina = 1, q = '') =>
    chamar<ListaEstoque>('GET', `/api/app/estoque?filtro=${filtro}&pagina=${pagina}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  /** Tela 29 · saldo e histórico de uma linha do estoque (contrato §9.3). 403 sem_permissao · 404 linha de outra empresa ou de loja não permitida. */
  estoqueDetalhe: (id: number, pagina = 1) => (DETALHE_ESTOQUE
    ? chamar<DetalheEstoque>('GET', `/api/app/estoque/${id}?pagina=${pagina}`)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Movimentações pelo app ainda não estão disponíveis.'))),

  /** Tela 20 · categorias e unidades do business (contrato §9.4). */
  opcoesProduto: () => escritaProduto<OpcoesProduto>('GET', '/api/app/produtos/opcoes'),
  /** Tela 20 · Novo produto. 201 { id, codigo } · 422 { erro: "validacao", campos } (chaves aninhadas, ex. "fiscal.ncm";
   *  unidade ou categoria de outra empresa voltam em unidade_id / categoria_id) · 403 sem_permissao (product.create). */
  criarProduto: (p: NovoProduto) => escritaProduto<{ id: number; codigo: string }>('POST', '/api/app/produtos', p),
  /** Tela 07 · Ordens de serviço. `etapa` = chave ou "todas"; 20 por página, etapa mais avançada primeiro.
   *  Sem oficinaauto.service_order.view ou sem o módulo no pacote → 403 sem_permissao. */
  os: (etapa: string, pagina = 1) =>
    chamar<ListaOs>('GET', `/api/app/os?etapa=${encodeURIComponent(etapa)}&pagina=${pagina}`),
  /** Tela 03 · Detalhe da OS. OS de outra empresa ou inexistente → 404 nao_encontrado. */
  osDetalhe: (id: number) => chamar<OsDetalhe>('GET', `/api/app/os/${id}`),
  /** Tela 03 · avançar etapa (FSM do ERP, sem efeito em estoque ou valor). 200 = a OS já na etapa nova ·
   *  422 bloqueado (gate) ou nao_suportada (fora das 7 ações, ou ação com efeito colateral no banco) ·
   *  409 etapa_mudou · 403 sem_permissao · 404 nao_encontrado · throttle 30/min. Contrato tela-03 (ERP #8637). */
  executarAcaoOs: (id: number, chave: string, motivo: string | null = null) => (ESCRITA_OS
    ? chamar<OsDetalhe>('POST', `/api/app/os/${id}/acoes/${encodeURIComponent(chave)}`, motivo ? { motivo } : undefined)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Mudar a etapa pelo app ainda não está disponível.'))),
  /** P2 · anexos da OS, do mais novo para o mais antigo (até 100). 403 sem_permissao · 404 nao_encontrado. */
  anexosOs: (id: number) => chamar<ListaAnexosOs>('GET', `/api/app/os/${id}/arquivos`),
  /** P2 · envia um anexo (multipart). 201 = o item · 413 arquivo_grande · 422 validacao (campos.arquivo, campos.origem com
   *  a câmera desligada nos ajustes) ou idempotencia_conflito · 409 em_andamento · 403 · 404 · 429. `chave` = Idempotency-Key. */
  enviarAnexoOs: (id: number, arquivo: ArquivoAnexo, origem: 'camera' | 'galeria', chave: string, legenda: string | null = null) =>
    chamar<AnexoOs>('POST', `/api/app/os/${id}/arquivos`, [
      { key: 'arquivo', value: arquivo.base64, type: 'base64File', fileName: arquivo.nome, contentType: arquivo.tipo },
      { key: 'origem', value: origem, type: 'string' },
      ...(legenda ? [{ key: 'legenda', value: legenda, type: 'string' as const }] : []),
    ] satisfies ParteFormulario[], { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': chave }, 'formData'),
  /** Tela 08 · Veículos. */
  /** Nova OS. 201 = o mesmo JSON do GET /api/app/os/{id} · 422 { erro: "validacao", campos } (vehicle_id, contact_id…) ·
   *  403 sem_permissao · 503 sem_configuracao (módulo ausente) · throttle 30/min. Contrato tela-07 (ERP #8639). */
  criarOs: (p: NovaOs) => (NOVA_OS
    ? chamar<OsDetalhe>('POST', '/api/app/os', p)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Abrir OS pelo app ainda não está disponível.'))),
  /** Tipos de veículo para o cadastro (ERP #8687), na ordem do ERP. */
  opcoesVeiculo: () => (NOVO_VEICULO
    ? chamar<OpcoesVeiculo>('GET', '/api/app/veiculos/opcoes')
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Cadastrar veículo pelo app ainda não está disponível.'))),
  /** Consulta de placa (ERP #8695). Só é chamada quando opcoes.consulta_placa é true.
   *  200 encontrado / não encontrado / placa já ativa (veiculo_existente_id) · 422 validacao · 429 throttle 10/min ·
   *  502 indisponivel · 503 sem_configuracao · 403 sem_permissao. */
  consultaPlaca: (placa: string) => chamar<ConsultaPlaca>('GET', `/api/app/veiculos/consulta-placa/${encodeURIComponent(placa)}`),
  /** Cadastrar veículo. 201 = o item no formato da lista · 422 { erro: "validacao", campos, veiculo_existente_id? } ·
   *  403 sem_permissao · 503 sem_configuracao. Contrato tela-08 (ERP #8687). */
  criarVeiculo: (v: NovoVeiculo) => (NOVO_VEICULO
    ? chamar<VeiculoResumo>('POST', '/api/app/veiculos', v)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Cadastrar veículo pelo app ainda não está disponível.'))),
  /** Veículo para editar (ERP #8708). 404 nao_encontrado (outra empresa ou inexistente) · 403 sem vehicle.view. */
  veiculo: (id: number) => (EDITAR_VEICULO
    ? chamar<VeiculoEdicao>('GET', `/api/app/veiculos/${id}`)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Editar veículo pelo app ainda não está disponível.'))),
  /** Salvar a edição (ERP #8708). Mesmo corpo do cadastro. 200 = o item no formato da lista ·
   *  422 { erro: "validacao", campos, veiculo_existente_id? } (a placa só é conferida se MUDAR) · 403 · 404 · 503.
   *  Só atualiza o veículo: sem valor, estoque nem cobrança; km menor que o atual é aceito. */
  editarVeiculo: (id: number, v: NovoVeiculo) => (EDITAR_VEICULO
    ? chamar<VeiculoResumo>('PUT', `/api/app/veiculos/${id}`, v)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Editar veículo pelo app ainda não está disponível.'))),
  /** Excluir veículo (ERP #8717): soft delete, sem como restaurar pela web. 200 { ok: true } · 404 nao_encontrado ·
   *  403 sem_permissao · 503 sem_configuracao · 409 { erro: "em_uso", mensagem, os_abertas } quando há OS em andamento
   *  (decisão [W]). Libera a placa; sem valor, estoque nem cobrança. */
  excluirVeiculo: (id: number) => (EXCLUIR_VEICULO
    ? chamar<unknown>('DELETE', `/api/app/veiculos/${id}`)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'Excluir veículo pelo app ainda não está disponível.'))),
  /** Lista de veículos. revisao = só os com revisão próxima ou atrasada (?revisao=1, ERP #8750). */
  /** Agenda da Oficina entre dois dias (inclusive), por horário (ERP #8784; janela máxima 92 dias). 403 sem ver OS. */
  agendamentos: (de: string, ate: string) => (AGENDA_OFICINA
    ? chamar<ListaAgendamentos>('GET', `/api/app/agendamentos?de=${de}&ate=${ate}`)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'A agenda da oficina ainda não está disponível no app.'))),
  /** Agendar revisão. 201 = o item · 422 { erro: "validacao", campos } (inicio no passado, vehicle_id…) · 403 · 503. */
  criarAgendamento: (a: NovoAgendamento) => (AGENDA_OFICINA
    ? chamar<Agendamento>('POST', '/api/app/agendamentos', a)
    : Promise.reject(new ErroApi(0, 'indisponivel', 'A agenda da oficina ainda não está disponível no app.'))),
  /** Cancelar agendamento (motivo opcional). 200 = o item · 422 { erro: "estado_invalido", mensagem } se já foi atendido ou
   *  cancelado · 404 nao_encontrado (outra empresa ou inexistente) · 403. */
  cancelarAgendamento: (id: number, motivo: string | null) => (AGENDA_OFICINA
    ? chamar<Agendamento>('POST', `/api/app/agendamentos/${id}/cancelar`, { motivo })
    : Promise.reject(new ErroApi(0, 'indisponivel', 'A agenda da oficina ainda não está disponível no app.'))),
  veiculos: (pagina = 1, q = '', revisao = false) =>
    chamar<ListaVeiculos>('GET', `/api/app/veiculos?pagina=${pagina}${q ? `&q=${encodeURIComponent(q)}` : ''}${revisao ? '&revisao=1' : ''}`),
  /** Histórico de OS do veículo (tela 08, ao expandir). Pede permissão de veículo e de OS. */
  veiculoOs: (id: number) => chamar<HistoricoVeiculo>('GET', `/api/app/veiculos/${id}/os`),
  notificacoes: (pagina = 1) => chamar<ListaNotificacoes>('GET', `/api/app/notificacoes?pagina=${pagina}`),
  /** Marca uma notificação como lida. Contrato §6.1 (ERP #8569): idempotente; id não-uuid, de outro usuário
   *  ou inexistente → 404 (às vezes o 404 padrão do Laravel, sem JSON — tratar pelo status). */
  marcarLida: (id: string) => chamar<{ nao_lidas: number }>('POST', `/api/app/notificacoes/${encodeURIComponent(id)}/lida`),
  /** Marca todas as notificações do usuário como lidas. Contrato §6.1 (ERP #8569). */
  marcarTodasLidas: () => chamar<{ nao_lidas: number; marcadas: number }>('POST', '/api/app/notificacoes/lidas'),
  /** Painel do Início. Completa o bloco `ajustes` com o padrão e o guarda para o `useAjustes()`. */
  inicio: () => chamar<Omit<PainelInicio, 'ajustes'> & { ajustes?: unknown }>('GET', '/api/app/inicio').then((p): PainelInicio => {
    const ajustes = completarAjustes(p.ajustes);
    guardarAjustes(ajustes);
    if (!ajustes.app_biometria_login) void desligarBiometria(); // P9: a empresa desligou a entrada com biometria
    return { ...p, ajustes };
  }),
  /** Tela 11 · busca de produto. Mesma permissão do POST (sell.create ou direct_sell.access). */
  produtosVenda: (q = '') => chamar<ListaProdutosVenda>('GET', `/api/app/venda/produtos${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  /** Tela 11 · cria a venda. 201 VendaCriada (200 na repetição da chave) · 422 { erro: "validacao", campos } com
   *  "itens.N.quantidade" (estoque insuficiente), "itens.N.preco_unitario" (o preço mudou), "total_previsto" ou "cliente_id" ·
   *  422 { erro: "idempotencia_conflito" } (mesma chave, corpo diferente) · 409 { erro: "em_andamento" } · 403 sem_permissao
   *  ou sem_local. `chave` = Idempotency-Key da tentativa. */
  criarVenda: (corpo: CorpoVenda, chave: string) => chamar<VendaCriada>('POST', '/api/app/vendas', corpo, { 'Idempotency-Key': chave }),
  // P1 · avançar etapa do pedido (tela 22, ERP #9445).
  /** 200 = o mesmo JSON do GET /pedidos/{id}, já na etapa nova (a mesma chave + mesmo corpo devolve a resposta gravada) ·
   *  403 sem_permissao (fora da lista liberada ou RBAC da FSM) · 404 nao_encontrado · 409 etapa_mudou / em_andamento ·
   *  422 validacao { campos } / idempotencia_conflito · 429 (30/min). `chave` = Idempotency-Key da tentativa. */
  avancarPedido: (id: number, corpo: ReturnType<typeof corpoAcao>, chave: string) =>
    chamar<PedidoDetalheApi>('POST', `/api/app/pedidos/${id}/acao`, corpo, { 'Idempotency-Key': chave }),
  // P3 · entrega (tela 22, ERP #9464).
  /** 201 EntregaRegistrada (a mesma chave + mesmo corpo devolve a resposta gravada) · 403 sem_permissao · 404 nao_encontrado ·
   *  409 etapa_mudou / em_andamento · 422 validacao { campos } / idempotencia_conflito / bloqueado · 503 sem_configuracao ·
   *  429 (20/min). `chave` = Idempotency-Key da tentativa. */
  registrarEntrega: (id: number, corpo: CorpoEntrega, chave: string) =>
    chamar<EntregaRegistrada>('POST', `/api/app/pedidos/${id}/entrega`, corpo, { 'Idempotency-Key': chave }),
  /** Tela 30. Contrato §12 (ERP #8592). Grava a escolha (≤3, em ordem, só chaves de `areas`); `[]` apaga a escolha e
   *  volta ao padrão do ERP. 422 { mensagem, campos: { modulos: "msg" } } (mais de 3, repetido, fora das áreas).
   *  Devolve a escolha gravada e a barra que passa a valer. */
  salvarBarra: (modulos: Area[]) => chamar<{ modulos: Area[]; barra: Area[] }>('PUT', '/api/app/perfil-menu', { modulos }),
  orcamentos: (status: FiltroOrcamentos, pagina = 1) =>
    chamar<ListaOrcamentos>('GET', `/api/app/orcamentos?status=${status}&pagina=${pagina}`),
  // P4 · orçamento rápido. Erros: 403 sem_permissao (sem módulo/permissão; no POST também com `app_orcamento_rapido`
  // desligado) · 422 validacao { campos } (formato, material/cliente, "itens.N.total_previsto" = o total mudou) /
  // idempotencia_conflito · 409 em_andamento · 503 sem_configuracao (nenhum material ativo) · 429.
  materiaisOrcamento: () => chamar<{ itens: MaterialOrcamento[] }>('GET', '/api/app/orcamentos/materiais'),
  calcularOrcamento: (c: CorpoCalculoOrcamento) => chamar<CalculoOrcamento>('POST', '/api/app/orcamentos/calcular', c),
  /** Grava como rascunho. `chave` = Idempotency-Key da tentativa (só muda quando o corpo muda). */
  criarOrcamento: (corpo: CorpoNovoOrcamento, chave: string) =>
    chamar<OrcamentoCriado>('POST', '/api/app/orcamentos', corpo, { 'Idempotency-Key': chave }),
  /** `aba` (contrato atual) ou a lista de situações marcadas (proposta junto com o filtro avançado). */
  financeiro: (aba: AbaFinanceiro | Situacao[], pagina = 1, filtros = '') => chamar<PainelFinanceiro>('GET',
    `/api/app/financeiro?${Array.isArray(aba) ? `situacao=${aba.join(',')}` : `aba=${aba}`}&pagina=${pagina}${filtros}`),
  fiscal: (status: FiltroFiscal, pagina = 1) => chamar<ListaFiscal>('GET', `/api/app/fiscal?status=${status}&pagina=${pagina}`),
  relatorios: (periodo: PeriodoRelatorio, aba: AbaRelatorio) => chamar<Relatorios>('GET', `/api/app/relatorios?periodo=${periodo}&aba=${aba}`),
  dashboard: () => chamar<Dashboard>('GET', '/api/app/dashboard'),
  /** Tela 39. Contrato §12.1 (ERP #8586). Erros: 403 sem_permissao · 404 nao_encontrado · 409 ja_revisada · 503 trilha_desligada. */
  marcacoesAValidar: (estado: FiltroValidacao) => chamar<ListaValidacao>('GET', `/api/app/ponto/aprovacoes?estado=${estado}`),
  validarMarcacao: (id: string) => chamar<{ estado: 'validada' }>('POST', `/api/app/ponto/aprovacoes/${encodeURIComponent(id)}/validar`),
  /** Grava a anulação no servidor (motivo fixo no ERP). Nada de UPDATE/DELETE na marcação: ela continua imutável. */
  recusarMarcacao: (id: string) => chamar<{ estado: 'recusada'; nsr_anulacao: number }>('POST', `/api/app/ponto/aprovacoes/${encodeURIComponent(id)}/recusar`),
  /** Tela 26. Contrato §12 (ERP #8588). */
  equipe: () => chamar<ListaEquipe>('GET', '/api/app/equipe'),
  /** Tela 25 (ERP #8596). Sem conversa_id, o ERP abre uma conversa nova. Erros: 403 · 404 (conversa de outro) · 422 · 429. */
  enviarChat: (mensagem: string, conversa_id: string | null) => chamar<RespostaChat>('POST', '/api/app/chat', { mensagem, conversa_id }),
  conversaChat: (id: string) => chamar<ConversaChat>('GET', `/api/app/chat/${encodeURIComponent(id)}`),
  /** Novo lançamento (tela 06). 201 { id } (200 na repetição da chave) · 422 { erro: "validacao", campos } ·
   *  422 idempotencia_conflito · 409 em_andamento · 403 sem_permissao. `chave` = Idempotency-Key da tentativa. */
  criarLancamento: (corpo: NovoLancamento, chave: string) =>
    chamar<{ id: number; ids: number[]; recorrencia_id: number | null }>('POST', '/api/app/financeiro/lancamentos', corpo, { 'Idempotency-Key': chave }),
  recorrencias: () => chamar<{ itens: Recorrencia[] }>('GET', '/api/app/financeiro/recorrencias'),
  // Detalhe e ações do lançamento. Todas devolvem o lançamento atualizado; 409 { erro: "estado" } quando a situação
  // não permite (ex.: receber o que já foi recebido, excluir o que está pago).
  lancamento: (id: number) => chamar<LancamentoDetalhe>('GET', `/api/app/financeiro/lancamentos/${id}`),
  /** Alterar (Tier 0: pode mudar valor). `chave` = Idempotency-Key da tentativa. */
  alterarLancamento: (id: number, corpo: AlteracaoLancamento, chave: string) =>
    chamar<LancamentoDetalhe>('PATCH', `/api/app/financeiro/lancamentos/${id}`, corpo, { 'Idempotency-Key': chave }),
  /** Baixa (receber/pagar) pelo `valor_pago` do corpo: menor que o do lançamento = parcial, e o ERP cria o restante
   *  vencendo em `vencimento_restante`. `chave` = Idempotency-Key: repetir não baixa duas vezes. */
  baixarLancamento: (id: number, corpo: BaixaLancamento, chave: string) =>
    chamar<LancamentoDetalhe>('POST', `/api/app/financeiro/lancamentos/${id}/baixar`, corpo, { 'Idempotency-Key': chave }),
  /** Dados do recibo de um lançamento liquidado (409 estado se não estiver). O PDF é montado no app (recibo.ts). */
  recibo: (id: number) => chamar<ReciboDados>('GET', `/api/app/financeiro/lancamentos/${id}/recibo`),
  /** Desfaz a baixa (retornar a receber/pagar). Num parcial, junta o restante de volta (409 se o restante já foi pago). */
  estornarLancamento: (id: number, chave: string) =>
    chamar<LancamentoDetalhe>('POST', `/api/app/financeiro/lancamentos/${id}/estornar`, undefined, { 'Idempotency-Key': chave }),
  /** Excluir e reativar também levam Idempotency-Key: se a resposta se perder, tocar de novo não vira erro 409. */
  excluirLancamento: (id: number, motivo: string | null, chave: string) =>
    chamar<LancamentoDetalhe>('POST', `/api/app/financeiro/lancamentos/${id}/excluir`, { motivo }, { 'Idempotency-Key': chave }),
  reativarLancamento: (id: number, chave: string) =>
    chamar<LancamentoDetalhe>('POST', `/api/app/financeiro/lancamentos/${id}/reativar`, undefined, { 'Idempotency-Key': chave }),
  /** Para de gerar daqui pra frente; idempotente (interromper de novo devolve a mesma). */
  interromperRecorrencia: (id: number) => chamar<Recorrencia>('POST', `/api/app/financeiro/recorrencias/${id}/interromper`),
  pagamentos: (status: FiltroPagamentos, pagina = 1) => chamar<ListaPagamentos>('GET', `/api/app/pagamentos?status=${status}&pagina=${pagina}`),
  // ── Escrita da tela 15 (regra mestre: dupla prova, antes→depois e ok do [W] antes do merge). Formato proposto ao ERP. ──
  referenciasCobranca: () => chamar<{ itens: ReferenciaCobranca[] }>('GET', '/api/app/pagamentos/referencias'),
  /** 201 com o link criado · 422 { campos } · 409 ja_existe (já há link em aberto para o documento) ·
   *  503 provedor_indisponivel / sem_configuracao (o provedor não gerou o link; nada é gravado). */
  gerarLink: (n: NovoLinkPagamento) => chamar<LinkPagamento>('POST', '/api/app/pagamentos', n),
  /** Pergunta ao provedor a situação atual; devolve o link atualizado (pode continuar pendente). */
  consultarPagamento: (id: number) => chamar<LinkPagamento>('POST', `/api/app/pagamentos/${id}/consultar`),
  /** Cancela a cobrança no provedor; 409 nao_cancelavel se já foi paga. */
  cancelarPagamento: (id: number) => chamar<LinkPagamento>('POST', `/api/app/pagamentos/${id}/cancelar`),
  tarefas: (origem: FiltroTarefas) => chamar<ListaTarefas>('GET', `/api/app/tarefas?origem=${origem}`),
  /** Só ToDo do próprio usuário (contrato §3). `id` é o número do ToDo, sem o prefixo "todo:". */
  tarefa: (id: string) => chamar<TarefaDetalhe>('GET', `/api/app/tarefas/todo/${id}`),
  concluirTodo: (id: string) => chamar<{ sucesso: boolean }>('POST', `/api/app/tarefas/todo/${id}/concluir`),
  // Lembrete de ponto (ADR 0423, sessão PUSH — PR #8457 no ERP).
  registrarPush: (t: string, plataforma: 'android' | 'ios') =>
    chamar<{ ativo: boolean }>('POST', '/ponto/api/push/dispositivo', { token: t, plataforma }),
  // P5 · atendimento — tela 41 (ERP PR 18, AtendimentoController). Área `atendimento` só vem em `areas` com o canal ligado.
  // Erros: 403 sem_permissao · 404 nao_encontrado · 409 em_andamento · 422 validacao / idempotencia_conflito /
  // sem_consentimento / janela_fechada / bloqueado · 502 falha_envio · 503 sem_configuracao. Throttle 20/min no envio.
  atendimento: (pagina = 1) => chamar<ListaAtendimento>('GET', `/api/app/atendimento?pagina=${pagina}`),
  conversaAtendimento: (id: number) => chamar<DetalheAtendimento>('GET', `/api/app/atendimento/${id}`),
  /** Texto livre. `modelo` e `anexo` vão null na v1. 201 (200 na repetição da chave com o mesmo corpo). */
  enviarAtendimento: (id: number, texto: string, chave: string) =>
    chamar<{ mensagem: MensagemAtendimento }>('POST', `/api/app/atendimento/${id}/mensagens`, { texto, modelo: null, anexo: null }, { 'Idempotency-Key': chave }),
  /** O ERP monta o texto do registro `ref_id` (do cliente da conversa). 403 com `app_atendimento_atalhos` desligado. */
  atalhoAtendimento: (id: number, tipo: TipoAtalho, ref_id: number, chave: string) =>
    chamar<{ mensagem: MensagemAtendimento }>('POST', `/api/app/atendimento/${id}/atalho`, { tipo, ref_id }, { 'Idempotency-Key': chave }),
};

// ── Apontamento por QR (P8, tela 02 · PR 08 do playbook propostas-app). Contrato tela-02-apontamento.md (ERP #9447):
// grava no PCP (Modules/Producao, ADR 0431). Bloco próprio: a tela escreve só pela fila (src/apontamento-fila.ts), que
// guarda o toque sem internet e reenvia com a mesma Idempotency-Key e o `momento` do toque (decisão [W] 2026-10-15). ──
export interface PedidoApontamento { id: number; numero: string | null; resumo: string | null; cliente: string | null }
/** Etapa = linha de `pcp_programacoes` (OS × posto × responsável). `posto.tipo`: 'pessoa' ou 'maquina'. */
export interface EtapaApontamento {
  programacao_id: number; status: string;
  posto: { id: number; nome: string; tipo: string } | null;
  inicio_previsto: string | null;
  responsavel: { id: number; nome: string } | null;
}
/** GET /api/app/producao/etiqueta/{codigo}: QR (`oimpresso:p:<hash>:<id>`) ou número digitado. Etapa de outra pessoa
 *  vem com `pode_apontar: false` e o responsável. */
export interface EtiquetaProducao { pedido: PedidoApontamento; etapa: EtapaApontamento; pode_apontar: boolean }
/** Apontamento aberto. `id` é o da linha de início; `iniciado_em` é a hora gravada no ERP. */
export interface ApontamentoAberto { id: number; tipo: string; pedido: PedidoApontamento | null; etapa: EtapaApontamento | null; iniciado_em: string }
export interface EmAndamento {
  pessoa: ApontamentoAberto | null; maquinas: ApontamentoAberto[];
  ponto: { entrada: string | null; saida: string | null; presenca_minutos: number | null } | null;
}
export interface Encerramento { id: number; encerrado_por: string; origem: string; encerrado_em: string; minutos: number | null }
export const apontamentoApi = {
  emAndamento: () => chamar<EmAndamento>('GET', '/api/app/producao/apontamentos/em-andamento'),
  /** 404 nao_encontrado (outra empresa ou inexistente) · 422 campos.codigo (número com app_apontamento_exige_qr). */
  etiqueta: (codigo: string) => chamar<EtiquetaProducao>('GET', `/api/app/producao/etiqueta/${encodeURIComponent(codigo)}`),
  /** 201/200 { id, programacao_id, iniciado_em } · 409 etapa_alheia { etapa } · 409 em_andamento { apontamento_id } ·
   *  422 bloqueado / campos.codigo / campos.momento. */
  iniciar: (corpo: { programacao_id: number; momento: string; codigo?: string }, chave: string) =>
    chamar<{ id: number; programacao_id: number; iniciado_em: string }>('POST', '/api/app/producao/apontamentos/iniciar', corpo, { 'Idempotency-Key': chave }),
  /** 201/200 Encerramento (200 com origem "turno"/"ponto" quando o fechamento automático veio antes). */
  concluir: (id: number, corpo: { momento: string }, chave: string) =>
    chamar<Encerramento>('POST', `/api/app/producao/apontamentos/${id}/concluir`, corpo, { 'Idempotency-Key': chave }),
  /** Pedido de correção de horário para o gestor (append-only). `momento` = a hora certa. */
  corrigir: (id: number, corpo: { momento: string; justificativa: string }, chave: string) =>
    chamar<{ id: number; apontamento_id: number; situacao: string }>('POST', `/api/app/producao/apontamentos/${id}/corrigir`, corpo, { 'Idempotency-Key': chave }),
};
