// Motivos de pausa do posto (P8, tela 02 · A4), guardados no celular para pausar sem internet. Com rede, a lista vem
// do ERP e substitui a guardada; sem rede (ou ERP fora), vale a última que veio. A pausa é parte do apontamento, então
// entra na mesma exceção à regra 8 (decisão [W] 2026-10-15). Guardada por usuário: outro login pode ser outra empresa.
import { Preferences } from '@capacitor/preferences';
import { apontamentoApi } from './api';
import { donoAtual } from './apontamento-dono';
import { motivosDoPosto, type MotivoPausa } from './apontamento-regras';

const CHAVE = 'oi.apontamento.motivos';
type Guardado = Record<string, { motivos: MotivoPausa[]; em: string }>;

const chaveDe = (dono: string, posto: number) => `${dono}:${posto}`;

async function ler(): Promise<Guardado> {
  try {
    const v = (await Preferences.get({ key: CHAVE })).value;
    return v ? (JSON.parse(v) as Guardado) : {};
  } catch { return {}; }
}

// Uma gravação por vez: duas buscas em paralelo (postos diferentes) não apagam a lista uma da outra.
let gravando: Promise<void> = Promise.resolve();
function gravar(k: string, v: Guardado[string]): Promise<void> {
  gravando = gravando.then(async () => {
    const g = await ler();
    g[k] = v;
    try { await Preferences.set({ key: CHAVE, value: JSON.stringify(g) }); } catch { /* sem armazenamento: vale a resposta */ }
  });
  return gravando;
}

export interface Motivos { motivos: MotivoPausa[]; /** Data da lista guardada quando não deu para buscar agora. */ guardadaEm: string | null }

/** Busca do ERP (e guarda) ou devolve a guardada. Erro só quando não há nenhuma lista para este posto. */
export async function motivosDe(posto: number, online: boolean): Promise<Motivos> {
  const dono = await donoAtual();
  const k = chaveDe(dono, posto);
  if (online) {
    try {
      const motivos = motivosDoPosto(await apontamentoApi.motivosPausa(posto), posto);
      await gravar(k, { motivos, em: new Date().toISOString() });
      return { motivos, guardadaEm: null };
    } catch (e) {
      const g = (await ler())[k];
      if (g) return { motivos: g.motivos, guardadaEm: g.em };
      throw e;
    }
  }
  const g = (await ler())[k];
  if (!g) throw Object.assign(new Error('Sem internet e sem a lista de motivos deste posto no celular.'), { status: 0, codigo: 'rede' });
  return { motivos: g.motivos, guardadaEm: g.em };
}

/** Deixa a lista pronta no celular para quando a internet cair (chamado ao ver uma etapa rodando, com rede). */
export function guardarMotivos(postos: number[]): void {
  for (const p of new Set(postos)) if (p > 0) void motivosDe(p, true).catch(() => { /* tenta na próxima */ });
}
