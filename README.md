# oimpresso — app Capacitor

App do oimpresso (Android + iOS) com **telas próprias**, no visual do protótipo Mobile do Cowork
(`mobile/ref/design-v3/oimpresso-mobile/` e `prototipo-ui/cowork/Wagner/ponto-mobile.jsx` no repo do
ERP). [W] 2026-10-01 recusou o app que só abria o site (*"foi pego o site e emulado. eu quero o
Mobile mesmo"*). A 1ª versão traz o **ponto**: Início · Ponto (Bater ponto, Meu espelho, Justificar) · Conta.

| Item | Valor |
|---|---|
| appId / package | `com.oimpresso.app` (permanente nas lojas — decisão [W] 2026-10-01) |
| Nome | oimpresso (Android e iOS — decisão [W] 2026-10-01) |
| Capacitor | 8.5.2 (Node ≥ 22) · interface React 19 + Vite + TypeScript, em `src/` |
| Android | AGP 8.13.0 · Gradle 8.14.3 · JDK 21 · compile/target SDK 36 · minSdk 24 |
| iOS | SPM (abrir `ios/App/App.xcodeproj`, scheme `App`) · só iPhone · build no CI macOS (sessão iOS) |

## Desenho

Fonte: `mobile/ref/design-v4/` no repo do ERP (telas 00 Login, 01 Início, 36 Bater ponto, 37 Meu espelho,
38 Justificar). Os tokens de cor saem de `design/oi-theme.v4.ts` (gerado do DS do oimpresso pelo projeto
de design) por `npm run tokens` → `src/styles/oi-v4.css` — não editar o CSS à mão. Toque ≥ 44 px em toda
área tocável. Divergência consciente: os motivos de justificativa são os 8 que o ERP aceita
(`StoreIntercorrenciaRequest`), não os 5 do v4 — o servidor recusa os do v4.

## Como o app fala com o ERP

- **Pacote local**, não o site: o Vite gera `www/` e o Capacitor empacota. Sem `server.url`.
- **Login por token**: usuário e senha do ERP vão para `POST /oauth/token` (Passport, password grant,
  client **público** — o app não guarda segredo). O token fica em `@capacitor/preferences`.
- **API do ponto**: `/ponto/api/*` (`auth:api`), contrato de `MobileMarcacaoController`.
- **HTTP nativo** (`CapacitorHttp`): as chamadas não passam por CORS — nada a mudar no ERP por isso.
- **Relógio**: a diferença aparelho × servidor sai do header `Date` das respostas; acima de 30 s o botão
  de bater fica bloqueado (o servidor recusa igual).
- **Modo demonstração** (`npm run build:demo`, `.env.demo`): dados simulados, faixa visível em toda
  tela. Para ver as telas sem servidor. Nunca no build de loja.

## Pendências no ERP (fora deste repo)

| # | O quê | Sem isso |
|---|---|---|
| 1 | client OAuth **público** de password grant; o `client_id` entra no build por `VITE_OAUTH_CLIENT_ID` | ninguém entra no app real |
| 2 | `GET /ponto/api/espelho?mes=YYYY-MM` (mesmos builders do Espelho/Show) | "Meu espelho" mostra "ainda não disponível" |
| 3 | `GET /ponto/api/me` (nome, matrícula, empresa, limites) | Início sem o nome; limites fixos 500 m / 30 s |
| 4 | rotas de push sob a API — PR #8457 do ERP (sessão PUSH) | lembrete não registra |
| 5 | conta demo para o revisor das lojas (sessão CONTA DEMO) | revisão bloqueada |

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

Abrem no navegador do sistema (`@capacitor/browser`), ex.: política de privacidade.

### 3. Sem conexão

Faixa "Sem conexão" no topo (`@capacitor/network`). O app não grava marcação offline: marcação só
existe com NSR do servidor.

## Medido no emulador Android — 1ª versão (site dentro do app, 2026-10-01, substituída)

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

## Medido no emulador Android — telas próprias (2026-10-01, build de demonstração)

Login → Início (próxima marcação pela escala, KPIs) → Ponto: o pedido de localização "enquanto em uso"
aparece ao abrir a tela; GPS ±5 m; **Bater ponto** devolve NSR + hash e a lista de hoje atualiza; Meu
espelho com totais; Justificar com os 8 motivos do ERP; Conta com lembrete, privacidade e sair.
Não medido: o caminho real (falta o client OAuth no ERP) e qualquer coisa no iOS.

## Como rodar

```bash
npm ci
npm run build        # ou: npm run build:demo
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

O gerador roda sob demanda (`npx`), fora das dependências: ele puxa o `sharp`, que não serve ao build e
derrubava o `npm ci` do CI por timeout de rede.

Coloque as artes (vêm da sessão de ativos) em `assets/`:

- `assets/icon-only.png` (1024×1024), `assets/icon-foreground.png` + `assets/icon-background.png`
  (adaptativo Android), `assets/splash.png` e `assets/splash-dark.png` (2732×2732).

```bash
npx @capacitor/assets@3.0.5 generate --iconBackgroundColor '#795BBF' --splashBackgroundColor '#795BBF'
```

## Segredos — nunca no git

`.gitignore` bloqueia keystore (`*.jks`, `*.keystore`), `google-services.json`,
`GoogleService-Info.plist`, `.env`. A keystore vai para o Vaultwarden; o CI recebe tudo por secrets
(o workflow de release é da sessão PUBLICAÇÃO ANDROID).

## O que falta

- [ ] Pendências no ERP — tabela acima (client OAuth, espelho, `/me`, push, conta demo).
- [ ] `google-services.json` (Firebase do [W]) para o push no Android; injetado no CI por secret.
- [ ] Push no iOS por token FCM — PR #2 (sessão iOS), esperando merge.
- [ ] Medir no aparelho o caminho real: login, bater ponto em produção (num colaborador de teste, biz≠4),
      sessão que persiste entre aberturas.
- [ ] iOS: medir o app inteiro (sem Mac aqui; o CI macOS só compila).
- [ ] Workflow de release assinado (sessão PUBLICAÇÃO ANDROID) — precisa da variável `OAUTH_CLIENT_ID`.
