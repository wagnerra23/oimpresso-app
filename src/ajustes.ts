// Acesso central aos ajustes da empresa. Cada tela lê daqui, nunca do /inicio direto:
//   const ajustes = useAjustes();            // em componente (re-renderiza quando o /inicio chega)
//   if (ajustesDaEmpresa().app_anexos_camera) // fora de componente
//
// Quem alimenta é o `api.inicio()`, que já devolve o bloco completo (ajustes-regras.ts). Antes do primeiro
// /inicio, ou se ele falhar, vale o padrão do ERP. Ao sair da conta, volta ao padrão.
import { useSyncExternalStore } from 'react';
import { AJUSTES_PADRAO, type AjustesEmpresa } from './ajustes-regras';

let atual: AjustesEmpresa = { ...AJUSTES_PADRAO, app_acoes_fsm_liberadas: [] };
const ouvintes = new Set<() => void>();

/** Ajustes da empresa logada (ou o padrão, se o /inicio ainda não respondeu). */
export const ajustesDaEmpresa = (): AjustesEmpresa => atual;

/** Chamado pelo `api.inicio()` com o bloco já completo. */
export function guardarAjustes(a: AjustesEmpresa) {
  atual = a;
  ouvintes.forEach((f) => f());
}

/** Volta ao padrão (saída da conta). */
export const limparAjustes = () => guardarAjustes({ ...AJUSTES_PADRAO, app_acoes_fsm_liberadas: [] });

function assinar(f: () => void) {
  ouvintes.add(f);
  return () => { ouvintes.delete(f); };
}

/** Hook das telas: os ajustes da empresa, atualizados quando o /inicio responde. */
export const useAjustes = (): AjustesEmpresa => useSyncExternalStore(assinar, ajustesDaEmpresa, ajustesDaEmpresa);
