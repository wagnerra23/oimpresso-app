/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** "1" = dados simulados, sem servidor. Nunca no build de loja. */
  readonly VITE_DEMO?: string;
  /** client_id do client OAuth público (password grant) do ERP. Não é segredo. */
  readonly VITE_OAUTH_CLIENT_ID?: string;
  /** "1" = o build levou o google-services.json (push do Google ligado). Posto pelo android-release. */
  readonly VITE_PUSH?: string;
}
interface ImportMeta { readonly env: ImportMetaEnv }
