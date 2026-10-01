# oimpresso — app Capacitor

Casca nativa (Android + iOS) do oimpresso. As telas do app vivem **no ERP**, como páginas Inertia em
**https://oimpresso.com/m** (sessão BASE MOBILE), no visual do protótipo Mobile do Cowork. Decisão [W]
2026-10-01: "Telas no ERP (/m)". O app abre esse endereço e acrescenta o que só o nativo dá:
localização com permissão do sistema, push, tela de erro/sem conexão, botão voltar e ícone/splash.

> A versão anterior, com telas do ponto empacotadas no app e login por token (PR #3), está guardada na
> tag `v0-telas-ponto-no-app` como referência visual.

| Item | Valor |
|---|---|
| appId / package | `com.oimpresso.app` (permanente nas lojas — decisão [W] 2026-10-01) |
| Nome | oimpresso (Android e iOS — decisão [W] 2026-10-01) |
| Capacitor | 8.5.2 (Node ≥ 22) · sem interface própria: `www/` só tem a tela de erro local |
| Android | AGP 8.13.0 · Gradle 8.14.3 · JDK 21 · compile/target SDK 36 · minSdk 24 |
| iOS | SPM (abrir `ios/App/App.xcodeproj`, scheme `App`) · só iPhone · build no CI macOS (sessão iOS) |

## Como o app fala com o ERP

- `server.url = https://oimpresso.com/m` (sem barra no fim: medido, `/m/` redireciona para `/public/m/`).
- Login, sessão e dados são os do próprio ERP (cookie de sessão `SameSite=lax`, first-party na
  WebView — medido em 2026-10-01 com a casca anterior).
- `allowNavigation`: só `oimpresso.com` e subdomínios; outro host abre no navegador do sistema.
- A ponte do Capacitor chega à página remota (medido): o ERP usa `window.Capacitor.Plugins.*`
  (`PushNotifications`, `Geolocation`) sem importar pacote.
- Enquanto `/m` não existe (hoje responde **404**), o app mostra a tela de erro local, e o build de
  loja **falha de propósito** (trava no `android-release.yml`, se solta quando `/m` responder 200/302).

## Para a BASE MOBILE (medido no emulador Android 16)

| Tema | O que acontece | O que a página precisa |
|---|---|---|
| Botão voltar (Android) | navega no histórico da WebView → `popstate` → o Inertia trata. Na tela inicial, o app vai para segundo plano (código em `MainActivity`). | nada. Atenção: o evento `backButton` do plugin App **não** chega à página |
| Histórico sem toque | entradas criadas por script sem toque do usuário são puladas pelo voltar (proteção do Chrome) | navegar só por ação do usuário (o normal no Inertia) |
| Erro ao abrir | 404/500 e falta de rede caem na mesma tela local (`offline.html`), que distingue os dois casos | responder 200 em `/m` |
| Área segura (Capacitor 8 é edge-to-edge) | sem ajuste, a barra inferior fica sob a barra de gestos | `viewport-fit=cover` + `padding: env(safe-area-inset-top/bottom)` no layout |
| Localização | `navigator.geolocation` dispara o diálogo nativo "enquanto em uso" e devolve a coordenada | nada (iOS não medido) |
| Push | plugin instalado; a página pede a permissão e registra o token na sessão web (`/ponto/mobile/push/dispositivo`) | chamar `Capacitor.Plugins.PushNotifications` só se `Capacitor.isNativePlatform()` |

## Decisões

### 1. Permissões

Só localização **enquanto em uso** (ADR 0383: sem câmera, sem biometria).

- Android: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`. **Sem** `ACCESS_BACKGROUND_LOCATION`,
  **sem** `CAMERA`. `POST_NOTIFICATIONS` entra pelo plugin de push.
- iOS: `NSLocationWhenInUseUsageDescription` e `NSPhotoLibraryUsageDescription` (anexo de OS) em
  PT-BR, textos de `docs/lojas-app/textos/privacidade-lojas.md` do ERP. **Sem** `NSCameraUsageDescription`,
  **sem** microfone.

Nunca adicionar permissão de câmera.

### 2. Links externos

Hosts fora de `allowNavigation` saem do app e abrem no navegador do sistema (medido com `gov.br`).

### 3. Sem conexão

`server.errorPath: "offline.html"`: qualquer falha ao abrir o ERP (sem rede **ou** erro 404/500) mostra a
tela local, que distingue os dois casos e tem "Tentar de novo"; com a rede de volta, retorna sozinha. O
app não grava marcação offline: marcação só existe com NSR do servidor.

## Medido no emulador Android — casca anterior (abria /home, 2026-10-01)

Android 16 (API 36, `sdk_gphone64_x86_64`), APK debug, inspeção da WebView por DevTools remoto:

| O quê | Resultado |
|---|---|
| Permissões no APK (`aapt dump permissions`) | INTERNET, ACCESS_COARSE/FINE_LOCATION, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, WAKE_LOCK, c2dm RECEIVE. **Sem CAMERA, sem BACKGROUND_LOCATION** |
| Ponte na página remota do ERP | `window.Capacitor` presente, `isNativePlatform()=true`, `getPlatform()='android'`, plugins: Geolocation, PushNotifications, Network, Browser, App, SplashScreen… |
| `navigator.geolocation` da página | dispara o diálogo **nativo** do Android (Precisa/Aproximada · "Enquanto o app estiver em uso"), sem aviso web extra; após permitir devolve a coordenada (±5 m). A tela `/ponto/mobile` funciona **sem mudança** no Android |
| `Capacitor.Plugins.Geolocation` | mesma coordenada |
| Link para host fora de `oimpresso.com` | sai do app e abre no navegador do sistema |
| Sem rede | aparece `offline.html` ("Sem conexão com a internet" + "Tentar de novo") |
| Rede volta | retorna sozinho ao ERP |

Não medido (sem credencial de teste / sem Mac): login completo e persistência do cookie entre
aberturas do app; qualquer coisa no iOS.

## Como rodar

```bash
npm ci
npx cap sync
```

Android (precisa JDK 21 e Android SDK; `ANDROID_HOME` apontando para o SDK):

```bash
cd android && ./gradlew assembleDebug
```

APK em `android/app/build/outputs/apk/debug/app-debug.apk`. Instalar no emulador:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Em build **debug** a WebView pode ser inspecionada em `chrome://inspect` (no release fica desligado).

iOS (Mac): `npx cap open ios` e rodar pelo Xcode.

## Ícone e splash

Coloque as artes (vêm da sessão de ativos) em `assets/`:

- `assets/icon-only.png` (1024×1024), `assets/icon-foreground.png` + `assets/icon-background.png`
  (adaptativo Android), `assets/splash.png` e `assets/splash-dark.png` (2732×2732).

```bash
npx capacitor-assets generate
```

## Segredos — nunca no git

`.gitignore` bloqueia keystore (`*.jks`, `*.keystore`), `google-services.json`,
`GoogleService-Info.plist`, `.env`. A keystore vai para o Vaultwarden; o CI recebe tudo por secrets
(o workflow de release é da sessão PUBLICAÇÃO ANDROID).

## O que falta

- [ ] BASE MOBILE pôr `/m` no ar (o build de loja se destrava sozinho).
- [ ] `google-services.json` (Firebase do [W]) para o push no Android; injetado no CI por secret.
- [ ] Push no iOS por token FCM — PR #2 (sessão iOS).
- [ ] iOS: medir o app inteiro (sem Mac aqui; o CI macOS só compila). No iOS não há botão voltar: as
      telas de `/m` precisam de voltar visível.
