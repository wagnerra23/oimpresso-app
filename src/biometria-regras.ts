// Entrar com biometria (P9, ADR 0432 do ERP). Arquivo sem dependência do Capacitor, para o teste de unidade rodar em Node.
//
// Quem confere a digital ou o rosto é o celular; o app só recebe "confirmou" ou "não confirmou" e, com isso,
// destrava o token guardado no Keychain/Keystore. A senha continua valendo: três falhas seguidas pedem a senha.

/** Falhas seguidas que fazem o app desistir da biometria e pedir a senha. */
export const MAX_FALHAS_BIOMETRIA = 3;

/** Resultado de uma tentativa no sensor, já traduzido do erro do plugin. */
export type ResultadoBiometria = 'ok' | 'falhou' | 'cancelou' | 'bloqueado' | 'indisponivel';

/** Erro do plugin (`BiometricAuthError` do @capgo/capacitor-native-biometric) → resultado.
 *  10 = não reconheceu; 16/17/11/15 = a pessoa (ou o sistema) cancelou ou pediu outra forma;
 *  2/4 = bloqueado por tentativas; 1/3/14 = sem sensor, sem biometria cadastrada ou sem senha no aparelho. */
export function resultadoDoErro(codigo: unknown): Exclude<ResultadoBiometria, 'ok'> {
  const n = typeof codigo === 'string' ? Number(codigo) : codigo;
  switch (n) {
    case 10: return 'falhou';
    case 11: case 15: case 16: case 17: return 'cancelou';
    case 2: case 4: return 'bloqueado';
    case 1: case 3: case 14: return 'indisponivel';
    default: return 'falhou';
  }
}

/** Estado da tela de entrada com biometria. */
export type EstadoDestravar = { falhas: number; pedeSenha: boolean; mensagem: string | null };

export const DESTRAVAR_INICIAL: EstadoDestravar = { falhas: 0, pedeSenha: false, mensagem: null };

/** Próximo estado depois de uma tentativa. `ok` não muda o estado (o app entra). */
export function aposTentativa(e: EstadoDestravar, r: ResultadoBiometria): EstadoDestravar {
  if (e.pedeSenha || r === 'ok') return e;
  if (r === 'cancelou') return { ...e, mensagem: null };
  if (r === 'bloqueado') return { falhas: e.falhas, pedeSenha: true, mensagem: 'A biometria do celular está bloqueada. Entre com a senha.' };
  if (r === 'indisponivel') return { falhas: e.falhas, pedeSenha: true, mensagem: 'A biometria não está disponível neste celular. Entre com a senha.' };
  const falhas = e.falhas + 1;
  if (falhas >= MAX_FALHAS_BIOMETRIA) {
    return { falhas, pedeSenha: true, mensagem: `A biometria falhou ${MAX_FALHAS_BIOMETRIA} vezes. Entre com a senha.` };
  }
  const restam = MAX_FALHAS_BIOMETRIA - falhas;
  return { falhas, pedeSenha: false, mensagem: `Não reconhecida. ${restam === 1 ? 'Resta 1 tentativa' : `Restam ${restam} tentativas`}.` };
}

/** A opção aparece em Conta só se a empresa permite (`app_biometria_login`) e o celular tem biometria cadastrada. */
export const ofereceBiometria = (ajusteEmpresa: boolean, celularTem: boolean) => ajusteEmpresa && celularTem;
