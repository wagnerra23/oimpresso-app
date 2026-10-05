// Modo demonstração (VITE_DEMO=1): dados simulados em memória, sem servidor.
// Serve para ver as telas no emulador enquanto o ERP não tem o client OAuth do
// app. NUNCA entra no build de loja — a tela mostra uma faixa "Modo demonstração".
// Os números imitam o protótipo (prototipo-ui/cowork/Wagner/ponto-mobile.jsx).

interface MarcacaoDemo { id: string; nsr: number; tipo: string; origem: string; hora: string; hash_trunc: string; revisar: boolean }

let logado = false;
// Perfil da demo: usuário com "ponto" no nome (ex.: revisor.ponto) entra como colaborador (D6).
let perfilDemo: 'erp' | 'colaborador' = 'erp';
// Usuário com "vendas" no nome entra sem acesso ao Financeiro (relatórios sem indicadores nem DRE, §10.3).
let semFinanceiro = false;
// Usuário com "gestor" no nome vê o dashboard sem acesso a vendas: pedidos e produção vêm null (§10.4).
let semVendas = false;
let nsr = 348821;
const marcacoes: MarcacaoDemo[] = [
  { id: 'd1', nsr: 348821, tipo: 'ENTRADA', origem: 'MOBILE', hora: '07:02', hash_trunc: '9f2c41ab07d3e5c1', revisar: false },
];
const intercorrencias: Array<Record<string, unknown>> = [];
// Tela 30 · escolha da barra guardada "no ERP" da demo (null = sem escolha → padrão do ERP).
let barraDemo: string[] | null = null;
const BARRA_PADRAO_DEMO = ['tarefas', 'pedidos', 'producao'];
// Tela 39 · Marcações fora do geofence (nomes e números do protótipo). `min` = minutos atrás.
const VALIDACAO = [
  { id: 'd39a1000-0000-4000-8000-000000000001', colaborador_nome: 'Marcos Teixeira', tipo: 'ENTRADA', local_texto: 'A 84,2 km do local de trabalho', min: 95, nsr: 348821, gps_precisao_m: null, dispositivo: 'Android', hash_curto: '295f5666', estado: 'pendente' },
  { id: 'd39a2000-0000-4000-8000-000000000002', colaborador_nome: 'Marcos Teixeira', tipo: 'SAIDA', local_texto: 'A 84,2 km do local de trabalho', min: 960, nsr: 348809, gps_precisao_m: null, dispositivo: 'Android', hash_curto: '27d9d853', estado: 'pendente' },
  { id: 'd39a3000-0000-4000-8000-000000000003', colaborador_nome: 'Joana Lima', tipo: 'ENTRADA', local_texto: 'A 3,7 km do local de trabalho', min: 1500, nsr: 348715, gps_precisao_m: null, dispositivo: 'iOS 19', hash_curto: 'd1dbb32b', estado: 'pendente' },
  { id: 'd39a4000-0000-4000-8000-000000000004', colaborador_nome: 'Felipe Andrade', tipo: 'SAIDA', local_texto: null, min: 2800, nsr: 348690, gps_precisao_m: null, dispositivo: 'Android', hash_curto: '32619e21', estado: 'validada' },
];
// Tela 25 · respostas simuladas da Jana (as do protótipo). Sem Date no topo do módulo.
const conversaDemo: Array<{ de: 'eu' | 'jana'; texto: string; criada_em: string }> = [];
const respostaJana = (t: string) => {
  const x = t.toLowerCase();
  if (x.includes('venda') || x.includes('pedido')) return 'Para acompanhar vendas, abra Pedidos: lá você vê o status de cada um e o que está atrasado.';
  if (x.includes('produç') || x.includes('producao')) return 'Em Produção você vê a fila por etapa: aprovado, em produção, em espera e pronto pra faturar.';
  if (x.includes('financ')) return 'O resumo do caixa, a receber e a pagar aparece no Início. O detalhe completo está no oimpresso no computador.';
  return 'Posso ajudar com pedidos, produção, estoque e ponto. Toque numa sugestão ou escreva sua dúvida.';
};

// Pedidos de demonstração no formato do contrato (API-CONTRATO-v1 §2).
const diaRel = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const ACAO: Record<string, string> = { orcamento: 'Enviar para aprovação', aprovacao: 'Aprovar pedido', producao: 'Liberar para entrega', entrega: 'Confirmar entrega' };
const PEDIDOS = [
  { id: 106, numero: '0043', cliente: 'Papelaria Sol', valor: 360.0, prazo: diaRel(2), atrasado: false, progresso: 0.4,
    etapa: { chave: 'quote_approved', rotulo: 'Aprovado pelo cliente', grupo: 'aprovacao' as const },
    itens: [{ produto: 'Adesivo vinil recortado — 50 un', quantidade: 50, total: 360.0 }] },
  { id: 107, numero: '0044', cliente: 'Clínica Vita', valor: 890.0, prazo: diaRel(-2), atrasado: true, progresso: 0.5,
    etapa: { chave: 'in_production', rotulo: 'Em produção', grupo: 'producao' as const },
    itens: [{ produto: 'Placa ACM 1×0,5 m', quantidade: 2, total: 890.0 }] },
  { id: 108, numero: '0045', cliente: 'Bistrô do Forno', valor: 210.0, prazo: diaRel(4), atrasado: false, progresso: 0.5,
    etapa: { chave: 'on_hold', rotulo: 'Em espera', grupo: 'producao' as const },
    itens: [{ produto: 'Cardápio A3 laminado', quantidade: 20, total: 210.0 }] },
  { id: 109, numero: '0046', cliente: 'Restaurante 88', valor: 155.0, prazo: diaRel(1), atrasado: false, progresso: 0.75,
    etapa: { chave: 'ready_for_invoice', rotulo: 'Pronto pra faturar', grupo: 'producao' as const },
    itens: [{ produto: 'Etiqueta 5×3 cm — 500 un', quantidade: 500, total: 155.0 }] },
  { id: 101, numero: '0042', cliente: 'Marília Costa', valor: 248.0, prazo: diaRel(-1), atrasado: true, progresso: 0.25,
    etapa: { chave: 'awaiting_approval', rotulo: 'Aguardando aprovação', grupo: 'aprovacao' as const },
    itens: [{ produto: 'Cartão de visita 9×5 4/4 — 1.000 un', quantidade: 1, total: 248.0 }] },
  { id: 102, numero: '0041', cliente: 'Clínica Vita', valor: 612.0, prazo: diaRel(1), atrasado: false, progresso: 0.75,
    etapa: { chave: 'out_for_delivery', rotulo: 'Saiu para entrega', grupo: 'entrega' as const },
    itens: [{ produto: 'Folder A4 4/4', quantidade: 500, total: 540.0 }, { produto: 'Envelope ofício', quantidade: 100, total: 72.0 }] },
  { id: 103, numero: '0040', cliente: 'Restaurante 88', valor: 480.0, prazo: diaRel(3), atrasado: false, progresso: 0.5,
    etapa: { chave: 'in_production', rotulo: 'Em produção', grupo: 'producao' as const },
    itens: [{ produto: 'Banner 3×1 m lona', quantidade: 1, total: 480.0 }] },
  { id: 104, numero: '0039', cliente: 'Bistrô do Forno', valor: 320.0, prazo: diaRel(5), atrasado: false, progresso: 0,
    etapa: { chave: 'quote_draft', rotulo: 'Orçamento', grupo: 'orcamento' as const },
    itens: [{ produto: 'Cardápio A3 dobrado', quantidade: 50, total: 320.0 }] },
  { id: 105, numero: '0038', cliente: 'Papelaria Sol', valor: 1190.5, prazo: diaRel(-3), atrasado: false, progresso: 1,
    etapa: { chave: 'completed', rotulo: 'Concluído', grupo: 'concluido' as const },
    itens: [{ produto: 'Adesivo vinil recortado', quantidade: 200, total: 1190.5 }] },
];

// Produtos da demo (contrato §9.1), imitando o protótipo da tela 19.
const CATEGORIAS = [{ id: 1, nome: 'Comunicação visual' }, { id: 2, nome: 'Adesivos' }, { id: 3, nome: 'Gráfica rápida' }, { id: 4, nome: 'Sinalização' }, { id: 5, nome: 'Brindes' }];
const UNIDADES = [{ id: 1, nome: 'Metro quadrado', curta: 'm²' }, { id: 2, nome: 'Unidade', curta: 'un' }, { id: 3, nome: 'Milheiro', curta: 'mil' }];
interface ProdutoDemo { id: number; nome: string; codigo: string; cat: number | null; unidade: string; preco: number | null; variacoes: number | null; qtd: number | null; baixo: boolean }
const PRODUTOS: ProdutoDemo[] = [
  { id: 201, nome: 'Adesivo vinil impresso', codigo: 'ADS-VIN', cat: 2, unidade: 'm²', preco: 58, variacoes: null, qtd: 64, baixo: false },
  { id: 202, nome: 'Caneca personalizada', codigo: 'BRD-CAN', cat: 5, unidade: 'un', preco: 29, variacoes: 3, qtd: 46, baixo: false },
  { id: 203, nome: 'Cartão de visita 4×4', codigo: 'CRT-500', cat: 3, unidade: 'mil', preco: 145, variacoes: null, qtd: null, baixo: false },
  { id: 204, nome: 'Letra caixa inox', codigo: 'LTC-INX', cat: null, unidade: 'un', preco: 190, variacoes: null, qtd: null, baixo: false },
  { id: 205, nome: 'Lona front-light 440g', codigo: 'LON-440', cat: 1, unidade: 'm²', preco: 42, variacoes: null, qtd: 18, baixo: true },
  { id: 206, nome: 'Placa PS 2 mm', codigo: 'PS-2B', cat: 4, unidade: 'un', preco: 38, variacoes: null, qtd: 9, baixo: true },
];

