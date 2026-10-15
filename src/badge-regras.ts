// Contador no ícone do app (P7). Arquivo sem dependência do Capacitor, para o teste de unidade rodar em Node.
//
// O número vem do ERP (`nao_lidas` em /api/app/inicio e nas rotas de notificação). Se o ERP não mandou
// (campo ausente ou inválido), o app não mexe no ícone: melhor manter o último número certo do que zerar.

/** Número a mostrar no ícone, ou null quando não há número confiável (não mexer). 0 = some o contador. */
export function numeroDoIcone(naoLidas: unknown): number | null {
  if (typeof naoLidas !== 'number' || !Number.isFinite(naoLidas)) return null;
  return Math.max(0, Math.floor(naoLidas));
}
