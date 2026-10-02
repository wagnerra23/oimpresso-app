// Modo demonstração (VITE_DEMO=1): dados simulados em memória, sem servidor.
// Serve para ver as telas no emulador enquanto o ERP não tem o client OAuth do
// app. NUNCA entra no build de loja — a tela mostra uma faixa "Modo demonstração".
// Os números imitam o protótipo (prototipo-ui/cowork/Wagner/ponto-mobile.jsx).

interface MarcacaoDemo { id: string; nsr: number; tipo: string; origem: string; hora: string; hash_trunc: string; revisar: boolean }

let logado = false;
// Perfil da demo: usuário com "ponto" no nome (ex.: revisor.ponto) entra como colaborador (D6).
let perfilDemo: 'erp' | 'colaborador' = 'erp';
let nsr = 348821;
const marcacoes: MarcacaoDemo[] = [
  { id: 'd1', nsr: 348821, tipo: 'ENTRADA', origem: 'MOBILE', hora: '07:02', hash_trunc: '9f2c41ab07d3e5c1', revisar: false },
];
const intercorrencias: Array<Record<string, unknown>> = [];

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
const ROTULO_METODO: Record<string, string> = { pix: 'PIX', credito: 'Crédito', debito: 'Débito', dinheiro: 'Dinheiro', boleto: 'Boleto' };
let numeroVenda = 4820;
/** Idempotency-Key → venda já criada (a repetição devolve a mesma, sem baixar estoque de novo). */
const VENDAS_POR_CHAVE: Record<string, Record<string, unknown>> = {};
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
      return r({ perfil: 'erp', abre_em: 'inicio', areas: ['inicio', 'tarefas', 'pedidos', 'producao', 'pessoas', 'orcamentos', 'ponto', 'mais'],
        usuario: 'Colaborador', empresa: 'Gráfica Demonstração',
        faturado_hoje: { valor: 1520, ontem: 1300, variacao_pct: 16.9 }, meta_dia: { valor: 2000, derivada: true },
        kpis: { pedidos_ativos: ativos.length, pedidos_atrasados: PEDIDOS.filter((x) => x.atrasado).length, estoque_baixo: 2 },
        financeiro: { a_receber: 8200, a_pagar: 3100 },
        proximas_tarefas: TAREFAS.slice(0, 3), nao_lidas: NOTIFICACOES.filter((x) => !x.lida).length });
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
    if (metodo === 'GET' && caminho.startsWith('/api/app/orcamentos')) {
      const st = (caminho.match(/status=(\w+)/) || [])[1] || 'todos';
      const conta = (s: string) => ORCAMENTOS.filter((x) => x.status === s).length;
      return r({ itens: ORCAMENTOS.filter((x) => st === 'todos' || x.status === st), pagina: 1, tem_mais: false,
        contadores: { todos: ORCAMENTOS.length, rascunho: conta('rascunho'), enviado: conta('enviado'), aprovado: conta('aprovado'), convertido: conta('convertido') } });
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
      const chave = cabecalhos['Idempotency-Key'];
      if (chave && VENDAS_POR_CHAVE[chave]) return r({ ...VENDAS_POR_CHAVE[chave] });
      const n = (corpo ?? {}) as { metodo?: string; itens?: Array<Record<string, unknown>>; total_previsto?: unknown };
      const campos: Record<string, string> = {};
      if (!n.metodo || !ROTULO_METODO[n.metodo]) campos.metodo = 'Escolha a forma de pagamento.';
      const itens = Array.isArray(n.itens) ? n.itens : [];
      if (!itens.length) campos.itens = 'Adicione ao menos um produto.';
      let totalC = 0, unidadesV = 0;
      const baixas: Array<{ p: (typeof CATALOGO)[number]; q: number }> = [];
      itens.forEach((it, k) => {
        const p = CATALOGO.find((x) => x.id === it.variacao_id);
        const qC = centavosDoTexto(it.quantidade), pC = centavosDoTexto(it.preco_unitario);
        if (!p) { campos[`itens.${k}.variacao_id`] = 'Produto não encontrado.'; return; }
        if (qC === null || qC <= 0 || qC % 100 !== 0) { campos[`itens.${k}.quantidade`] = 'Quantidade inválida.'; return; }
        const q = qC / 100;
        if (p.estoque !== null && q > p.estoque) { campos[`itens.${k}.quantidade`] = `${p.nome}: só há ${p.estoque} em estoque.`; return; }
        const precoC = Math.round(p.preco * 100);
        if (pC !== precoC) { campos[`itens.${k}.preco_unitario`] = `O preço de ${p.nome} mudou. Busque o produto de novo.`; return; }
        totalC += precoC * q; unidadesV += q; baixas.push({ p, q });
      });
      if (!Object.keys(campos).length && centavosDoTexto(n.total_previsto) !== totalC) campos.total_previsto = 'O total mudou. Revise o carrinho.';
      if (Object.keys(campos).length) throw Object.assign(new Error(Object.values(campos)[0]), { status: 422, codigo: 'validacao', campos });
      for (const b of baixas) if (b.p.estoque !== null) b.p.estoque -= b.q;
      numeroVenda += 1;
      const venda = { id: 9000 + numeroVenda, numero: 'V-' + numeroVenda, data: new Date().toISOString(), total: totalC / 100,
        itens: unidadesV, metodo: ROTULO_METODO[n.metodo as string] };
      if (chave) VENDAS_POR_CHAVE[chave] = venda;
      return r({ ...venda });
    }
    if (caminho.endsWith('/push/dispositivo')) return r({ ativo: true });
    throw new Error('Rota sem simulação: ' + caminho);
  },
};
