// Entrar com biometria (P9, ADR 0432 do ERP). Plugin @capgo/capacitor-native-biometric: confere pelo próprio
// celular (Android BiometricPrompt, iOS LocalAuthentication) e guarda o token no Keychain (iOS) ou cifrado com
// chave do Android Keystore. Nada biométrico sai do aparelho: o app só recebe "confirmou" ou "não confirmou".
//
// Com a opção ligada, o token Passport sai do Preferences (texto) e vai para o armazenamento seguro; desligada,
// volta ao Preferences. A senha nunca é guardada. As regras puras (3 falhas → senha) estão em biometria-regras.ts.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { resultadoDoErro, type ResultadoBiometria } from './biometria-regras';

const DEMO = import.meta.env.VITE_DEMO === '1';
/** '1' = a pessoa ligou a biometria neste aparelho. */
const CHAVE_LIGADA = 'oi.biometria';
/** Chave do token no armazenamento seguro (Keychain/Keystore). */
const CHAVE_SEGURA = 'oi.token';

/** O celular tem biometria cadastrada (no demo, sempre; no navegador, nunca). */
export async function celularTemBiometria(): Promise<boolean> {
  if (DEMO) return true;
  if (!Capacitor.isNativePlatform()) return false;
  try { return (await NativeBiometric.isAvailable()).isAvailable; } catch { return false; }
}

/** A pessoa ligou a biometria neste aparelho. */
export const biometriaLigada = async () => (await Preferences.get({ key: CHAVE_LIGADA })).value === '1';

/** Pede a digital ou o rosto. Uma tentativa por chamada: quem conta as falhas é biometria-regras.ts. */
export async function conferirBiometria(): Promise<ResultadoBiometria> {
  if (DEMO) {
    // Demonstração no navegador: não há sensor; a pessoa escolhe o resultado.
    return window.confirm('Modo demonstração: simular a digital reconhecida?\n\nOK = reconhecida · Cancelar = não reconhecida') ? 'ok' : 'falhou';
  }
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Entrar no oimpresso',
      title: 'Entrar no oimpresso',
      subtitle: 'Use a digital ou o rosto cadastrado no celular',
      negativeButtonText: 'Usar senha',
      maxAttempts: 1,
      useFallback: false,
    });
    return 'ok';
  } catch (e) {
    return resultadoDoErro((e as { code?: unknown } | null)?.code);
  }
}

/** Guarda o token no armazenamento seguro (só com a biometria ligada). */
export async function guardarTokenSeguro(token: string): Promise<void> {
  if (DEMO) { await Preferences.set({ key: 'oi.demo.token-seguro', value: token }); return; }
  await NativeBiometric.setData({ key: CHAVE_SEGURA, value: token });
}

/** Token guardado no armazenamento seguro, ou null. Só é chamado depois da biometria confirmar. */
export async function lerTokenSeguro(): Promise<string | null> {
  try {
    if (DEMO) return (await Preferences.get({ key: 'oi.demo.token-seguro' })).value;
    return (await NativeBiometric.getData({ key: CHAVE_SEGURA })).value || null;
  } catch { return null; }
}

async function apagarTokenSeguro(): Promise<void> {
  try {
    if (DEMO) { await Preferences.remove({ key: 'oi.demo.token-seguro' }); return; }
    await NativeBiometric.deleteData({ key: CHAVE_SEGURA });
  } catch { /* nada guardado */ }
}

/** Liga: marca a opção e passa o token para o armazenamento seguro. */
export async function marcarLigada(token: string): Promise<void> {
  await guardarTokenSeguro(token);
  await Preferences.set({ key: CHAVE_LIGADA, value: '1' });
}

/** Desliga: tira a marca e o token do armazenamento seguro. Devolve o token que estava lá (para voltar ao Preferences). */
export async function marcarDesligada(): Promise<string | null> {
  const t = await lerTokenSeguro();
  await apagarTokenSeguro();
  await Preferences.remove({ key: CHAVE_LIGADA });
  return t;
}
