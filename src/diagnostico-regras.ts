// Regras do log de falhas (ADR 0429 do ERP: GlitchTip self-host no CT 100, compatível com o SDK do
// Sentry). Arquivo sem dependência do Capacitor, para o teste de unidade rodar em Node.
//
// O que a ADR exige do app: sem dado pessoal (sendDefaultPii: false), sem corpo de requisição, sem
// replay de tela, e environment + release preenchidos. Aqui fica o que dá para testar sem o SDK.

export interface ConfigDiagnostico {
  dsn: string;
  environment: string;
  release: string;
}

/** Só liga com DSN no build e fora do modo demonstração. Sem DSN = nada sai do aparelho. */
export function configDiagnostico(env: {
  VITE_SENTRY_DSN?: string;
  VITE_APP_ENV?: string;
  VITE_APP_RELEASE?: string;
  VITE_DEMO?: string;
}): ConfigDiagnostico | null {
  const dsn = (env.VITE_SENTRY_DSN ?? '').trim();
  if (!dsn || env.VITE_DEMO === '1') return null;
  return {
    dsn,
    environment: (env.VITE_APP_ENV ?? '').trim() || 'desconhecido',
    release: (env.VITE_APP_RELEASE ?? '').trim() || 'oimpresso-app@sem-versao',
  };
}

/** Tira a query string de uma URL: placa, CPF, busca e afins viajam ali. */
export function semQuery(url: string): string {
  const i = url.search(/[?#]/);
  return i === -1 ? url : url.slice(0, i);
}

type Obj = Record<string, unknown>;

/** Remove do evento tudo que pode carregar dado pessoal antes de sair do aparelho. */
export function limparEvento<T extends Obj>(evento: T): T {
  const e = evento as Obj;
  delete e.user;
  const req = e.request as Obj | undefined;
  if (req) {
    delete req.data;
    delete req.cookies;
    delete req.headers;
    delete req.query_string;
    if (typeof req.url === 'string') req.url = semQuery(req.url);
  }
  const bc = (e.breadcrumbs as Obj[] | { values?: Obj[] } | undefined);
  const lista = Array.isArray(bc) ? bc : bc?.values;
  lista?.forEach((b) => limparMigalha(b));
  return evento;
}

/** Migalha de navegação/rede: fica só método, URL sem query e status. */
export function limparMigalha<T extends Obj>(migalha: T): T {
  const d = migalha.data as Obj | undefined;
  if (d) {
    for (const k of Object.keys(d)) if (!['method', 'url', 'status_code', 'from', 'to'].includes(k)) delete d[k];
    for (const k of ['url', 'from', 'to']) if (typeof d[k] === 'string') d[k] = semQuery(d[k] as string);
  }
  return migalha;
}
