import { describe, expect, it } from 'vitest';
import { aplicarCep, conferir, corpo, raiz, VAZIO } from './NovaPessoa';

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

describe('Nova pessoa (tela 09) — Buscar do CEP (GET /api/app/cep)', () => {
  const achado = { cep: '88701000', logradouro: 'Rua A', complemento: 'sala 2', bairro: 'Centro', cidade: 'Tubarão', uf: 'SC', codigo_ibge: '4218707' };

  it('preenche o endereço, formata o CEP e leva o codigo_ibge no POST como texto', () => {
    const f = aplicarCep({ ...VAZIO, cep: '88701000' }, achado);
    expect(f).toMatchObject({ cep: '88701-000', logradouro: 'Rua A', bairro: 'Centro', cidade: 'Tubarão', uf: 'SC', complemento: 'sala 2' });
    expect(corpo(f).codigo_ibge).toBe('4218707');
  });

  it('não apaga o complemento que o usuário já escreveu', () => {
    expect(aplicarCep({ ...VAZIO, complemento: 'fundos' }, achado).complemento).toBe('fundos');
  });

  it('codigo_ibge null (CEP em cache) vai null no POST', () => {
    expect(corpo(aplicarCep(VAZIO, { ...achado, codigo_ibge: null })).codigo_ibge).toBeNull();
  });

  it('sem busca, codigo_ibge vai null', () => {
    expect(corpo({ ...VAZIO, cidade: 'Tubarão', uf: 'SC' }).codigo_ibge).toBeNull();
  });
});
