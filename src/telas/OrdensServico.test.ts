import { describe, expect, it } from 'vitest';
import { kpisPatio, rotuloOs, segmentosOs, tintaOs, valorOs } from './OrdensServico';

const etapa = (indice: number, total_etapas = 9) => ({ chave: 'x', rotulo: 'X', indice, total_etapas });

describe('tela 07 · Ordens de serviço — textos e barra', () => {
  it('cabeçalho conta as OS e as travadas, no singular e no plural', () => {
    expect(rotuloOs({ total: 6, travadas: 2 })).toBe('6 OS · 2 travadas');
    expect(rotuloOs({ total: 3, travadas: 1 })).toBe('3 OS · 1 travada');
    expect(rotuloOs({ total: 4, travadas: 0 })).toBe('4 OS');
    expect(rotuloOs(null)).toBe('Oficina');
  });
  it('barra acende um segmento por etapa até a atual, no tamanho do pipeline do ERP', () => {
    expect(segmentosOs(etapa(3, 5))).toEqual([true, true, true, false, false]);
    expect(segmentosOs(etapa(13, 13)).every(Boolean)).toBe(true);
    expect(segmentosOs(etapa(1, 13))).toHaveLength(13);
  });
  it('pipeline vazio não quebra a barra', () => {
    expect(segmentosOs(etapa(0, 0))).toEqual([false]);
  });
  it('cor: travada vence; última etapa é verde; o resto no acento', () => {
    expect(tintaOs({ travada: true, etapa: etapa(9) })).toBe('var(--danger)');
    expect(tintaOs({ travada: false, etapa: etapa(9) })).toBe('var(--ok)');
    expect(tintaOs({ travada: false, etapa: etapa(4) })).toBe('var(--accent-text)');
  });
  it('OS sem valor ainda mostra travessão', () => {
    expect(valorOs(null)).toBe('—');
    expect(valorOs(750)).toMatch(/^R\$\s?750,00$/);
  });
});

describe('tela 23 · Manutenção — indicadores do pátio derivados da 07', () => {
  const etapas = [
    { chave: 'recepcao', rotulo: 'Recepção', total: 1 }, { chave: 'aguardando_pecas', rotulo: 'Aguardando peças', total: 2 },
    { chave: 'pronto_retirada', rotulo: 'Pronto p/ retirar', total: 0 },
  ];
  it('no pátio = OS ativas; peças e prontos = contagem da etapa, inclusive zero', () => {
    expect(kpisPatio({ total: 5, etapas }).map((k) => [k.chave, k.valor])).toEqual([['todas', 5], ['aguardando_pecas', 2], ['pronto_retirada', 0]]);
  });
  it('etapa ausente na resposta some o indicador em vez de mostrar zero falso', () => {
    expect(kpisPatio({ total: 3, etapas: [etapas[0]] }).map((k) => k.chave)).toEqual(['todas']);
  });
});
