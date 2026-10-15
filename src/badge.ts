// Contador de não lidas no ícone do app (P7). Plugin @capawesome/capacitor-badge (Android via ShortcutBadger, iOS nativo).
// Atualiza ao abrir o Início, ao chegar push com o app aberto (push.ts) e ao ler na tela Notificações.
// No iOS o número depende da permissão de notificação (pedida pelo lembrete); sem ela, a chamada falha calada.
import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';
import { numeroDoIcone } from './badge-regras';

/** Mostra no ícone o número de não lidas que veio do ERP. Campo ausente = não mexe. */
export function mostrarNoIcone(naoLidas: unknown): void {
  const n = numeroDoIcone(naoLidas);
  if (n === null || !Capacitor.isNativePlatform()) return;
  (n === 0 ? Badge.clear() : Badge.set({ count: n })).catch(() => { /* launcher sem suporte: segue sem contador */ });
}

/** Push chegou com o app aberto: soma 1 até a próxima leitura do ERP acertar o número. */
export function somarNoIcone(): void {
  if (!Capacitor.isNativePlatform()) return;
  Badge.increase().catch(() => {});
}

/** Saiu da conta: o ícone não pode mostrar as não lidas de quem saiu. */
export function limparIcone(): void {
  if (!Capacitor.isNativePlatform()) return;
  Badge.clear().catch(() => {});
}
