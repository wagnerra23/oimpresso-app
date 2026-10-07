// Liga o log de falhas (falha nativa do Android/iOS + erro de JavaScript) no GlitchTip do
// CT 100 — ADR 0429 do ERP. Regras em diagnostico-regras.ts.
import * as Sentry from '@sentry/capacitor';
import * as SentryReact from '@sentry/react';
import { configDiagnostico, limparEvento, limparMigalha } from './diagnostico-regras';

export function ligarDiagnostico(): void {
  const c = configDiagnostico(import.meta.env);
  if (!c) return;
  Sentry.init(
    {
      dsn: c.dsn,
      environment: c.environment,
      release: c.release,
      sendDefaultPii: false,
      // Sem replay de tela (ADR 0429): nenhuma integração de replay é adicionada, e as opções do
      // SDK do Capacitor nem aceitam taxa de replay. Sem rastreamento de desempenho:
      tracesSampleRate: 0,
      beforeSend: (evento) => limparEvento(evento as unknown as Record<string, unknown>) as unknown as typeof evento,
      beforeBreadcrumb: (migalha) => limparMigalha(migalha as unknown as Record<string, unknown>) as unknown as typeof migalha,
    },
    SentryReact.init,
  );
}