// Estoque da demo (contrato §9.2): uma linha por variação × loja, imitando o protótipo da tela 05.
const ESTOQUE = [
  { id: 301, produto_id: 205, nome: 'Lona front-light 440g', codigo: 'LON-440', qtd: 18, minimo: 50, unidade: 'm²', local: 'Loja Centro', prateleira: 'A · 1 · 2' },
  { id: 302, produto_id: 201, nome: 'Vinil adesivo branco brilho', codigo: 'VIN-BR', qtd: 64, minimo: 40, unidade: 'm²', local: 'Loja Centro', prateleira: 'A · 3 · 1' },
  { id: 303, produto_id: 207, nome: 'Chapa ACM 3 mm · Prata', codigo: 'ACM-3P', qtd: 3, minimo: 6, unidade: 'un', local: 'Loja Centro', prateleira: null },
  { id: 304, produto_id: 208, nome: 'Tinta eco-solvente · Ciano', codigo: 'TNT-C', qtd: 2.5, minimo: 4, unidade: 'L', local: 'Loja Centro', prateleira: null },
  { id: 305, produto_id: 209, nome: 'Ilhós latão 10 mm', codigo: 'ILH-10', qtd: 2400, minimo: 1000, unidade: 'un', local: 'Loja Centro', prateleira: 'G · 7 · 1' },
  { id: 306, produto_id: 206, nome: 'Placa PS 2 mm', codigo: 'PS-2B', qtd: 9, minimo: 10, unidade: 'un', local: 'Filial Norte', prateleira: 'B · 2 · 4' },
  { id: 307, produto_id: 202, nome: 'Caneca personalizada · Azul', codigo: 'BRD-CAN-AZ', qtd: 46, minimo: null, unidade: 'un', local: 'Filial Norte', prateleira: null },
];

// Histórico da tela 29 (só leitura), imitando o protótipo. Horário relativo a hoje para "hoje"/"ontem" funcionarem.
const quandoRel = (dias: number, h: number, m: number) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return d.toISOString(); };
const HISTORICO: Record<number, Array<{ id: number; tipo: string; rotulo: string; referencia: string | null; quando: string; qtd: number; saldo: number }>> = {
  301: [
    { id: 9001, tipo: 'sell', rotulo: 'Venda', referencia: 'Pedido 2318 · Mercado Bom Preço', quando: quandoRel(0, 8, 10), qtd: -3.6, saldo: 18 },
    { id: 9002, tipo: 'purchase', rotulo: 'Compra', referencia: 'NF 88213 · Distribuidora Sul Mídia', quando: quandoRel(-1, 15, 40), qtd: 20, saldo: 21.6 },
    { id: 9003, tipo: 'stock_adjustment', rotulo: 'Ajuste', referencia: 'Refilo · ajuste de cor', quando: quandoRel(-6, 11, 5), qtd: -1.2, saldo: 1.6 },
    { id: 9004, tipo: 'sell', rotulo: 'Venda', referencia: 'Pedido 2301 · Escola Aprender', quando: quandoRel(-7, 9, 30), qtd: -4, saldo: 2.8 },
  ],
  306: [{ id: 9101, tipo: 'opening_stock', rotulo: 'Estoque inicial', referencia: null, quando: quandoRel(-20, 8, 0), qtd: 9, saldo: 9 }],
};

// Ordens de serviço da demo (tela 07). Pipeline como o ERP fechou (FSM oficina_mecanica_os, 6 etapas
// não-terminais; terminais não entram na lista). O veículo do ERP não tem marca/modelo: vem o tipo.
// Placas e clientes fictícios.
const ETAPAS_OS = [['recepcao', 'Recepção'], ['em_diagnostico', 'Diagnóstico'], ['aguardando_aprovacao', 'Aguardando aprovação'],
  ['aguardando_pecas', 'Aguardando peças'], ['em_execucao', 'Em execução'], ['pronto_retirada', 'Pronto p/ retirar']] as const;
const OS_TRAVA = ['aguardando_aprovacao', 'aguardando_pecas'];
const ORDENS = [
  { id: 1046, numero: 'OS-01046', placa: null, veiculo: null, cliente: 'Padaria Trigo Fino', valor: null, etapa: 'recepcao' },
  { id: 1045, numero: 'OS-01045', placa: 'MLK4C09', veiculo: 'Furgão', cliente: 'Mercado Bom Preço', valor: null, etapa: 'em_diagnostico' },
  { id: 1044, numero: 'OS-01044', placa: 'QJT8A21', veiculo: 'Utilitário', cliente: 'Auto Center Rota', valor: 1380, etapa: 'aguardando_aprovacao' },
  { id: 1042, numero: 'OS-01042', placa: 'RLV2E48', veiculo: 'Picape', cliente: 'Transportes Vale Norte', valor: 750, etapa: 'em_execucao' },
  { id: 1039, numero: 'OS-01039', placa: 'RBA2H78', veiculo: 'Caminhão basculante', cliente: 'Transportes Vale Norte', valor: 6420, etapa: 'aguardando_pecas' },
  { id: 1036, numero: 'OS-01036', placa: 'QHX5B33', veiculo: null, cliente: 'Studio Forma', valor: 980, etapa: 'pronto_retirada' },
];
// Edições feitas pelo PATCH da demo, por pessoa (campos que a lista não guarda).
const EDICOES: Record<number, Record<string, unknown>> = {};

/** Como a API: só os últimos dígitos do documento aparecem. */
const mascarar = (d: string | null) => (d ? d.replace(/\d(?=(?:\D*\d){4})/g, '*') : null);

/** GET /pessoas/{id}/cadastro da demo: valores de exemplo, sobrepostos pelo que o PATCH gravou. */
function cadastroDemo(p: PessoaDemo) {
  const pj = p.tipo === 'PJ';
  const e = EDICOES[p.id] ?? {};
  const v = <T,>(k: string, padrao: T): T => (k in e ? (e[k] as T) : padrao);
  const ie = v<number | null>('indicador_ie', pj ? 1 : 9);
  const cons = (e.consentimento ?? {}) as { whatsapp?: boolean; email_nfe?: boolean };
  return { id: p.id, nome: p.nome, tipo: p.tipo,
    identificacao: { razao_social: v('nome', pj ? p.nome + ' Ltda' : p.nome), documento: mascarar(p.documento),
      indicador_ie: ie, papeis: p.papeis,
      nome_fantasia: pj ? v<string | null>('nome_fantasia', p.nome) : null },
    contato: { telefone: p.telefone, email: p.email },
    endereco_fiscal: { cidade: p.cidade, uf: v('uf', 'SC'), cep: v<string | null>('cep', '88700-000'), codigo_ibge: v<string | null>('codigo_ibge', '4218707'),
      email_nfe: v<string | null>('email_nfe', p.email), logradouro: v<string | null>('logradouro', 'Rua da Demonstração'),
      numero: v<string | null>('numero', '100'), complemento: v<string | null>('complemento', null), bairro: v<string | null>('bairro', 'Centro') },
    comercial: { classificacao: null, limite_credito: pj ? 5000 : null, prazo_padrao_dias: v<number | null>('prazo_padrao_dias', pj ? 28 : null) },
    consentimento: { whatsapp: cons.whatsapp ?? (p.telefone ? true : null), email_nfe: cons.email_nfe ?? (p.email ? true : null), sms: null,
      registrado_em: '2026-03-12T14:22:00-03:00' } };
}

// Pessoas de demonstração (API-CONTRATO-v1 §4). Telefones e documentos fictícios.
interface PessoaDemo { id: number; nome: string; tipo: string; documento: string | null; papeis: string[]; saldo_aberto: number;
  telefone: string | null; email: string | null; cidade: string | null }
const PESSOAS: PessoaDemo[] = [
  { id: 15, nome: 'Ângela Ramos', tipo: 'PF', documento: null, papeis: ['funcionario'], saldo_aberto: 0, telefone: '(48) 90000-0006', email: null, cidade: 'Tubarão' },
  { id: 9, nome: 'Bistrô do Forno', tipo: 'PJ', documento: '00.000.000/0001-00', papeis: ['cliente'], saldo_aberto: 0, telefone: '(48) 90000-0001', email: 'contato@bistro.exemplo', cidade: 'Tubarão' },
  { id: 10, nome: 'Clínica Vita', tipo: 'PJ', documento: '00.000.000/0002-00', papeis: ['cliente'], saldo_aberto: 612, telefone: '(48) 90000-0002', email: null, cidade: 'Laguna' },
  { id: 11, nome: 'Gráfica Lona Sul', tipo: 'PJ', documento: '00.000.000/0003-00', papeis: ['fornecedor'], saldo_aberto: 0, telefone: '(48) 90000-0003', email: 'vendas@lonasul.exemplo', cidade: 'Criciúma' },
  { id: 12, nome: 'Marília Costa', tipo: 'PF', documento: null, papeis: ['cliente', 'fornecedor'], saldo_aberto: 248, telefone: '(48) 90000-0004', email: null, cidade: 'Tubarão' },
  { id: 13, nome: 'Papelaria Sol', tipo: 'PJ', documento: '00.000.000/0004-00', papeis: ['cliente'], saldo_aberto: 0, telefone: null, email: 'sol@papelaria.exemplo', cidade: 'Gravatal' },
  { id: 14, nome: 'Restaurante 88', tipo: 'PJ', documento: '00.000.000/0005-00', papeis: ['cliente'], saldo_aberto: 0, telefone: '(48) 90000-0005', email: null, cidade: 'Tubarão' },
]; // já em ordem alfabética: chamada no topo do módulo impediria o build de produção de descartar o demo

