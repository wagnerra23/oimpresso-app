import { describe, expect, it } from 'vitest';
import { dataOs, leiturasKm, linhaServico, pecasTrocadas, placaAntiga, servicosDaOs, situacaoRevisao, textoDiferenca, textoVeiculo } from './Veiculos';

describe('tela 08 · Veículos — textos', () => {
  it('linha de km, ano e cor pula o que vier vazio', () => {
    expect(textoVeiculo({ km: 312040, ano: '2019/2020', cor: 'Prata' })).toBe('312.040 km · 2019/2020 · Prata');
    expect(textoVeiculo({ km: 72415, ano: null, cor: null })).toBe('72.415 km');
    expect(textoVeiculo({ km: null, ano: null, cor: null })).toBe('');
  });
  it('data curta do histórico de OS', () => {
    expect(dataOs('2026-06-12')).toBe('12/06');
    expect(dataOs('2025-11-18T10:00:00-03:00')).toBe('18/11');
  });
  it('desenho da placa sai do formato: antiga é 3 letras + 4 números', () => {
    expect(placaAntiga('MLK4109')).toBe(true);
    expect(placaAntiga('mlk-4109')).toBe(true);
    expect(placaAntiga('RLV2E48')).toBe(false);
    expect(placaAntiga('XYZ')).toBe(false);
  });
});

describe('Veículos — km registrado', () => {
  const os = (numero: string, data: string, km: number | null) => ({ os_id: 1, numero, data, etapa_rotulo: null, cliente: null, valor: null, km });

  it('junta cadastro e OS, da mais nova para a mais antiga, com a diferença', () => {
    const ls = leiturasKm({ km_cadastro: 30500, cadastrado_em: '2025-03-10', itens: [os('OS-2', '2026-06-12', 41870), os('OS-3', '2026-10-05', 48312)] });
    expect(ls.map((l) => [l.origem, l.km, l.diferenca])).toEqual([['OS-3', 48312, 6442], ['OS-2', 41870, 11370], ['Cadastro', 30500, null]]);
  });

  it('OS sem km fica de fora; sem nenhuma leitura, lista vazia', () => {
    expect(leiturasKm({ km_cadastro: null, cadastrado_em: null, itens: [os('OS-1', '2026-01-01', null)] })).toEqual([]);
  });

  it('km menor que o anterior aparece com diferença negativa', () => {
    const ls = leiturasKm({ km_cadastro: 50000, cadastrado_em: '2025-01-01', itens: [os('OS-1', '2026-01-01', 49500)] });
    expect(ls[0].diferenca).toBe(-500);
    expect(textoDiferenca(-500)).toBe('−500 km');
    expect(textoDiferenca(3120)).toBe('+3.120 km');
  });

  it('cadastro sem data conta como a leitura mais antiga', () => {
    const ls = leiturasKm({ km_cadastro: 1000, cadastrado_em: null, itens: [os('OS-1', '2026-01-01', 2000)] });
    expect(ls.map((l) => l.origem)).toEqual(['OS-1', 'Cadastro']);
  });
});

describe('Veículos — lembrete de revisão por km', () => {
  it('dentro do aviso: revisão próxima, com quanto falta', () => {
    expect(situacaoRevisao({ km: 48312, proxima_revisao_km: 50000 }, 1000)).toBeNull();
    expect(situacaoRevisao({ km: 49200, proxima_revisao_km: 50000 }, 1000)).toEqual({ tom: 'warn', texto: 'Revisão em 800 km' });
    expect(situacaoRevisao({ km: 49000, proxima_revisao_km: 50000 }, 1000)).toEqual({ tom: 'warn', texto: 'Revisão em 1.000 km' });
  });

  it('passou do km: atrasada; no km exato: agora', () => {
    expect(situacaoRevisao({ km: 312040, proxima_revisao_km: 310000 }, 1000)).toEqual({ tom: 'danger', texto: 'Revisão atrasada 2.040 km' });
    expect(situacaoRevisao({ km: 50000, proxima_revisao_km: 50000 }, 1000)).toEqual({ tom: 'danger', texto: 'Revisão agora' });
  });

  it('sem próxima revisão ou sem km conhecido: nada', () => {
    expect(situacaoRevisao({ km: 1000, proxima_revisao_km: null }, 1000)).toBeNull();
    expect(situacaoRevisao({ km: null, proxima_revisao_km: 5000 }, 1000)).toBeNull();
    expect(situacaoRevisao({ km: 1000 }, 1000)).toBeNull();
  });
});

