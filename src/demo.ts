// Modo demonstração (VITE_DEMO=1): dados simulados em memória, sem servidor.
// Serve para ver as telas no emulador enquanto o ERP não tem o client OAuth do
// app. NUNCA entra no build de loja — a tela mostra uma faixa "Modo demonstração".
// Os números imitam o protótipo (prototipo-ui/cowork/Wagner/ponto-mobile.jsx).

interface MarcacaoDemo { id: string; nsr: number; tipo: string; origem: string; hora: string; hash_trunc: string; revisar: boolean }

let logado = false;
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

// Pessoas de demonstração (API-CONTRATO-v1 §4). Telefones e documentos fictícios.
const PESSOAS = [
  { id: 15, nome: 'Ângela Ramos', tipo: 'PF', documento: null, papeis: ['funcionario'], saldo_aberto: 0, telefone: '(48) 90000-0006', email: null, cidade: 'Tubarão' },
  { id: 9, nome: 'Bistrô do Forno', tipo: 'PJ', documento: '00.000.000/0001-00', papeis: ['cliente'], saldo_aberto: 0, telefone: '(48) 90000-0001', email: 'contato@bistro.exemplo', cidade: 'Tubarão' },
  { id: 10, nome: 'Clínica Vita', tipo: 'PJ', documento: '00.000.000/0002-00', papeis: ['cliente'], saldo_aberto: 612, telefone: '(48) 90000-0002', email: null, cidade: 'Laguna' },
  { id: 11, nome: 'Gráfica Lona Sul', tipo: 'PJ', documento: '00.000.000/0003-00', papeis: ['fornecedor'], saldo_aberto: 0, telefone: '(48) 90000-0003', email: 'vendas@lonasul.exemplo', cidade: 'Criciúma' },
  { id: 12, nome: 'Marília Costa', tipo: 'PF', documento: null, papeis: ['cliente', 'fornecedor'], saldo_aberto: 248, telefone: '(48) 90000-0004', email: null, cidade: 'Tubarão' },
  { id: 13, nome: 'Papelaria Sol', tipo: 'PJ', documento: '00.000.000/0004-00', papeis: ['cliente'], saldo_aberto: 0, telefone: null, email: 'sol@papelaria.exemplo', cidade: 'Gravatal' },
  { id: 14, nome: 'Restaurante 88', tipo: 'PJ', documento: '00.000.000/0005-00', papeis: ['cliente'], saldo_aberto: 0, telefone: '(48) 90000-0005', email: null, cidade: 'Tubarão' },
]; // já em ordem alfabética: chamada no topo do módulo impediria o build de produção de descartar o demo

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
const hashFake = (n: number) => (n * 2654435761 >>> 0).toString(16).padStart(8, '0').repeat(2).slice(0, 16);

export const demo = {
  logado: () => logado,
  async entrar(usuario: string, senha: string) {
    await espera(400);
    if (!usuario.trim() || senha.length < 3) throw Object.assign(new Error('Usuário ou senha incorretos.'), { status: 401 });
    logado = true;
  },
  sair() { logado = false; },
  async chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
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
      return r({ usuario: 'Colaborador', empresa: 'Gráfica Demonstração',
        faturado_hoje: { valor: 1520, ontem: 1300, variacao_pct: 16.9 }, meta_dia: { valor: 2000, derivada: true },
        kpis: { pedidos_ativos: ativos.length, pedidos_atrasados: PEDIDOS.filter((x) => x.atrasado).length, estoque_baixo: 2 },
        financeiro: { a_receber: 8200, a_pagar: 3100 },
        proximas_tarefas: TAREFAS.slice(0, 3) });
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
    if (caminho.endsWith('/push/dispositivo')) return r({ ativo: true });
    throw new Error('Rota sem simulação: ' + caminho);
  },
};