// Notificações de demonstração (tela 16), como a API (#8557): texto null, só tarefa com destino.
const NOTIFICACOES = [
  { id: 'a1b2c3d4-0001', origem: 'TAR', titulo: 'Nova tarefa: Conferir arte do cardápio do Bistrô', texto: null, lida: false, min: 12, destino: { tipo: 'tarefa', id: 'todo:16' } },
  { id: 'a1b2c3d4-0002', origem: 'FIN', titulo: 'Fatura recorrente gerada para Clínica Vita', texto: null, lida: false, min: 60, destino: { tipo: null, id: null } },
  { id: 'a1b2c3d4-0003', origem: 'IA', titulo: 'A Jana terminou o resumo do dia', texto: null, lida: false, min: 180, destino: { tipo: null, id: null } },
  { id: 'a1b2c3d4-0004', origem: 'CRM', titulo: 'Novo contato: Bistrô do Forno', texto: null, lida: true, min: 60 * 26, destino: { tipo: null, id: null } },
  { id: 'a1b2c3d4-0005', origem: 'SIS', titulo: 'Backup diário concluído', texto: null, lida: true, min: 60 * 28, destino: { tipo: null, id: null } },
];

// Orçamentos de demonstração (tela 04). Clientes fictícios. Como a API (#8555): validade e área sempre null.
const ORCAMENTOS = [
  { id: 201, numero: 'ORC-0118', titulo: 'Fachada ACM 4×1,2 m com letra caixa', cliente: 'Bistrô do Forno', validade: null, status: 'enviado', valor: 3840, area_m2: null, itens: 3 },
  { id: 202, numero: 'ORC-0117', titulo: 'Adesivação de frota — 3 utilitários', cliente: 'Gráfica Lona Sul', validade: null, status: 'aprovado', valor: 2650, area_m2: null, itens: 6 },
  { id: 203, numero: 'ORC-0116', titulo: 'Banner 3×1 m lona 440 g', cliente: 'Restaurante 88', validade: null, status: 'rascunho', valor: 480, area_m2: null, itens: 1 },
  { id: 204, numero: 'ORC-0115', titulo: 'Cardápio A3 laminado — 20 un', cliente: 'Bistrô do Forno', validade: null, status: 'convertido', valor: 210, area_m2: null, itens: 1 },
  { id: 205, numero: 'ORC-0114', titulo: 'Placa de sinalização interna — kit 12', cliente: 'Clínica Vita', validade: null, status: 'enviado', valor: 1290, area_m2: null, itens: 12 },
];

// Lançamentos de demonstração (tela 06), como o protótipo. Partes fictícias; `dias` vira data dentro do handler.
const LANCAMENTOS = [
  { id: 901, tipo: 'receber', descricao: 'Pedido #0043 · fachada ACM', parte: 'Papelaria Sol', dias: 0, valor: 7840, pago: false },
  { id: 902, tipo: 'receber', descricao: 'Pedido #0044 · placas', parte: 'Clínica Vita', dias: -7, valor: 1260, pago: false },
  { id: 903, tipo: 'receber', descricao: 'Pedido #0046 · etiquetas', parte: 'Restaurante 88', dias: 3, valor: 2315, pago: false },
  { id: 904, tipo: 'pagar', descricao: 'Lona 440 g · 3 rolos', parte: 'Gráfica Lona Sul', dias: -1, valor: 4380, pago: false },
  { id: 905, tipo: 'pagar', descricao: 'Energia elétrica', parte: 'Companhia de energia', dias: 6, valor: 1920, pago: false },
  { id: 906, tipo: 'receber', descricao: 'Pedido #0038 · adesivos', parte: 'Papelaria Sol', dias: -5, valor: 3420, pago: true },
  { id: 907, tipo: 'pagar', descricao: 'Tinta eco-solvente CMYK', parte: 'Fornecedor de tintas', dias: -6, valor: 2760, pago: true },
] as const;

// Documentos fiscais de demonstração (tela 14), como o protótipo. Chave fictícia; `dias` vira data dentro do handler.
const FISCAIS = [
  { id: 1287, tipo: 'NFe', numero: '1287', referencia: 'Pedido #0038 · Papelaria Sol', valor: 3420, status: 'autorizado',
    chave: '0000 0000 0000 0000 0000 5500 1000 0012 8710 0000 0000', erro: null, dias: -5 },
  // Mesmo id da NF-e acima de propósito: no ERP os ids vêm de tabelas diferentes (§10.2).
  { id: 1287, tipo: 'NFSe', numero: '342', referencia: 'Pedido #0041 · Clínica Vita', valor: 980, status: 'processando', chave: null, erro: null, dias: -1 },
  { id: 9001, tipo: 'NFCe', numero: null, referencia: 'Venda balcão #V-0010', valor: 186, status: 'rejeitado', chave: null,
    erro: 'Rejeição 539: duplicidade de NF-e com diferença na chave de acesso.', dias: -1 },
  { id: 9002, tipo: 'NFe', numero: null, referencia: 'Pedido #0046 · Restaurante 88', valor: 2315, status: 'rascunho', chave: null, erro: null, dias: 0 },
] as const;

// Links de pagamento de demonstração (tela 15), como o protótipo, com o valor do pedido/orçamento da demo. Clientes fictícios; o link aponta para um domínio
// de exemplo (nunca o do provedor). `dias` vira data dentro do handler.
const PAGAMENTOS: Array<{ id: number; descricao: string; valor: number; dias: number; metodo: string; status: string; pago: number | null; ref?: string }> = [
  { id: 501, descricao: 'Pedido #0044 · Clínica Vita', valor: 890, dias: -7, metodo: 'boleto', status: 'vencido', pago: null, ref: 'pedido:107' },
  { id: 502, descricao: 'Pedido #0046 · Restaurante 88', valor: 155, dias: 3, metodo: 'pix', status: 'pendente', pago: null, ref: 'pedido:109' },
  { id: 503, descricao: 'Pedido #0038 · Papelaria Sol', valor: 1190.5, dias: -5, metodo: 'pix', status: 'pago', pago: -5, ref: 'pedido:105' },
  { id: 504, descricao: 'Orçamento ORC-0114 · Clínica Vita', valor: 1290, dias: -12, metodo: 'cartao', status: 'cancelado', pago: null, ref: 'orcamento:205' },
];

// Tarefas de demonstração (API-CONTRATO-v1 §3). Urgente = atrasado (D11).
const TAREFAS = [
  { id: 'todo:15', origem: 'todo' as const, titulo: 'Ligar para o fornecedor de lona', subtitulo: 'ToDo · Compras', prazo: diaRel(-1), atrasado: true, grupo: 'atrasadas' as const },
  { id: 'ponto:31', origem: 'ponto' as const, titulo: 'Justificativa pendente — Consulta médica', subtitulo: 'Ponto · aguardando o gestor', prazo: diaRel(0), atrasado: false, grupo: 'hoje' as const },
  { id: 'todo:16', origem: 'todo' as const, titulo: 'Conferir arte do cardápio do Bistrô', subtitulo: 'ToDo · Pedido #0039', prazo: diaRel(0), atrasado: false, grupo: 'hoje' as const },
  { id: 'todo:17', origem: 'todo' as const, titulo: 'Enviar orçamento para a Papelaria Sol', subtitulo: 'ToDo · Comercial', prazo: diaRel(1), atrasado: false, grupo: 'amanha' as const },
  { id: 'todo:18', origem: 'todo' as const, titulo: 'Revisar estoque de vinil', subtitulo: 'ToDo · Produção', prazo: diaRel(4), atrasado: false, grupo: 'semana' as const },
];

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hhmm = () => new Date().toTimeString().slice(0, 5);
// Venda rápida (tela 11): catálogo e estoque fictícios do protótipo (s11). O estoque baixa a cada venda da demo.
const CATALOGO = [
  { id: 1, nome: 'Banner lona 0,80 × 1,20 m', categoria: 'Comunicação visual', preco: 89, estoque: 8 as number | null },
  { id: 2, nome: 'Adesivo recorte (un)', categoria: 'Adesivos', preco: 12, estoque: null as number | null },
  { id: 3, nome: 'Cartão de visita · 500 un', categoria: 'Gráfica rápida', preco: 145, estoque: 3 as number | null },
  { id: 4, nome: 'Placa PS 30 × 40 cm', categoria: 'Sinalização', preco: 38, estoque: 0 as number | null },
  { id: 5, nome: 'Lona impressa (m²)', categoria: 'Comunicação visual', preco: 42, estoque: null as number | null },
  { id: 6, nome: 'Caneca personalizada', categoria: 'Brindes', preco: 29.9, estoque: 5 as number | null },
];
const ROTULO_METODO: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro' };
let numeroVenda = 4820;
/** Idempotency-Key → corpo enviado + venda criada (repetição com o mesmo corpo devolve a mesma, sem baixar estoque de novo). */
const VENDAS_POR_CHAVE: Record<string, { corpo: string; venda: Record<string, unknown> }> = {};
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
/** "12.50" → 1250 centavos; só aceita texto com exatamente 2 casas e ponto decimal (como o app manda). */
const centavosDoTexto = (v: unknown): number | null => (typeof v === 'string' && /^\d+\.\d{2}$/.test(v) ? Number(v.replace('.', '')) : null);

