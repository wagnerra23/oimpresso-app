// Lembrete de ponto por push (ADR 0423). O servidor envia pelo FCM; o app pede a
// permissão, registra o token e o manda ao ERP. O token muda: reenviamos a cada
// abertura e a cada evento 'registration'.
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { api, DEMO } from './api';
import { pushNoBuild } from './push-regras';

/** Build sem google-services.json: nada de push, senão o register() derruba o app (push-regras.ts). */
const PUSH = pushNoBuild(import.meta.env.VITE_PUSH);

let ouvindo = false;

function ouvir(aoTocar: () => void) {
  if (ouvindo) return;
  ouvindo = true;
  PushNotifications.addListener('registration', ({ value }) => {
    const plat = Capacitor.getPlatform() === 'ios' ? 'ios' : 'android';
    api.registrarPush(value, plat).catch(() => { /* tenta de novo na próxima abertura */ });
  });
  // Tocar na notificação (data.url = "/ponto/mobile") abre a tela de ponto do app.
  PushNotifications.addListener('pushNotificationActionPerformed', () => aoTocar());
}

/** Na abertura: se a permissão já foi dada, renova o registro sem perguntar nada. */
export async function renovarLembrete(aoTocar: () => void) {
  if (DEMO || !PUSH || !Capacitor.isNativePlatform()) return;
  ouvir(aoTocar);
  const p = await PushNotifications.checkPermissions();
  if (p.receive === 'granted') await PushNotifications.register();
}

/** Botão "Ativar lembrete": pede a permissão com contexto (nunca no primeiro segundo do app). */
export async function ativarLembrete(): Promise<'ativo' | 'negado' | 'indisponivel'> {
  if (DEMO || !PUSH || !Capacitor.isNativePlatform()) return 'indisponivel';
  const p = await PushNotifications.requestPermissions();
  if (p.receive !== 'granted') return 'negado';
  await PushNotifications.register();
  return 'ativo';
}
