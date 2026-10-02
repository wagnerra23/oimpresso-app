import { describe, expect, it } from 'vitest';
import { conferir, corpo, raiz, VAZIO } from './NovaPessoa';

describe('Nova pessoa (tela 09) — corpo do POST /api/app/pessoas', () => {
  it('manda só os papéis marcados e null nos campos em branco', () => {
    const c = corpo({ ...VAZIO, nome: '  Bistrô  ', fornecedor: true });
    expect(c.papeis).toEqual(['cliente', 'fornecedor']);
    expect(c.nome).toBe('Bistrô');
    expect(c.email).toBeNull();
    expect(c.prazo_padrao_dias).toBeNull();
    expect(c.codigo_ibge).toBeNull();
  });

  it('consentimento sem registro não manda a chave (o ERP não muda nada)', () => {
    expect(corpo(VAZIO).consentimento).toEqual({});
    expect(corpo({ ...VAZIO, whatsapp: 'nao', nfe_email: 'sim' }).consentimento).toEqual({ whatsapp: false, email_nfe: true });
  });

  it('pessoa física não manda nome fantasia; indicador de IE vira número', () => {
    const c = corpo({ ...VAZIO, tipo: 'PF', nome_fantasia: 'resto do PJ', indicador_ie: '9' });
    expect(c.nome_fantasia).toBeNull();
    expect(c.indicador_ie).toBe(9);
  });

  it('confere o que impede salvar no passo atual', () => {
    expect(conferir({ ...VAZIO, cliente: false }, 'dados')).toMatchObject({ papeis: expect.any(String), nome: expect.any(String) });
    expect(conferir({ ...VAZIO, nome: 'X', documento: '123' }, 'dados')).toHaveProperty('documento');
    expect(conferir({ ...VAZIO, nome: 'X', documento: '00.000.000/0001-00' }, 'dados')).toEqual({});
    expect(conferir({ ...VAZIO, prazo: '28d' }, 'comercial')).toHaveProperty('prazo_padrao_dias');
  });

  it('erro de item de lista ("papeis.0") volta ao campo da tela', () => {
    expect(raiz('papeis.0')).toBe('papeis');
    expect(raiz('nome')).toBe('nome');
  });
});