const hashFake = (n: number) => (n * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(2).slice(0, 16);

export const demo = {
  logado: () => logado,
  async entrar(usuario: string, senha: string) {
    await espera(400);
    if (!usuario.trim() || senha.length < 3) throw Object.assign(new Error('Usuário ou senha incorretos.'), { status: 401 });
    logado = true;
    perfilDemo = /ponto/i.test(usuario) ? 'colaborador' : 'erp';
    semFinanceiro = /vendas/i.test(usuario);
    semVendas = /gestor/i.test(usuario);
  },
  sair() { logado = false; },
  async chamar<T>(metodo: string, caminho: string, corpo?: unknown, cabecalhos: Record<string, string> = {}): Promise<T> {
    await espera(250);
    const r = (v: unknown) => v as T;
    if (metodo === 'GET' && caminho.endsWith('/marcacoes/hoje')) return r({ data: new Date().toISOString().slice(0, 10), marcacoes });
    if (metodo === 'GET' && caminho.endsWith('/dashboard/kpis')) {
      return r({ marcacoes_hoje: marcacoes.length, intercorrencias_pendentes: intercorrencias.length, saldo_minutos: 135 });
    }
    if (metodo === 'GET' && caminho.endsWith('/saldo')) return r({ usa_banco_horas: true, saldo_minutos: 135, ultima_movimentacao: '2026-09-30' });
    if (metodo === 'GET' && caminho.endsWith('/escala/hoje')) {
      return r({ data: new Date().toISOString().slice(0, 10), escala: { id: 1, nome: 'Comercial 44h' },
        turno: { hora_entrada: '08:00', hora_almoco_inicio: '12:00', hora_almoco_fim: '13:00', hora_saida: '18:00' } });
    }
    if (metodo === 'GET' && caminho.endsWith('/intercorrencias')) return r({ intercorrencias });
    if (metodo === 'POST' && caminho.endsWith('/intercorrencias')) {
      const c = corpo as Record<string, unknown>;
      const i = { id: 'i' + Date.now(), codigo: null, tipo: c.tipo, estado: 'PENDENTE', data: c.data,
        dia_todo: !!c.dia_todo, intervalo_inicio: c.intervalo_inicio ?? null, intervalo_fim: c.intervalo_fim ?? null };
      intercorrencias.unshift(i);
      return r({ sucesso: true, intercorrencia: i });
    }
    if (metodo === 'POST' && caminho.endsWith('/marcar')) {
      const c = corpo as Record<string, unknown>;
      nsr += 1;
      const m = { id: 'd' + nsr, nsr, tipo: String(c.tipo), origem: 'MOBILE', hora: hhmm(), hash_trunc: hashFake(nsr), revisar: false };
      marcacoes.push(m);
      return r({ sucesso: true, marcacao: { ...m, momento: new Date().toISOString() } });
    }
    if (metodo === 'GET' && caminho.includes('/espelho')) {
      const hoje = new Date();
      const linhas = [];
      const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      // Só demonstração: no começo do mês ainda não há dia apurado; gera 12 dias para a lista aparecer.
      for (let d = 1; d < Math.max(hoje.getDate(), 13); d++) {
        const dt = new Date(hoje.getFullYear(), hoje.getMonth(), d);
        const fim = dt.getDay() === 0 || dt.getDay() === 6;
        const div = d === 7 || d % 9 === 4;
        linhas.push({ data: dt.toISOString().slice(0, 10), dow: nomes[dt.getDay()], dia: d, is_weekend: fim,
          trabalhado: fim ? 0 : div ? 412 : 480 + (d % 3) * 7, divergencia: !fim && div, estado: fim ? '' : div ? 'DIVERGENCIA' : 'OK',
          marcacoes: fim ? [] : div ? [{ hora: '08:01', tipo: 'ENTRADA', origem: 'MOBILE' }, { hora: '12:00', tipo: 'ALMOCO_INICIO', origem: 'MOBILE' }, { hora: '15:52', tipo: 'SAIDA', origem: 'MOBILE' }]
            : [{ hora: '07:58', tipo: 'ENTRADA', origem: 'MOBILE' }, { hora: '12:02', tipo: 'ALMOCO_INICIO', origem: 'MOBILE' }, { hora: '13:01', tipo: 'ALMOCO_FIM', origem: 'MOBILE' }, { hora: '18:05', tipo: 'SAIDA', origem: 'MOBILE' }] });
      }
      const util = linhas.filter((l) => !l.is_weekend);
      return r({ totais: { trabalhado: util.reduce((s, l) => s + l.trabalhado, 0), atraso: 22, falta: 68, he_diurna: 95, he_noturna: 0, divergencias: util.filter((l) => l.divergencia).length }, linhas });
    }
    if (metodo === 'GET' && caminho.endsWith('/me')) {
      return r({ nome: 'Colaborador Demonstração', matricula: '0021', empresa: 'Empresa Demonstração', limites: { accuracy_max: 500, drift_max: 30 } });
    }
    if (metodo === 'GET' && caminho.endsWith('/intercorrencias/tipos')) {
      return r([['CONSULTA_MEDICA', 'Consulta médica'], ['ATESTADO_MEDICO', 'Atestado médico'], ['REUNIAO_EXTERNA', 'Reunião externa'],
        ['VISITA_CLIENTE', 'Visita a cliente'], ['HORA_EXTRA_AUTORIZADA', 'Hora extra autorizada'], ['ESQUECIMENTO_MARCACAO', 'Esquecimento de marcação'],
        ['PROBLEMA_EQUIPAMENTO', 'Problema no equipamento'], ['OUTRO', 'Outro']].map(([value, label]) => ({ value, label })));
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/pedidos')) {
      const m = caminho.match(/^\/api\/app\/pedidos\/(\d+)/);
      if (m) {
        const p = PEDIDOS.find((x) => x.id === Number(m[1]));
        if (!p) throw Object.assign(new Error('Pedido não encontrado.'), { status: 404 });
        const ordem = ['orcamento', 'aprovacao', 'producao', 'entrega', 'concluido'] as const;
        const rot = ['Orçamento', 'Aprovação', 'Produção', 'Entrega', 'Concluído'];
        const pos = ordem.indexOf(p.etapa.grupo);
        return r({ ...p, resumo: p.itens[0]?.produto ?? null, cliente: { id: p.id + 500, nome: p.cliente, telefone: '(48) 99999-0000' },
          itens_venda: p.itens, etapas: ordem.map((g, i) => ({ grupo: g, rotulo: rot[i], estado: i < pos ? 'feito' : i === pos ? 'atual' : 'futuro' })),
          acoes: p.etapa.grupo === 'concluido' ? [] : [{ chave: 'avancar', rotulo: ACAO[p.etapa.grupo], pode: true }] });
      }
      const filtro = (caminho.match(/filtro=(\w+)/) || [])[1] || 'ativos';
      const ativos = PEDIDOS.filter((p) => p.etapa.grupo !== 'concluido');
      const lista = filtro === 'todos' ? PEDIDOS : filtro === 'concluidos' ? PEDIDOS.filter((p) => p.etapa.grupo === 'concluido')
        : filtro === 'atrasados' ? PEDIDOS.filter((p) => p.atrasado) : ativos;
      return r({ itens: lista.map(({ itens, ...p }) => ({ ...p, resumo: itens[0]?.produto ?? null })), pagina: 1, tem_mais: false,
        contadores: { ativos: ativos.length, atrasados: PEDIDOS.filter((p) => p.atrasado).length,
          concluidos: PEDIDOS.filter((p) => p.etapa.grupo === 'concluido').length, todos: PEDIDOS.length } });
    }
    if (metodo === 'GET' && caminho === '/api/app/producao') {
      const rotulos: Record<string, string> = { quote_approved: 'Aprovado pelo cliente', in_production: 'Em produção', on_hold: 'Em espera', ready_for_invoice: 'Pronto pra faturar' };
      const colunas = Object.keys(rotulos).map((id) => ({ id, rotulo: rotulos[id],
        total: PEDIDOS.filter((x) => x.etapa.chave === id).length,
        itens: PEDIDOS.filter((x) => x.etapa.chave === id).map(({ itens, ...x }) => ({ ...x, resumo: itens[0]?.produto ?? null }))
          .sort((a, b) => (a.prazo ?? '9').localeCompare(b.prazo ?? '9')) }));
      return r({ colunas });
    }
    if (metodo === 'GET' && /^\/api\/app\/pessoas\/\d+\/cadastro$/.test(caminho)) {
      const p = PESSOAS.find((x) => x.id === Number(caminho.split('/')[4]));
      if (!p) throw Object.assign(new Error('Pessoa não encontrada.'), { status: 404 });
      return r(cadastroDemo(p));
    }
    if (metodo === 'PATCH' && /^\/api\/app\/pessoas\/\d+$/.test(caminho)) {
      const p = PESSOAS.find((x) => x.id === Number(caminho.split('/')[4]));
      if (!p) throw Object.assign(new Error('Pessoa não encontrada.'), { status: 404, codigo: 'nao_encontrado' });
      const n = (corpo ?? {}) as Record<string, unknown>;
      const campos: Record<string, string> = {};
      if ('nome' in n && !String(n.nome ?? '').trim()) campos.nome = 'Informe o nome.';
      const doc = String(n.documento ?? '').replace(/\D/g, '');
      if (doc && doc.length !== (p.tipo === 'PJ' ? 14 : 11)) campos.documento = p.tipo === 'PJ' ? 'CNPJ inválido.' : 'CPF inválido.';
      for (const k of ['email', 'email_nfe']) if (n[k] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(n[k]))) campos[k] = 'E-mail inválido.';
      if (Object.keys(campos).length) throw Object.assign(new Error(Object.values(campos)[0]), { status: 422, codigo: 'validacao', campos });
      const c = { ...(EDICOES[p.id] ?? {}) };
      for (const [k, v] of Object.entries(n)) {
        if (k === 'consentimento') c.consentimento = { ...((c.consentimento as object | undefined) ?? {}), ...(v as object) };
        else c[k] = v;
      }
      EDICOES[p.id] = c;
      if ('nome' in n) p.nome = String(n.nome).trim();
      if ('documento' in n) p.documento = (n.documento as string) || null;
      if ('telefone' in n) p.telefone = (n.telefone as string) || null;
      if ('email' in n) p.email = (n.email as string) || null;
      if ('cidade' in n) p.cidade = (n.cidade as string) || null;
      return r({ id: p.id });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/cep/')) {
      const cep = caminho.slice('/api/app/cep/'.length).replace(/\D/g, '');
      if (cep.length !== 8) throw Object.assign(new Error('O CEP tem 8 dígitos.'), { status: 422, codigo: 'validacao' });
      // Só um CEP conhecido na demo; o resto responde como CEP inexistente.
      if (cep !== '88701000') throw Object.assign(new Error('CEP não encontrado.'), { status: 404, codigo: 'nao_encontrado' });
      return r({ cep, logradouro: 'Rua da Demonstração', complemento: null, bairro: 'Centro', cidade: 'Tubarão', uf: 'SC', codigo_ibge: '4218707' });
    }
    if (metodo === 'POST' && caminho === '/api/app/pessoas') {
      const n = (corpo ?? {}) as Record<string, unknown>;
      const campos: Record<string, string> = {};
      if (!String(n.nome ?? '').trim()) campos.nome = 'Informe o nome.';
      const doc = String(n.documento ?? '').replace(/\D/g, '');
      if (doc && doc.length !== (n.tipo === 'PJ' ? 14 : 11)) campos.documento = n.tipo === 'PJ' ? 'CNPJ inválido.' : 'CPF inválido.';
      for (const k of ['email', 'email_nfe']) if (n[k] && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(n[k]))) campos[k] = 'E-mail inválido.';
      if (!Array.isArray(n.papeis) || !n.papeis.length) campos.papeis = 'Escolha ao menos um papel.';
      if (Object.keys(campos).length) throw Object.assign(new Error(Object.values(campos)[0]), { status: 422, codigo: 'validacao', campos });
      const id = 1 + Math.max(...PESSOAS.map((x) => x.id));
      PESSOAS.push({ id, nome: String(n.nome).trim(), tipo: n.tipo === 'PJ' ? 'PJ' : 'PF', documento: doc ? String(n.documento) : null,
        papeis: (n.papeis as string[]).slice(), saldo_aberto: 0, telefone: (n.telefone as string) || null, email: (n.email as string) || null, cidade: (n.cidade as string) || null });
      PESSOAS.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return r({ id });
    }
    const detEstoque = caminho.match(/^\/api\/app\/estoque\/(\d+)/);
    if (metodo === 'GET' && detEstoque) {
      const item = ESTOQUE.find((x) => x.id === Number(detEstoque[1]));
      if (!item) throw Object.assign(new Error('Item de estoque não encontrado.'), { status: 404, codigo: 'nao_encontrado' });
      return r({ item, historico: HISTORICO[item.id] ?? [], pagina: 1, tem_mais: false });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/estoque')) {
      const filtro = (caminho.match(/filtro=(\w+)/) || [])[1] || 'todos';
      const q = decodeURIComponent((caminho.match(/[?&]q=([^&]*)/) || [])[1] || '').toLowerCase();
      const baixo = (x: (typeof ESTOQUE)[number]) => x.minimo !== null && x.qtd <= x.minimo;
      const busca = ESTOQUE.filter((x) => !q || x.nome.toLowerCase().includes(q) || x.codigo.toLowerCase().includes(q));
      return r({ itens: busca.filter((x) => filtro === 'todos' || baixo(x)), contadores: { todos: busca.length, baixo: busca.filter(baixo).length },
        pagina: 1, tem_mais: false });
    }
    // Tela 20 (contrato §9.4). A demo faz o papel do ERP: produto nasce sem preço.
    if (metodo === 'GET' && caminho === '/api/app/produtos/opcoes') {
      return r({ categorias: CATEGORIAS, unidades: UNIDADES });
    }
    if (metodo === 'POST' && caminho === '/api/app/produtos') {
      const n = (corpo ?? {}) as { nome?: string; codigo?: string | null; categoria_id?: number | null; unidade_id?: number;
        estoque?: { controla?: boolean; minimo?: number | null }; fiscal?: Record<string, string | null> };
      const campos: Record<string, string> = {};
      if (!String(n.nome ?? '').trim()) campos.nome = 'Informe o nome do produto.';
      const unidade = UNIDADES.find((u) => u.id === n.unidade_id);
      if (!unidade) campos.unidade_id = 'Unidade inválida.';
      if (n.categoria_id != null && !CATEGORIAS.some((c) => c.id === n.categoria_id)) campos.categoria_id = 'Categoria inválida.';
      if (n.codigo && PRODUTOS.some((x) => x.codigo.toLowerCase() === String(n.codigo).toLowerCase())) campos.codigo = 'Este código já está em uso.';
      if (n.estoque?.minimo != null && n.estoque.minimo < 0) campos['estoque.minimo'] = 'O estoque mínimo não pode ser negativo.';
      const tam: Record<string, number> = { ncm: 8, cest: 7, cfop_interno: 4, cfop_externo: 4 };
      for (const [k, t] of Object.entries(tam)) {
        const v = n.fiscal?.[k];
        if (v && (v.length !== t || /[^0-9]/.test(v))) campos['fiscal.' + k] = 'Informe ' + t + ' dígitos.';
      }
      if (Object.keys(campos).length) throw Object.assign(new Error(Object.values(campos)[0]), { status: 422, codigo: 'validacao', campos });
      const id = 1 + Math.max(...PRODUTOS.map((x) => x.id));
      const codigo = n.codigo || 'PRD-' + id;
      PRODUTOS.push({ id, nome: String(n.nome).trim(), codigo, cat: n.categoria_id ?? null, unidade: unidade!.curta, preco: null,
        variacoes: null, qtd: n.estoque?.controla === false ? null : 0,
        // Regra do alerta da web: saldo ≤ mínimo. Nasce com saldo 0.
        baixo: n.estoque?.controla !== false && n.estoque?.minimo != null && 0 <= n.estoque.minimo });
      PRODUTOS.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
      return r({ id, codigo });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/produtos')) {
      const cat = (caminho.match(/categoria=(\w+)/) || [])[1] || 'todas';
      const q = decodeURIComponent((caminho.match(/[?&]q=([^&]*)/) || [])[1] || '').toLowerCase();
      const nomeCat = (id: number | null) => CATEGORIAS.find((c) => c.id === id)?.nome ?? null;
      const busca = PRODUTOS.filter((x) => !q || [x.nome, x.codigo, nomeCat(x.cat) ?? ''].some((t) => t.toLowerCase().includes(q)));
      const categorias = CATEGORIAS.map((c) => ({ ...c, total: busca.filter((x) => x.cat === c.id).length })).filter((c) => c.total > 0);
      const itens = busca.filter((x) => cat === 'todas' || x.cat === Number(cat)).map((x) => ({
        id: x.id, nome: x.nome, codigo: x.codigo, categoria: nomeCat(x.cat), calculo: 'por ' + x.unidade, preco: x.preco, variacoes: x.variacoes,
        estoque: { controla: x.qtd !== null, qtd: x.qtd, unidade: x.qtd !== null ? x.unidade : 'un' }, baixo: x.baixo }));
      return r({ itens, categorias, total: busca.length, baixo_estoque: busca.filter((x) => x.baixo).length, pagina: 1, tem_mais: false });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/pessoas')) {
      const det = caminho.match(/^\/api\/app\/pessoas\/(\d+)/);
      if (det) {
        const p = PESSOAS.find((x) => x.id === Number(det[1]));
        if (!p) throw Object.assign(new Error('Pessoa não encontrada.'), { status: 404 });
        const peds = PEDIDOS.filter((x) => x.cliente === p.nome);
        const soma = peds.reduce((a, x) => a + x.valor, 0);
        return r({ id: p.id, nome: p.nome, tipo: p.tipo, documento: p.documento, papeis: p.papeis, ativo: true,
          contato: { telefone: p.telefone, email: p.email }, endereco: { cidade: p.cidade, uf: 'SC' },
          kpis: { pedidos: peds.length, ticket_medio: peds.length ? Math.round((soma / peds.length) * 100) / 100 : 0, saldo_aberto: p.saldo_aberto },
          pedidos_recentes: peds.map((x) => ({ id: x.id, numero: x.numero, data: x.prazo, valor: x.valor })) });
      }
      const papel = (caminho.match(/papel=(\w+)/) || [])[1] || 'todos';
      const q = decodeURIComponent((caminho.match(/[?&]q=([^&]*)/) || [])[1] || '').toLowerCase();
      const PAPEL: Record<string, string> = { clientes: 'cliente', fornecedores: 'fornecedor', funcionarios: 'funcionario' };
      const noPapel = (x: (typeof PESSOAS)[number], pp: string) => pp === 'todos' || (pp === 'em_debito' ? x.saldo_aberto > 0 : x.papeis.includes(PAPEL[pp]));
      const busca = PESSOAS.filter((x) => !q || x.nome.toLowerCase().includes(q) || (x.telefone ?? '').includes(q));
      const contadores = Object.fromEntries(['todos', 'clientes', 'fornecedores', 'funcionarios', 'em_debito'].map((pp) => [pp, busca.filter((x) => noPapel(x, pp)).length]));
      const itens = busca.filter((x) => noPapel(x, papel)).map(({ id, nome, tipo, papeis, saldo_aberto }) => ({ id, nome, tipo, papeis, saldo_aberto, ativo: true }));
      return r({ itens, contadores, pagina: 1, tem_mais: false });
    }
    if (metodo === 'GET' && caminho === '/api/app/inicio') {
      const ativos = PEDIDOS.filter((x) => x.etapa.grupo !== 'concluido');
      if (perfilDemo === 'colaborador') {
        return r({ perfil: 'colaborador', abre_em: 'ponto', areas: ['ponto', 'mais'], usuario: 'Colaborador', empresa: 'Gráfica Demonstração',
          faturado_hoje: null, meta_dia: null, kpis: { pedidos_ativos: null, pedidos_atrasados: null, estoque_baixo: null }, financeiro: null, proximas_tarefas: [] });
      }
      return r({ perfil: 'erp', abre_em: 'inicio', areas: ['inicio', 'tarefas', 'pedidos', 'producao', 'pessoas', 'orcamentos', 'produtos', 'estoque', 'financeiro', 'fiscal', 'relatorios', 'dashboard', 'assistente', 'equipe', 'oficina', 'pagamentos', 'ponto', 'ponto_gestor', 'mais'],
        usuario: 'Colaborador', empresa: 'Gráfica Demonstração',
        faturado_hoje: { valor: 1520, ontem: 1300, variacao_pct: 16.9 }, meta_dia: { valor: 2000, derivada: true },
        kpis: { pedidos_ativos: ativos.length, pedidos_atrasados: PEDIDOS.filter((x) => x.atrasado).length, estoque_baixo: ESTOQUE.filter((x) => x.minimo !== null && x.qtd <= x.minimo).length },
        financeiro: { a_receber: 8200, a_pagar: 3100 },
        proximas_tarefas: TAREFAS.slice(0, 3), nao_lidas: NOTIFICACOES.filter((x) => !x.lida).length, barra: barraDemo ?? BARRA_PADRAO_DEMO });
    }
    if (metodo === 'PUT' && caminho === '/api/app/perfil-menu') {
      const { modulos } = (corpo ?? {}) as { modulos?: string[] };
      const liberados: string[] = ['inicio', 'tarefas', 'pedidos', 'producao', 'pessoas', 'orcamentos', 'produtos', 'estoque', 'financeiro', 'fiscal', 'relatorios', 'dashboard', 'assistente', 'equipe', 'ponto', 'ponto_gestor', 'pagamentos', 'mais'];
      // Como o ERP #8592: [] apaga a escolha; mais de 3, repetido ou fora das áreas → 422 com campos.modulos (texto).
      const erro = !Array.isArray(modulos) ? 'Envie a lista de módulos.'
        : modulos.length > 3 ? 'Máximo de 3 módulos: Início e Mais são fixos.'
        : new Set(modulos).size !== modulos.length ? 'Módulo repetido.'
        : modulos.some((m) => !liberados.includes(m) || m === 'inicio' || m === 'mais') ? 'Há módulo que seu usuário não pode usar.' : null;
      if (erro) throw Object.assign(new Error(erro), { status: 422, codigo: 'validacao', campos: { modulos: erro } });
      await espera(400);
      barraDemo = modulos!.length ? [...modulos!] : null;
      return r({ modulos: barraDemo ?? [], barra: barraDemo ?? BARRA_PADRAO_DEMO });
    }
    if (metodo === 'POST' && caminho === '/api/app/notificacoes/lidas') {
      const marcadas = NOTIFICACOES.filter((x) => !x.lida).length;
      NOTIFICACOES.forEach((x) => { x.lida = true; });
      return r({ nao_lidas: 0, marcadas });
    }
    if (metodo === 'POST' && caminho.startsWith('/api/app/notificacoes/') && caminho.endsWith('/lida')) {
      const nt = NOTIFICACOES.find((x) => x.id === decodeURIComponent(caminho.split('/')[4]));
      if (!nt) throw Object.assign(new Error('Notificação não encontrada.'), { status: 404, codigo: 'nao_encontrado' });
      nt.lida = true;
      return r({ nao_lidas: NOTIFICACOES.filter((x) => !x.lida).length });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/notificacoes')) {
      // Hora calculada aqui, nunca no topo do módulo: chamada no topo impede o build de produção de descartar o demo.
      const itens = NOTIFICACOES.map(({ min, ...x }) => ({ ...x, quando: new Date(Date.now() - min * 60000).toISOString() }));
      return r({ itens, nao_lidas: NOTIFICACOES.filter((x) => !x.lida).length, pagina: 1, tem_mais: false });
    }
    if (metodo === 'GET' && /^\/api\/app\/tarefas\/todo\/\d+$/.test(caminho)) {
      const id = Number(caminho.split('/')[5]);
      const tf = TAREFAS.find((x) => x.id === 'todo:' + id);
      if (!tf) throw Object.assign(new Error('Tarefa não encontrada.'), { status: 404 });
      // Como a API (#8556): checklist sempre [], cliente e origem null, comentários do mais antigo ao mais novo.
      return r({ id: tf.id, titulo: tf.titulo, modulo: 'Tarefa · alta', responsavel: 'Colaborador Demonstração, Carla',
        descricao: id === 16 ? 'Conferir medidas e ortografia antes de mandar para o cliente aprovar.' : null,
        cliente: null, prazo: tf.prazo, atrasado: tf.atrasado, origem: null, checklist: [],
        comentarios: [{ quando: diaRel(0) + 'T08:40:00-03:00', autor: 'Carla', texto: 'pediu letra maior ao fornecedor', detalhe: null },
          { quando: diaRel(0) + 'T09:12:00-03:00', autor: 'Carla', texto: 'enviou a arte v3 ao cliente', detalhe: null }],
        concluida: false });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/ponto/aprovacoes')) {
      // Hora calculada aqui, nunca no topo do módulo.
      const est = (caminho.match(/estado=(\w+)/) || [])[1] || 'pendente';
      const itens = VALIDACAO.filter((x) => est === 'todas' || x.estado === est)
        .map(({ min, ...x }) => ({ ...x, marcada_em: new Date(Date.now() - min * 60000).toISOString() }));
      const conta = (e: string) => VALIDACAO.filter((x) => x.estado === e).length;
      return r({ itens, contadores: { pendente: conta('pendente'), validada: conta('validada'), recusada: conta('recusada'), todas: VALIDACAO.length }, pode_recusar: true });
    }
    if (metodo === 'POST' && /^\/api\/app\/ponto\/aprovacoes\/[^/]+\/(validar|recusar)$/.test(caminho)) {
      const partes = caminho.split('/');
      const m = VALIDACAO.find((x) => x.id === decodeURIComponent(partes[5]));
      if (!m) throw Object.assign(new Error('Marcação não encontrada.'), { status: 404, codigo: 'nao_encontrado' });
      if (m.estado !== 'pendente') throw Object.assign(new Error('Esta marcação já foi revisada.'), { status: 409, codigo: 'ja_revisada' });
      // Demo: só muda o estado da fila. No ERP a recusa grava uma anulação nova; a marcação não é tocada.
      if (partes[6] === 'validar') { m.estado = 'validada'; return r({ estado: 'validada' }); }
      m.estado = 'recusada'; nsr += 1;
      return r({ estado: 'recusada', nsr_anulacao: nsr });
    }
    if (metodo === 'GET' && caminho === '/api/app/equipe') {
      // Nomes do protótipo (tela 26), nas regras do ERP #8588: ordem alfabética, carga só de OS, status montado
      // pelo ERP (Em serviço quando tem carga, Disponível sem, Inativo para usuário inativo).
      return r({ itens: [
        { id: 2, nome: 'André Silva', funcao: 'Impressor · plotter 1,60', carga: null, status: { rotulo: 'Disponível', tom: 'livre' } },
        { id: 3, nome: 'Bruno Cruz', funcao: 'Mecânico · Box 1', carga: '1 OS', status: { rotulo: 'Em serviço', tom: 'ocupado' } },
        { id: 4, nome: 'Carla Menezes', funcao: 'Administrativo · financeiro', carga: null, status: { rotulo: 'Disponível', tom: 'livre' } },
        { id: 1, nome: 'Jefferson Moraes', funcao: 'Mecânico · Box 2', carga: '2 OS', status: { rotulo: 'Em serviço', tom: 'ocupado' } },
        { id: 5, nome: 'Wagner Rodrigues', funcao: 'Dono · admin', carga: null, status: { rotulo: 'Inativo', tom: 'ausente' } },
      ] });
    }
    if (metodo === 'POST' && caminho === '/api/app/chat') {
      const { mensagem } = (corpo ?? {}) as { mensagem?: string };
      if (!mensagem || !mensagem.trim()) throw Object.assign(new Error('Escreva uma mensagem.'), { status: 422, codigo: 'validacao' });
      await espera(900);
      const agora = new Date().toISOString();
      conversaDemo.push({ de: 'eu', texto: mensagem.trim(), criada_em: agora });
      const resposta = { de: 'jana' as const, texto: respostaJana(mensagem), criada_em: new Date().toISOString() };
      conversaDemo.push(resposta);
      return r({ conversa_id: 'demo-1', resposta });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/chat/')) {
      return r({ conversa_id: 'demo-1', mensagens: conversaDemo });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/orcamentos')) {
      const st = (caminho.match(/status=(\w+)/) || [])[1] || 'todos';
      const conta = (s: string) => ORCAMENTOS.filter((x) => x.status === s).length;
      return r({ itens: ORCAMENTOS.filter((x) => st === 'todos' || x.status === st), pagina: 1, tem_mais: false,
        contadores: { todos: ORCAMENTOS.length, rascunho: conta('rascunho'), enviado: conta('enviado'), aprovado: conta('aprovado'), convertido: conta('convertido') } });
    }
    if (metodo === 'GET' && caminho === '/api/app/pagamentos/referencias') {
      // Pedidos não concluídos e orçamentos enviados/aprovados. `valor` = saldo em aberto (na demo nada foi pago em parte, então é o total).
      const itens = [
        ...PEDIDOS.filter((x) => x.etapa.grupo !== 'concluido').map((x) => ({ tipo: 'pedido', id: x.id, rotulo: 'Pedido #' + x.numero, cliente: x.cliente, valor: x.valor })),
        ...ORCAMENTOS.filter((x) => x.status === 'enviado' || x.status === 'aprovado').map((x) => ({ tipo: 'orcamento', id: x.id, rotulo: 'Orçamento ' + x.numero, cliente: x.cliente, valor: x.valor })),
      ];
      return r({ itens });
    }
    if (metodo === 'POST' && caminho === '/api/app/pagamentos') {
      const n = (corpo ?? {}) as { referencia?: { tipo?: string; id?: number }; metodo?: string; vencimento_dias?: number };
      // Como o ERP: o valor sai do documento; um "valor" no corpo seria ignorado.
      const ped = n.referencia?.tipo === 'pedido' ? PEDIDOS.find((x) => x.id === n.referencia?.id) : undefined;
      const orc = n.referencia?.tipo === 'orcamento' ? ORCAMENTOS.find((x) => x.id === n.referencia?.id) : undefined;
      if (!ped && !orc) throw Object.assign(new Error('Escolha um pedido ou orçamento.'), { status: 422, codigo: 'validacao', campos: { referencia: 'Escolha um pedido ou orçamento.' } });
      if (![3, 7, 15].includes(Number(n.vencimento_dias))) throw Object.assign(new Error('Prazo inválido.'), { status: 422, codigo: 'validacao', campos: { vencimento_dias: 'Prazo inválido.' } });
      const ref = `${n.referencia!.tipo}:${n.referencia!.id}`;
      if (n.metodo === 'cartao') throw Object.assign(new Error('Cartão não pode ser cobrado pelo app.'), { status: 422, codigo: 'validacao', campos: { metodo: 'Cartão não pode ser cobrado pelo app.' } });
      // Como o ERP (§10.6): bloqueia a 2ª cobrança se já há uma em aberto no prazo ou se já foi paga (o gateway não baixa a venda).
      if (PAGAMENTOS.some((x) => x.ref === ref && x.status === 'pendente')) {
        throw Object.assign(new Error('Já existe uma cobrança em aberto para este documento.'), { status: 409, codigo: 'ja_existe' });
      }
      if (PAGAMENTOS.some((x) => x.ref === ref && x.status === 'pago')) {
        throw Object.assign(new Error('Este documento já tem cobrança paga: registre o pagamento na venda antes de cobrar de novo.'), { status: 409, codigo: 'ja_existe' });
      }
      const id = 1 + Math.max(...PAGAMENTOS.map((x) => x.id));
      const novo = { id, descricao: ped ? `Pedido #${ped.numero} · ${ped.cliente}` : `Orçamento ${orc!.numero} · ${orc!.cliente}`,
        valor: ped ? ped.valor : orc!.valor, dias: Number(n.vencimento_dias), metodo: String(n.metodo ?? 'qualquer'), status: 'pendente', pago: null, ref };
      PAGAMENTOS.unshift(novo);
      return r({ id, descricao: novo.descricao, valor: novo.valor, vencimento: diaRel(novo.dias), metodo: novo.metodo, status: 'pendente', pago_em: null,
        link: `https://pagamento.exemplo/c/${id}` });
    }
    if (metodo === 'POST' && /^\/api\/app\/pagamentos\/\d+\/(consultar|cancelar)$/.test(caminho)) {
      const [, , , , idTxt, acao] = caminho.split('/');
      const p = PAGAMENTOS.find((x) => x.id === Number(idTxt));
      if (!p) throw Object.assign(new Error('Cobrança não encontrada.'), { status: 404, codigo: 'nao_encontrado' });
      if (acao === 'cancelar') {
        if (p.status === 'pago') throw Object.assign(new Error('Cobrança já paga não pode ser cancelada.'), { status: 409, codigo: 'nao_cancelavel' });
        p.status = 'cancelado';
      } else if (p.status === 'pendente' || p.status === 'vencido') {
        // Demo: o provedor confirma o pagamento hoje, como no protótipo.
        p.status = 'pago'; p.pago = 0;
      }
      return r({ id: p.id, descricao: p.descricao, valor: p.valor, vencimento: diaRel(p.dias), metodo: p.metodo, status: p.status,
        pago_em: p.pago === null ? null : diaRel(p.pago), link: p.status === 'cancelado' ? null : `https://pagamento.exemplo/c/${p.id}` });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/financeiro')) {
      const aba = (caminho.match(/aba=(\w+)/) || [])[1] || 'receber';
      // Datas calculadas aqui, nunca no topo do módulo (o build de produção precisa descartar o demo).
      const hoje = diaRel(0);
      const todos = LANCAMENTOS.map(({ dias, pago, ...l }) => {
        const data = diaRel(dias);
        return { ...l, vencimento: data, pago_em: pago ? data : null, status: pago ? 'liquidado' : data < hoje ? 'vencido' : 'aberto' };
      });
      const abertos = (t: string) => todos.filter((l) => l.tipo === t && l.status !== 'liquidado');
      const extrato = todos.filter((l) => l.status === 'liquidado').sort((a, b) => (b.pago_em ?? '').localeCompare(a.pago_em ?? ''));
      const itens = aba === 'extrato' ? extrato : abertos(aba === 'pagar' ? 'pagar' : 'receber').sort((a, b) => a.vencimento.localeCompare(b.vencimento));
      const soma = (l: Array<{ valor: number }>) => l.reduce((x, y) => x + y.valor, 0);
      const recebido = 148230, pago = 96410;
      return r({ resumo: { mes: hoje.slice(0, 7), recebido, pago, saldo: recebido - pago,
          a_receber: soma(abertos('receber')), vencido: soma(abertos('receber').filter((l) => l.status === 'vencido')), a_pagar: soma(abertos('pagar')) },
        contas: [{ id: 1, nome: 'Conta movimento', detalhe: 'Banco · ag. 0001', saldo: 42318.4 },
          { id: 2, nome: 'Caixa balcão', detalhe: 'Dinheiro', saldo: 1940 }, { id: 3, nome: 'Recebíveis', detalhe: 'Cartões', saldo: null }],
        itens, contadores: { receber: abertos('receber').length, pagar: abertos('pagar').length, extrato: extrato.length }, pagina: 1, tem_mais: false });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/fiscal')) {
      const st = (caminho.match(/status=(\w+)/) || [])[1] || 'todos';
      // Datas calculadas aqui, nunca no topo do módulo (o build de produção precisa descartar o demo).
      const docs = FISCAIS.map(({ dias, ...d }) => ({ ...d, emitido_em: diaRel(dias) + 'T10:00:00-03:00' }));
      const conta = (s: string) => docs.filter((d) => d.status === s).length;
      return r({ itens: docs.filter((d) => st === 'todos' || d.status === st), pagina: 1, tem_mais: false,
        contadores: { todos: docs.length, rascunho: conta('rascunho'), processando: conta('processando'), autorizado: conta('autorizado'),
          cancelado: conta('cancelado'), rejeitado: conta('rejeitado') } });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/relatorios')) {
      const periodo = (caminho.match(/periodo=(\w+)/) || [])[1] || 'mes';
      const aba = (caminho.match(/aba=(\w+)/) || [])[1] || 'dre';
      // Números fictícios do protótipo, escalados pelo período. Datas calculadas aqui (o build de produção descarta o demo).
      const f = periodo === 'ano' ? 11.4 : periodo === 'trimestre' ? 2.9 : 1;
      const v = (x: number) => Math.round(x * f * 100) / 100;
      const rec = v(148230), desp = v(96410);
      const parte = (total: number, l: Array<[string, number]>) => l.map(([nome, p]) => ({ nome, valor: Math.round(total * p * 100) / 100 }));
      const de = periodo === 'mes' ? diaRel(0).slice(0, 8) + '01' : diaRel(periodo === 'ano' ? -365 : -90);
      const ativos = PEDIDOS.filter((x) => x.etapa.grupo === 'producao');
      const etapas = [...new Set(ativos.map((x) => x.etapa.rotulo))].map((rotulo) => ({ rotulo, total: ativos.filter((x) => x.etapa.rotulo === rotulo).length }));
      return r({ periodo: { de, ate: diaRel(0) },
        kpis: semFinanceiro ? null : { receitas: rec, despesas: desp, saldo: Math.round((rec - desp) * 100) / 100, margem_pct: Math.round(((rec - desp) / rec) * 1000) / 10 },
        dre: aba !== 'dre' || semFinanceiro ? null : { receitas_por_categoria: parte(rec, [['Comunicação visual', 0.58], ['Gráfica rápida', 0.27], ['Balcão', 0.15]]),
          despesas_por_categoria: parte(desp, [['Insumos', 0.46], ['Folha', 0.31], ['Aluguel e energia', 0.14], ['Outros', 0.09]]) },
        vendas: aba !== 'vendas' ? null : {
          receita_por_dia: [4.2, 5.1, 3.8, 6.4, 7.2, 2.1, 1.4, 5.8, 6.1, 4.9, 7.8, 8.4, 3.2, 8.42].map((x, i) => ({ data: diaRel(i - 13), valor: x * 1000 })),
          top_clientes: parte(v(61000), [['Papelaria Sol', 0.3], ['Clínica Vita', 0.25], ['Restaurante 88', 0.19], ['Bistrô do Forno', 0.16], ['Marília Costa', 0.1]]) },
        producao: aba !== 'producao' ? null : { por_etapa: etapas },
        estoque: aba !== 'estoque' ? null : { baixo: [{ nome: 'Lona 440 g', quantidade: 2, minimo: 5, unidade: 'un' },
          { nome: 'Vinil adesivo branco', quantidade: 8, minimo: 10, unidade: 'm' }] } });
    }
    if (metodo === 'GET' && caminho === '/api/app/dashboard') {
      // Números fictícios do protótipo; datas calculadas aqui (o build de produção precisa descartar o demo).
      const ativos = PEDIDOS.filter((x) => x.etapa.grupo !== 'concluido');
      return r({ faturamento_30d: { valor: 148230, variacao_pct: 12, serie_semanal: [92000, 104000, 98000, 121000, 117000, 133000, 148230] },
        kpis: { pedidos_ativos: semVendas ? null : ativos.length, pedidos_novos: semVendas ? null : 4,
          producao_em_curso: semVendas ? null : PEDIDOS.filter((x) => x.etapa.chave === 'in_production').length, a_receber: semFinanceiro ? null : 11415, vencido: semFinanceiro ? null : 1260 },
        pedidos_por_dia: semVendas ? null : [3, 5, 4, 6, 8, 2, 1, 5, 7, 6, 9, 8, 4, 4].map((total, i) => ({ data: diaRel(i - 13), total })),
        meta_mes: { valor: 200000, realizado_pct: 70 }, producao_concluida: semVendas ? null : { concluidas: 1, total: 5 } });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/pagamentos')) {
      const st = (caminho.match(/status=(\w+)/) || [])[1] || 'todos';
      // Datas calculadas aqui, nunca no topo do módulo (o build de produção precisa descartar o demo).
      const itens = PAGAMENTOS.map(({ dias, pago, ...p }) => ({ ...p, vencimento: diaRel(dias), pago_em: pago === null ? null : diaRel(pago),
        link: p.status === 'cancelado' ? null : `https://pagamento.exemplo/c/${p.id}` }));
      const conta = (s: string) => itens.filter((p) => p.status === s).length;
      return r({ itens: itens.filter((p) => st === 'todos' || p.status === st), pagina: 1, tem_mais: false,
        contadores: { todos: itens.length, pendente: conta('pendente'), pago: conta('pago'), vencido: conta('vencido'), cancelado: conta('cancelado') } });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/pagamentos')) {
      const st = (caminho.match(/status=(\w+)/) || [])[1] || 'todos';
      // Datas calculadas aqui, nunca no topo do módulo (o build de produção precisa descartar o demo).
      const itens = PAGAMENTOS.map(({ dias, pago, ...p }) => ({ ...p, vencimento: diaRel(dias), pago_em: pago === null ? null : diaRel(pago),
        link: p.status === 'cancelado' ? null : `https://pagamento.exemplo/c/${p.id}` }));
      const conta = (s: string) => itens.filter((p) => p.status === s).length;
      return r({ itens: itens.filter((p) => st === 'todos' || p.status === st), pagina: 1, tem_mais: false,
        contadores: { todos: itens.length, pendente: conta('pendente'), pago: conta('pago'), vencido: conta('vencido'), cancelado: conta('cancelado') } });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/tarefas')) {
      const origem = (caminho.match(/origem=(\w+)/) || [])[1] || 'todas';
      const itens = TAREFAS.filter((x) => origem === 'todas' || x.origem === origem);
      return r({ itens, contadores: { todas: TAREFAS.length, todo: TAREFAS.filter((x) => x.origem === 'todo').length,
        ponto: TAREFAS.filter((x) => x.origem === 'ponto').length } });
    }
    if (metodo === 'POST' && /^\/api\/app\/tarefas\/todo\/\d+\/concluir$/.test(caminho)) {
      const id = 'todo:' + caminho.split('/')[5];
      const i = TAREFAS.findIndex((x) => x.id === id);
      if (i >= 0) TAREFAS.splice(i, 1);
      return r({ sucesso: true });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/venda/produtos')) {
      const q = semAcento(decodeURIComponent((caminho.match(/[?&]q=([^&]*)/) || [])[1] || '').trim());
      const itens = CATALOGO.filter((p) => !q || semAcento(p.nome).includes(q) || semAcento(p.categoria).includes(q)).slice(0, 20);
      return r({ itens: itens.map((p) => ({ ...p })) });
    }
    if (metodo === 'POST' && caminho === '/api/app/vendas') {
      // Como o ERP (sessão ERP da tela 11): sem chave → 422; mesma chave e mesmo corpo → a mesma venda; corpo diferente → 422.
      const chave = cabecalhos['Idempotency-Key'];
      if (!chave) throw Object.assign(new Error('Falta a chave de idempotência.'), { status: 422, codigo: 'validacao', campos: { idempotency_key: 'Falta a chave de idempotência.' } });
      const corpoTxt = JSON.stringify(corpo ?? {});
      const ja = VENDAS_POR_CHAVE[chave];
      if (ja && ja.corpo !== corpoTxt) throw Object.assign(new Error('Chave já usada em outra venda.'), { status: 422, codigo: 'idempotencia_conflito' });
      if (ja) return r({ ...ja.venda });
      const n = (corpo ?? {}) as { metodo?: string; itens?: Array<Record<string, unknown>>; total_previsto?: unknown };
      const campos: Record<string, string> = {};
      if (!n.metodo || !ROTULO_METODO[n.metodo]) campos.metodo = 'Escolha a forma de pagamento.';
      const itens = Array.isArray(n.itens) ? n.itens : [];
      if (!itens.length) campos.itens = 'Adicione ao menos um produto.';
      let totalC = 0;
      const baixas: Array<{ p: (typeof CATALOGO)[number]; q: number }> = [];
      itens.forEach((it, k) => {
        const p = CATALOGO.find((x) => x.id === it.variacao_id);
        const qC = centavosDoTexto(it.quantidade), pC = centavosDoTexto(it.preco_unitario);
        if (!p) { campos[`itens.${k}.variacao_id`] = 'Produto não encontrado.'; return; }
        // Como o ERP (#8597): na v1 a quantidade é inteira ("3.00" vale, "2.50" não).
        if (qC === null || qC <= 0 || qC % 100 !== 0) { campos[`itens.${k}.quantidade`] = 'Quantidade inválida.'; return; }
        const q = qC / 100;
        if (p.estoque !== null && q > p.estoque) { campos[`itens.${k}.quantidade`] = `Estoque insuficiente (disponível ${p.estoque}).`; return; }
        const precoC = Math.round(p.preco * 100);
        if (pC !== precoC) { campos[`itens.${k}.preco_unitario`] = `O preço mudou para ${(precoC / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`; return; }
        totalC += precoC * q; baixas.push({ p, q });
      });
      if (!Object.keys(campos).length && centavosDoTexto(n.total_previsto) !== totalC) campos.total_previsto = `O total mudou para ${(totalC / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Revise o carrinho.`;
      if (Object.keys(campos).length) throw Object.assign(new Error(Object.values(campos)[0]), { status: 422, codigo: 'validacao', campos });
      for (const b of baixas) if (b.p.estoque !== null) b.p.estoque -= b.q;
      numeroVenda += 1;
      const venda = { id: 9000 + numeroVenda, numero: 'V-' + numeroVenda, data: new Date().toISOString(), total: totalC / 100,
        itens: baixas.map((b) => ({ variacao_id: b.p.id, nome: b.p.nome, quantidade: b.q, preco_unitario: b.p.preco, subtotal: Math.round(b.p.preco * 100) * b.q / 100 })),
        metodo: ROTULO_METODO[n.metodo as string] };
      VENDAS_POR_CHAVE[chave] = { corpo: corpoTxt, venda };
      return r({ ...venda });
    }
    if (metodo === 'GET' && caminho.startsWith('/api/app/os?')) {
      const etapa = decodeURIComponent((caminho.match(/etapa=([^&]*)/) || [])[1] || 'todas');
      const pos = (k: string) => ETAPAS_OS.findIndex((e) => e[0] === k);
      const itens = ORDENS.filter((o) => etapa === 'todas' || o.etapa === etapa).sort((a, b) => pos(b.etapa) - pos(a.etapa) || b.id - a.id).map((o) => ({
        id: o.id, numero: o.numero, placa: o.placa, veiculo: o.veiculo, cliente: o.cliente, valor: o.valor, travada: OS_TRAVA.includes(o.etapa),
        etapa: { chave: o.etapa, rotulo: ETAPAS_OS[pos(o.etapa)][1], indice: pos(o.etapa) + 1, total_etapas: ETAPAS_OS.length } }));
      const etapas = ETAPAS_OS.map(([chave, rotulo]) => ({ chave, rotulo, total: ORDENS.filter((o) => o.etapa === chave).length }));
      return r({ itens, etapas, total: ORDENS.length, travadas: ORDENS.filter((o) => OS_TRAVA.includes(o.etapa)).length, pagina: 1, tem_mais: false });
    }
    if (caminho.endsWith('/push/dispositivo')) return r({ ativo: true });
    throw new Error('Rota sem simulação: ' + caminho);
  },
};
