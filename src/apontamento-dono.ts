// Dono da fila do apontamento (P8): o usuário que entrou por último neste celular. Gravado no login (api.ts `entrar`)
// e lido pela fila, que só envia e mostra os itens dele. Sem dependência do api.ts, para não criar ciclo.
import { Preferences } from '@capacitor/preferences';

const CHAVE = 'oi.apontamento.dono';
let atual: string | null = null;

export const normalizarDono = (usuario: string) => usuario.trim().toLowerCase();

export async function guardarDono(usuario: string): Promise<void> {
  atual = normalizarDono(usuario);
  try { await Preferences.set({ key: CHAVE, value: atual }); } catch { /* sem armazenamento: vale a memória */ }
}

export async function donoAtual(): Promise<string> {
  if (atual === null) {
    try { atual = (await Preferences.get({ key: CHAVE })).value ?? ''; } catch { atual = ''; }
  }
  return atual;
}
