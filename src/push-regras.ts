// Quando o app pode falar com o push do Google (FCM). Arquivo sem dependência do Capacitor,
// para o teste de unidade rodar em Node.
//
// Por que existe: o build sem `google-services.json` (input `sem_push` do android-release)
// não tem o Firebase. Nesse build, `PushNotifications.register()` derruba o app no Android.
// No Android 12 ou mais antigo a permissão de notificação já vem liberada na instalação, então
// o `renovarLembrete` chamava o `register()` logo depois do login e o app travava — e, como o
// token fica salvo, travava de novo a cada abertura (visto em 2026-10-07 na versão 7).
// O workflow só põe VITE_PUSH=1 quando o google-services.json entra no build.

/** Push só existe no build que levou o google-services.json (VITE_PUSH = "1"). */
export function pushNoBuild(vitePush: string | undefined): boolean {
  return vitePush === '1';
}