describe('Veículos — histórico de serviços', () => {
  it('linha: serviço pelo nome, terceiro marcado, peça com quantidade só quando passa de 1', () => {
    expect(linhaServico({ tipo: 'mao_obra', descricao: 'Troca de óleo e filtro', quantidade: 1 })).toBe('Troca de óleo e filtro');
    expect(linhaServico({ tipo: 'servico_terceiro', descricao: 'Alinhamento', quantidade: 1 })).toBe('Alinhamento (terceiro)');
    expect(linhaServico({ tipo: 'peca', descricao: 'Óleo 5W30', quantidade: 4 })).toBe('4× Óleo 5W30');
    expect(linhaServico({ tipo: 'peca', descricao: 'Filtro de óleo', quantidade: 1 })).toBe('Filtro de óleo');
    expect(linhaServico({ tipo: 'peca', descricao: 'Graxa', quantidade: 1.5 })).toBe('1,5× Graxa');
  });

  it('serviços antes das peças, até 4, o resto vira "e mais N"', () => {
    const itens = [
      { tipo: 'peca' as const, descricao: 'Óleo', quantidade: 4 }, { tipo: 'mao_obra' as const, descricao: 'Troca de óleo', quantidade: 1 },
      { tipo: 'peca' as const, descricao: 'Filtro', quantidade: 1 }, { tipo: 'servico_terceiro' as const, descricao: 'Alinhamento', quantidade: 1 },
      { tipo: 'peca' as const, descricao: 'Pastilha', quantidade: 1 },
    ];
    expect(servicosDaOs(itens)).toEqual({ linhas: ['Troca de óleo', 'Alinhamento (terceiro)', '4× Óleo', 'Filtro'], resto: 1 });
  });

  it('o resto conta o que o ERP cortou (itens_total)', () => {
    const itens = [{ tipo: 'mao_obra' as const, descricao: 'A', quantidade: 1 }];
    expect(servicosDaOs(itens, 25)).toEqual({ linhas: ['A'], resto: 24 });
    expect(servicosDaOs([], 0)).toEqual({ linhas: [], resto: 0 });
  });
});

describe('Veículos — peças trocadas', () => {
  type It = { tipo: 'peca' | 'mao_obra' | 'servico_terceiro'; descricao: string; quantidade: number };
  const os = (numero: string, data: string, km: number | null, itens: It[] | undefined, total?: number) =>
    ({ os_id: 1, numero, data, etapa_rotulo: null, cliente: null, valor: null, km, itens, itens_total: total });
  const p = (descricao: string, quantidade = 1): It => ({ tipo: 'peca', descricao, quantidade });

  it('uma linha por peça, com a última troca e quantas vezes', () => {
    const r = pecasTrocadas({ itens: [
      os('OS-3', '2026-10-06', 48312, [p('Bieleta dianteira'), { tipo: 'mao_obra', descricao: 'Troca de bieleta', quantidade: 1 }]),
      os('OS-2', '2026-06-12', 41870, [p('Filtro de óleo'), p('Óleo 5W30', 4)]),
      os('OS-1', '2026-02-03', 35000, [p('filtro  de óleo '), p('Óleo 5W30', 4)]),
    ] });
    expect(r.cortado).toBe(false);
    expect(r.pecas.map((x) => [x.descricao, x.data, x.km, x.os, x.quantidade, x.vezes])).toEqual([
      ['Bieleta dianteira', '2026-10-06', 48312, 'OS-3', 1, 1],
      ['Filtro de óleo', '2026-06-12', 41870, 'OS-2', 1, 2],
      ['Óleo 5W30', '2026-06-12', 41870, 'OS-2', 4, 2],
    ]);
  });

  it('a mesma peça duas vezes na mesma OS conta uma vez', () => {
    const r = pecasTrocadas({ itens: [os('OS-1', '2026-01-01', null, [p('Pastilha'), p('Pastilha')])] });
    expect(r.pecas[0].vezes).toBe(1);
  });

  it('serviços não entram; OS sem itens não quebra; corte do ERP é avisado', () => {
    const r = pecasTrocadas({ itens: [
      os('OS-2', '2026-02-01', null, [{ tipo: 'mao_obra', descricao: 'Revisão', quantidade: 1 }], 25),
      os('OS-1', '2026-01-01', null, undefined),
    ] });
    expect(r.pecas).toEqual([]);
    expect(r.cortado).toBe(true);
  });
});
