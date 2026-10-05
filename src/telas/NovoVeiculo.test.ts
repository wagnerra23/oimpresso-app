import { describe, expect, it } from 'vitest';
import { ErroApi, veiculoExistenteDoErro } from '../api';
import { anoDigitado, errosDoForm, normalizarPlaca, placaValida } from './NovoVeiculo';

const form = (o: Partial<Record<string, string>> = {}) => ({ placa: 'RBA2H78', tipo: 'caminhao', reboque: '', anoFab: '', anoMod: '', cor: '', km: '', chassi: '', renavam: '', ...o });

describe('Novo veículo — placa e anos', () => {
  it('placa sai em maiúsculas, sem hífen nem espaço', () => {
    expect(normalizarPlaca('abc-1d23')).toBe('ABC1D23');
    expect(normalizarPlaca(' mlk 4109 ')).toBe('MLK4109');
  });
  it('aceita placa antiga e Mercosul; recusa o resto', () => {
    expect(placaValida('MLK4109')).toBe(true);
    expect(placaValida('ABC1D23')).toBe(true);
    expect(placaValida('AB12345')).toBe(false);
    expect(placaValida('ABC123')).toBe(false);
  });
  it('ano: vazio é null; 4 dígitos entre 1900 e 2100; o resto é inválido', () => {
    expect(anoDigitado('')).toBeNull();
    expect(anoDigitado('2019')).toBe(2019);
    expect(anoDigitado('19')).toBe('invalido');
    expect(anoDigitado('1800')).toBe('invalido');
  });
});

describe('Novo veículo — conferência antes de enviar', () => {
  it('formulário mínimo (placa e tipo) passa', () => {
    expect(Object.values(errosDoForm(form())).filter(Boolean)).toEqual([]);
  });
  it('placa e tipo são obrigatórios', () => {
    const e = errosDoForm(form({ placa: '', tipo: '' }));
    expect(e.placa).toBe('A placa do veículo é obrigatória.');
    expect(e.tipo).toBe('Selecione o tipo do veículo.');
  });
  it('placa, reboque, anos, km e RENAVAM inválidos vão para o campo certo', () => {
    const e = errosDoForm(form({ placa: 'XX1', reboque: 'AB1', anoFab: '19', anoMod: 'abcd', km: '48,3', renavam: '123456789012' }));
    expect(Object.keys(e).sort()).toEqual(['ano_fabricacao', 'ano_modelo', 'km', 'placa', 'placa_secundaria', 'renavam']);
  });
});

describe('Novo veículo — regras do ERP #8687', () => {
  it('reboque igual à placa principal é recusado antes de enviar', () => {
    expect(errosDoForm(form({ reboque: 'rba-2h78' })).placa_secundaria).toBe('A placa do reboque não pode ser igual à principal.');
  });
  it('placa repetida: o id do veículo existente sai do erro do ERP (ou da demo)', () => {
    expect(veiculoExistenteDoErro(new ErroApi(422, 'validacao', 'x', { placa: 'y' }, { veiculo_existente_id: 7 }))).toBe(7);
    expect(veiculoExistenteDoErro(Object.assign(new Error('x'), { veiculo_existente_id: 3 }))).toBe(3);
    expect(veiculoExistenteDoErro(new ErroApi(422, 'validacao', 'x', { placa: 'y' }))).toBeNull();
    expect(veiculoExistenteDoErro(null)).toBeNull();
  });
});
