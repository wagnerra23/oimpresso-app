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
  itens_venda: Array<{ produto: string; quantidade: number; total: number }>;
  etapas: Array<{ grupo: GrupoEtapa; rotulo: string; estado: 'feito' | 'atual' | 'futuro' }>;
  acoes: Array<{ chave: string; rotulo: string; pode: boolean }>;
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
/** Liga a tela 20. Só a demo, até o #8582 estar em produção. */
export const ESCRITA_PRODUTO = DEMO;

// ── Início (API-CONTRATO-v1 §6, ERP #8495). Bloco null = sem permissão: o app esconde o card. ──
/** Áreas do app (contrato §6): cada uma segue a regra da rota dela — aba visível = rota que responde. */
export type Area = 'inicio' | 'tarefas' | 'pedidos' | 'producao' | 'pessoas' | 'orcamentos' | 'produtos' | 'estoque' | 'financeiro' | 'fiscal' | 'relatorios' | 'dashboard' | 'assistente' | 'equipe' | 'ponto' | 'ponto_gestor' | 'mais';

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

/** Tela 06 · Financeiro (D16, Onda C) — só leitura. Formato proposto ao ERP (PR pendente).
 *  `resumo` e `contas` não mudam com a aba; só `itens` e a paginação. Valor sempre positivo: o sinal vem de `tipo`. */
export type AbaFinanceiro = 'receber' | 'pagar' | 'extrato';
export type StatusLancamento = 'aberto' | 'vencido' | 'liquidado';
export interface Lancamento {
  id: number; tipo: 'receber' | 'pagar'; descricao: string; parte: string | null;
  vencimento: string | null; pago_em: string | null; valor: number; status: StatusLancamento;
}
export interface PainelFinanceiro {
  /** `vencido` = parte vencida do a receber (já contida em `a_receber`). */
  resumo: { mes: string; recebido: number; pago: number; saldo: number; a_receber: number; vencido: number; a_pagar: number };
  /** `saldo` null quando o ERP não sabe o saldo da conta; `detalhe` é texto pronto (banco · agência). */
  contas: Array<{ id: number; nome: string; detalhe: string | null; saldo: number | null }>;
  itens: Lancamento[]; contadores: Record<AbaFinanceiro, number>; pagina: number; tem_mais: boolean;
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
export type AbaRelatorio = 'dre' | 'vendas' | 'producao' | 'estoque';
export interface Relatorios {
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
  constructor(public status: number, public codigo: string, mensagem: string, public campos?: Record<string, string>) { super(mensagem); }
}

/** Erros por campo de qualquer erro (da API ou da demo). */
export const camposDoErro = (e: unknown): Record<string, string> =>
  ((e as { campos?: Record<string, string> } | null)?.campos) ?? {};

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

async function chamar<T>(metodo: 'GET' | 'POST' | 'PATCH' | 'PUT', caminho: string, corpo?: unknown): Promise<T> {
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
    const campos = d.campos && typeof d.campos === 'object' ? (d.campos as Record<string, string>) : undefined;
    const msg = (primeiro ?? d.mensagem ?? d.message ?? (campos ? Object.values(campos)[0] : undefined) ?? 'Algo deu errado. Tente de novo.') as string;
    throw new ErroApi(r.status, String(d.erro ?? 'erro'), msg, campos);
  }
  return r.data as T;
}

/** Cadastro de produto fora da demo não sai do aparelho até o #8582 estar em produção. */
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
  notificacoes: (pagina = 1) => chamar<ListaNotificacoes>('GET', `/api/app/notificacoes?pagina=${pagina}`),
  /** Marca uma notificação como lida. Contrato §6.1 (ERP #8569): idempotente; id não-uuid, de outro usuário
   *  ou inexistente → 404 (às vezes o 404 padrão do Laravel, sem JSON — tratar pelo status). */
  marcarLida: (id: string) => chamar<{ nao_lidas: number }>('POST', `/api/app/notificacoes/${encodeURIComponent(id)}/lida`),
  /** Marca todas as notificações do usuário como lidas. Contrato §6.1 (ERP #8569). */
  marcarTodasLidas: () => chamar<{ nao_lidas: number; marcadas: number }>('POST', '/api/app/notificacoes/lidas'),
  inicio: () => chamar<PainelInicio>('GET', '/api/app/inicio'),
  /** Tela 30. Contrato §12 (ERP #8592). Grava a escolha (≤3, em ordem, só chaves de `areas`); `[]` apaga a escolha e
   *  volta ao padrão do ERP. 422 { mensagem, campos: { modulos: "msg" } } (mais de 3, repetido, fora das áreas).
   *  Devolve a escolha gravada e a barra que passa a valer. */
  salvarBarra: (modulos: Area[]) => chamar<{ modulos: Area[]; barra: Area[] }>('PUT', '/api/app/perfil-menu', { modulos }),
  orcamentos: (status: FiltroOrcamentos, pagina = 1) =>
    chamar<ListaOrcamentos>('GET', `/api/app/orcamentos?status=${status}&pagina=${pagina}`),
  financeiro: (aba: AbaFinanceiro, pagina = 1) => chamar<PainelFinanceiro>('GET', `/api/app/financeiro?aba=${aba}&pagina=${pagina}`),
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
  tarefas: (origem: FiltroTarefas) => chamar<ListaTarefas>('GET', `/api/app/tarefas?origem=${origem}`),
  /** Só ToDo do próprio usuário (contrato §3). `id` é o número do ToDo, sem o prefixo "todo:". */
  tarefa: (id: string) => chamar<TarefaDetalhe>('GET', `/api/app/tarefas/todo/${id}`),
  concluirTodo: (id: string) => chamar<{ sucesso: boolean }>('POST', `/api/app/tarefas/todo/${id}/concluir`),
  // Lembrete de ponto (ADR 0423, sessão PUSH — PR #8457 no ERP).
  registrarPush: (t: string, plataforma: 'android' | 'ios') =>
    chamar<{ ativo: boolean }>('POST', '/ponto/api/push/dispositivo', { token: t, plataforma }),
};
