// Modo demonstração (VITE_DEMO=1): dados simulados em memória, sem servidor.
// Serve para ver as telas no emulador enquanto o ERP não tem o client OAuth do
// app. NUNCA entra no build de loja — a tela mostra uma faixa "Modo demonstração".
// Os números imitam o protótipo (prototipo-ui/cowork/Wagner/ponto-mobile.jsx).

interface MarcacaoDemo { id: string; nsr: number; tipo: string; origem: string; hora: string; hash_trunc: string; revisar: boolean }

let logado = false;
let nsr = 348821;
const marcacoes: MarcacaoDemo[] = [
  { id: 'd1', nsr: 348821, tipo: 'ENTRADA', origem: 'MOBILE', hora: '07:02', hash_trunc: '9f2c41ab07d3e5c1', revisar: true },
];
const intercorrencias: Array<Record<string, unknown>> = [];

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
      for (let d = 1; d < hoje.getDate(); d++) {
        const dt = new Date(hoje.getFullYear(), hoje.getMonth(), d);
        const fim = dt.getDay() === 0 || dt.getDay() === 6;
        const div = d % 9 === 4;
        linhas.push({ data: dt.toISOString().slice(0, 10), dow: nomes[dt.getDay()], dia: d, is_weekend: fim,
          trabalhado: fim ? 0 : div ? 412 : 480 + (d % 3) * 7, divergencia: !fim && div, estado: fim ? '' : div ? 'DIVERGENCIA' : 'OK',
          marcacoes: fim ? [] : div ? [{ hora: '08:01', tipo: 'ENTRADA', origem: 'MOBILE' }, { hora: '12:00', tipo: 'ALMOCO_INICIO', origem: 'MOBILE' }, { hora: '15:52', tipo: 'SAIDA', origem: 'MOBILE' }]
            : [{ hora: '07:58', tipo: 'ENTRADA', origem: 'MOBILE' }, { hora: '12:02', tipo: 'ALMOCO_INICIO', origem: 'MOBILE' }, { hora: '13:01', tipo: 'ALMOCO_FIM', origem: 'MOBILE' }, { hora: '18:05', tipo: 'SAIDA', origem: 'MOBILE' }] });
      }
      const util = linhas.filter((l) => !l.is_weekend);
      return r({ totais: { trabalhado: util.reduce((s, l) => s + l.trabalhado, 0), atraso: 22, falta: 68, he_diurna: 95, he_noturna: 0, divergencias: util.filter((l) => l.divergencia).length }, linhas });
    }
    if (caminho.endsWith('/push/dispositivo')) return r({ ativo: true });
    throw new Error('Rota sem simulação: ' + caminho);
  },
};
