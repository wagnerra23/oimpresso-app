import { describe, expect, it } from 'vitest';
import { configDiagnostico, limparEvento, limparMigalha, semQuery } from './diagnostico-regras';

describe('configDiagnostico', () => {
  it('sem DSN no build, nada sai do aparelho', () => {
    expect(configDiagnostico({})).toBeNull();
    expect(configDiagnostico({ VITE_SENTRY_DSN: '  ' })).toBeNull();
  });

  it('modo demonstração nunca envia', () => {
    expect(configDiagnostico({ VITE_SENTRY_DSN: 'https://k@apm.exemplo/1', VITE_DEMO: '1' })).toBeNull();
  });

  it('com DSN, leva environment e release do build', () => {
    expect(configDiagnostico({ VITE_SENTRY_DSN: 'https://k@apm.exemplo/1', VITE_APP_ENV: 'teste-fechado', VITE_APP_RELEASE: 'oimpresso-app@1.0+9' }))
      .toEqual({ dsn: 'https://k@apm.exemplo/1', environment: 'teste-fechado', release: 'oimpresso-app@1.0+9' });
  });

  it('sem environment/release ainda envia, mas marcado', () => {
    expect(configDiagnostico({ VITE_SENTRY_DSN: 'https://k@apm.exemplo/1' }))
      .toEqual({ dsn: 'https://k@apm.exemplo/1', environment: 'desconhecido', release: 'oimpresso-app@sem-versao' });
  });
});

describe('limparEvento', () => {
  it('tira usuário, corpo, cookies, cabeçalhos e query da requisição', () => {
    const e = limparEvento({
      user: { id: 7, email: 'fulano@exemplo.test' },
      request: { url: 'https://erp.exemplo/api/app/veiculos?placa=ABC1D23', data: { senha: 'x' }, cookies: { a: 'b' }, headers: { Authorization: 'Bearer t' }, query_string: 'placa=ABC1D23' },
    });
    expect(e).toEqual({ request: { url: 'https://erp.exemplo/api/app/veiculos' } });
  });

  it('limpa as migalhas de rede do evento', () => {
    const e = limparEvento({ breadcrumbs: [{ category: 'xhr', data: { method: 'POST', url: 'https://erp.exemplo/oauth/token?x=1', request_body: 'senha', status_code: 200 } }] });
    expect(e).toEqual({ breadcrumbs: [{ category: 'xhr', data: { method: 'POST', url: 'https://erp.exemplo/oauth/token', status_code: 200 } }] });
  });
});

describe('limparMigalha', () => {
  it('navegação mantém de/para sem query', () => {
    expect(limparMigalha({ category: 'navigation', data: { from: '/a?cpf=1', to: '/b#x' } })).toEqual({ category: 'navigation', data: { from: '/a', to: '/b' } });
  });

  it('semQuery corta em ? ou #', () => {
    expect(semQuery('https://x/y?z=1')).toBe('https://x/y');
    expect(semQuery('https://x/y#z')).toBe('https://x/y');
    expect(semQuery('https://x/y')).toBe('https://x/y');
  });
});
