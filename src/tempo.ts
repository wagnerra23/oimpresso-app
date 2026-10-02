// Tempo relativo das listas do app (sem dependência do Capacitor, para o teste rodar em Node).
/** "há 12 min", "há 3 h", "ontem", "dd/mm" — como o protótipo. */
export function haQuanto(iso: string, agora = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.max(0, Math.round((agora - t) / 60000));
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = new Date(t), hoje = new Date(agora);
  const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
  if (d.getFullYear() === ontem.getFullYear() && d.getMonth() === ontem.getMonth() && d.getDate() === ontem.getDate()) return 'ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
