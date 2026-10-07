/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** "1" = dados simulados, sem servidor. Nunca no build de loja. */
  readonly VITE_DEMO?: string;
  /** client_id do client OAuth público (password grant) do ERP. Não é segredo. */
  readonly VITE_OAUTH_CLIENT_ID?: string;
  /** DSN do log de falhas (GlitchTip do CT 100, ADR 0429). Público por natureza; vem da variável do repo. */
  readonly VITE_SENTRY_DSN?: string;
  /** Ambiente do log de falhas (ex.: teste-fechado). */
  readonly VITE_APP_ENV?: string;
  /** Versão no log de falhas: oimpresso-app@<versionName>+<versionCode>. */
  readonly VITE_APP_RELEASE?: string;
  /** "1" = o build levou o google-services.json (push do Google ligado). Posto pelo android-release. */
  readonly VITE_PUSH?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
