import { describe, expect, it } from 'vitest';
import { aplicarCep, conferir, corpo, diferencas, formDoCadastro, raiz, VAZIO } from './NovaPessoa';
import type { PessoaCadastro } from '../api';

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

describe('Editar cadastro (tela 34) — PATCH só do que mudou', () => {
  const cad: PessoaCadastro = {
    id: 9, nome: 'Bistrô', tipo: 'PJ',
    identificacao: { razao_social: 'Bistrô Ltda', documento: '**.***.***/0001-00', indicador_ie: 1, papeis: ['cliente'], nome_fantasia: 'Bistrô' },
    contato: { telefone: '(48) 90000-0001', email: 'a@b.exemplo' },
    endereco_fiscal: { cidade: 'Tubarão', uf: 'SC', cep: '88700-000', codigo_ibge: '4218707', email_nfe: null, logradouro: 'Rua A', numero: '10', complemento: null, bairro: 'Centro' },
    comercial: { classificacao: null, limite_credito: null, prazo_padrao_dias: 28 },
    consentimento: { whatsapp: true, email_nfe: null, sms: null, registrado_em: null },
  };

  it('abre preenchido; documento mascarado abre vazio', () => {
    const f = formDoCadastro(cad);
    expect(f).toMatchObject({ nome: 'Bistrô Ltda', nome_fantasia: 'Bistrô', documento: '', indicador_ie: '1', telefone: '(48) 90000-0001',
      logradouro: 'Rua A', numero: '10', bairro: 'Centro', prazo: '28', whatsapp: 'sim', nfe_email: '', cliente: true, fornecedor: false });
  });

  it('sem mudança, nada é enviado (nem o documento mascarado)', () => {
    const f = formDoCadastro(cad);
    expect(diferencas(f, f)).toEqual({});
  });

  it('manda só o campo alterado; esvaziar manda null', () => {
    const ini = formDoCadastro(cad);
    expect(diferencas(ini, { ...ini, telefone: '', prazo: '30' })).toEqual({ telefone: null, prazo_padrao_dias: 30 });
  });

  it('documento só vai se digitarem o número inteiro', () => {
    const ini = formDoCadastro(cad);
    expect(diferencas(ini, { ...ini, documento: '00.000.000/0009-00' })).toEqual({ documento: '00.000.000/0009-00' });
  });

  it('trocar cidade limpa o codigo_ibge junto (null)', () => {
    const ini = formDoCadastro(cad);
    expect(diferencas(ini, { ...ini, cidade: 'Laguna', codigo_ibge: '' })).toEqual({ cidade: 'Laguna', codigo_ibge: null });
  });

  it('consentimento só sai quando muda para Autorizado/Não autorizado', () => {
    const ini = formDoCadastro(cad);
    expect(diferencas(ini, { ...ini, whatsapp: 'nao', nfe_email: 'sim' })).toEqual({ consentimento: { whatsapp: false, email_nfe: true } });
  });

  it('na edição o papel não é conferido (muda só na web)', () => {
    expect(conferir({ ...formDoCadastro(cad), cliente: false }, 'dados', true)).toEqual({});
  });
});
