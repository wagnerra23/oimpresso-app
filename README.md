# oimpresso — app Capacitor

Casca nativa (Android + iOS) do ERP oimpresso **inteiro** ([W] 2026-10-01: um app só, o ERP no
celular junto com o ponto). Entra por **https://oimpresso.com/home** (logado → painel; sem sessão →
`/login`). O REP-P do celular é a tela `/ponto/mobile` dentro do ERP. Repositório separado do ERP de propósito:
Node/Gradle/Xcode não entram na CI do `oimpresso.com`.

| Item | Valor |
|---|---|
| appId / package | `com.oimpresso.app` (permanente nas lojas — decisão [W] 2026-10-01) |
| Nome | oimpresso (Android e iOS — decisão [W] 2026-10-01) |
| Capacitor | 8.5.2 (Node ≥ 22) |
| Android | AGP 8.13.0 · Gradle 8.14.3 · JDK 21 · compile/target SDK 36 · minSdk 24 |
| iOS | Swift Package Manager (sem CocoaPods, sem `.xcworkspace`: abrir `ios/App/App.xcodeproj`, scheme `App`) · só iPhone (`TARGETED_DEVICE_FAMILY = 1`) · precisa de Mac + Xcode |

## Decisões

### 1. `server.url` remoto, não bundle local

O app carrega a página do ERP direto (`server.url`), com a página local `www/offline.html`
como `errorPath`.

- **Sessão/cookie.** O ERP autentica por cookie de sessão `SameSite=lax` (`config/session.php`).
  Com `server.url`, a WebView navega no próprio `oimpresso.com`: o cookie é *first-party* e funciona
  igual ao navegador. Num bundle local a origem seria `https://localhost` / `capacitor://localhost`:
  cada chamada ao ERP vira *cross-site*, o cookie `lax` não vai em `fetch`, e o WKWebView (ITP)
  bloqueia cookie de terceiro. Bundle local exigiria login por token (Passport) e reescrever a tela
  fora do Inertia — trabalho grande no ERP, sem ganho para o usuário.
- **Atualização.** Mudança na tela chega sem nova versão na loja.
- **Ponte nativa.** Com `server.url` o Capacitor injeta `window.Capacitor` na página remota, então a
  página do ERP alcança os plugins (push, geolocalização) sem importar pacote npm.

**Regra 4.2 da Apple (app que é só site).** É o risco real desta escolha. O que o app entrega além do
site: localização nativa com texto de permissão próprio; notificação push de lembrete de ponto
(ADR 0423, sessão PUSH); tela de "sem conexão" nativa; links externos abrindo fora do app; splash e
ícone próprios. Nas notas de revisão, explicar que é o cliente do REP-P (Portaria MTP 671/2021) para
colaboradores e dar a conta demo (sessão CONTA DEMO). Se a Apple recusar mesmo assim, o próximo
passo é tela nativa para bater ponto — fora do escopo desta versão.

### 2. Permissões

Só localização **enquanto em uso** (ADR 0383: sem câmera, sem biometria).

- Android: `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION`. **Sem** `ACCESS_BACKGROUND_LOCATION`,
  **sem** `CAMERA`. `POST_NOTIFICATIONS` entra pelo plugin de push.
- iOS: `NSLocationWhenInUseUsageDescription` e `NSPhotoLibraryUsageDescription` (anexo de OS) em
  PT-BR, textos de `docs/lojas-app/textos/privacidade-lojas.md` do ERP. **Sem** `NSCameraUsageDescription`,
  **sem** microfone.

Nunca adicionar permissão de câmera.

### 3. Links externos e navegação

`allowNavigation: ["oimpresso.com", "*.oimpresso.com"]`. Qualquer outro host sai do app e abre no
navegador do sistema (comportamento padrão do Capacitor para hosts fora da lista).

### 4. Sem conexão

`server.errorPath: "offline.html"`: quando a página remota falha ao carregar, aparece a tela local
com "Tentar de novo" (e volta sozinha quando a rede retorna). O app **não grava marcação offline**:
marcação só existe com NSR do servidor.

## Medido no emulador Android (2026-10-01)

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

- [ ] `google-services.json` (Firebase do [W]) para o push no Android; injetado no CI por secret.
- [x] iOS: `App.entitlements` com `aps-environment` (`CODE_SIGN_ENTITLEMENTS`), `UIBackgroundModes`
      `remote-notification`, AppDelegate repassando o token APNs ao Capacitor,
      `ITSAppUsesNonExemptEncryption = false` (TestFlight sem "Missing Compliance"). **Não compilado — sem Mac.**
- [ ] iOS: o token que chega hoje é **APNs cru**. O servidor do ERP envia por FCM (ADR 0423), que precisa
      do token FCM → adicionar Firebase Messaging (pacote SPM no Xcode) + `GoogleService-Info.plist` e
      trocar o token no AppDelegate. Alternativa: servidor enviar por APNs direto. Decisão com a sessão PUSH.
- [ ] Medir login + persistência de sessão entre aberturas (precisa da conta demo — sessão CONTA DEMO).
- [ ] iOS: `<input type=file>` sem `NSCameraUsageDescription` — conferir que o seletor não oferece/câmera não quebra.
- [ ] iOS: medir se `navigator.geolocation` na página remota mostra um 2º aviso ("oimpresso.com quer
      usar sua localização") além do aviso do sistema. Se mostrar, a página deve usar
      `Capacitor.Plugins.Geolocation` quando nativo — mudança no ERP (sessão PWA E PÁGINAS).
- [ ] Artes de ícone/splash (sessão de ativos).
- [ ] Workflow de release assinado (sessão PUBLICAÇÃO ANDROID).
