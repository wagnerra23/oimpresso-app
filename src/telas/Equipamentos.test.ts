import { describe, expect, it } from 'vitest';
import { nomeEquipamento, rotuloEquipamentos, textoMedida } from './Equipamentos';

describe('tela 24 · Equipamentos — textos', () => {
  it('nome ganha o apelido quando houver', () => {
    expect(nomeEquipamento({ nome: 'Scania R 450', apelido: 'Vermelhão' })).toBe('Scania R 450 · Vermelhão');
    expect(nomeEquipamento({ nome: 'Iveco Daily 70C17', apelido: null })).toBe('Iveco Daily 70C17');
  });
  it('medida em km ou h com milhar, e o ano; pula o que vier vazio', () => {
    expect(textoMedida({ medida: 184523, unidade: 'km', ano: 2019 })).toBe('184.523 km · 2019');
    expect(textoMedida({ medida: 4521, unidade: 'h', ano: null })).toBe('4.521 h');
    expect(textoMedida({ medida: null, unidade: 'h', ano: 2018 })).toBe('2018');
    expect(textoMedida({ medida: null, unidade: 'km', ano: null })).toBe('');
  });
  it('cabeçalho no singular e no plural', () => {
    expect(rotuloEquipamentos(6)).toBe('6 vinculados a clientes');
    expect(rotuloEquipamentos(1)).toBe('1 vinculado a clientes');
  });
});
