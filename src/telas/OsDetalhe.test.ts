import { describe, expect, it } from 'vitest';
import { acoesVisiveis, erroDaAcao, ETIQUETA_ITEM, textoFotos, textoKm, textoQuantidade, tintaDetalhe } from './OsDetalhe';
import { ErroApi } from '../api';

describe('tela 03 · Detalhe da OS — textos', () => {
  it('quilometragem com separador de milhar; sem km, nada', () => {
    expect(textoKm(48312)).toBe('48.312 km');
    expect(textoKm(null)).toBeNull();
  });
  it('fotos do laudo: só a contagem, no singular e no plural; nenhuma esconde a linha', () => {
    expect(textoFotos(3)).toBe('3 fotos no laudo — veja no computador');
    expect(textoFotos(1)).toBe('1 foto no laudo — veja no computador');
    expect(textoFotos(0)).toBeNull();
  });
  it('quantidade × valor unitário, sem zeros sobrando', () => {
    expect(textoQuantidade(2, 141)).toMatch(/^2 × R\$\s?141,00$/);
    expect(textoQuantidade(1.5, 80)).toMatch(/^1,5 × R\$\s?80,00$/);
  });
  it('os três tipos de item do ERP têm etiqueta e nome por extenso', () => {
    expect(ETIQUETA_ITEM.peca[1]).toBe('Peça');
    expect(ETIQUETA_ITEM.mao_obra[1]).toBe('Mão de obra');
    expect(ETIQUETA_ITEM.servico_terceiro[1]).toBe('Serviço de terceiro');
  });
  it('cor da etapa: fora do fluxo e terminal neutras, travada vermelha, última verde', () => {
    const e = (indice: number | null, terminal = false) => ({ chave: 'x', rotulo: 'X', indice, total_etapas: 6, terminal });
    expect(tintaDetalhe({ etapa: null, travada: false })).toBe('var(--text-dim)');
    expect(tintaDetalhe({ etapa: e(null, true), travada: false })).toBe('var(--text-dim)');
    expect(tintaDetalhe({ etapa: e(4), travada: true })).toBe('var(--danger)');
    expect(tintaDetalhe({ etapa: e(6), travada: false })).toBe('var(--ok)');
    expect(tintaDetalhe({ etapa: e(5), travada: false })).toBe('var(--accent-text)');
  });
});

describe('tela 03 · avançar etapa', () => {
  const a = (chave: string, pode: boolean, bloqueio: string | null = null) => ({ chave, rotulo: chave, critica: false, pode, bloqueio });
  it('o rodapé mostra só as ações que o usuário pode executar, e nada com a escrita desligada', () => {
    const acoes = [a('concluir_servico', true), a('entregar', false)];
    expect(acoesVisiveis(acoes, true).map((x) => x.chave)).toEqual(['concluir_servico']);
    expect(acoesVisiveis(acoes, false)).toEqual([]);
    expect(acoesVisiveis(undefined, true)).toEqual([]);
  });
  it('ação bloqueada pelo gate continua visível (o motivo aparece embaixo)', () => {
    expect(acoesVisiveis([a('enviar_orcamento', true, 'Falta: Orçamento com ≥ 1 item lançado.')], true)).toHaveLength(1);
  });
  it('erro: 403 vira texto de permissão; o resto usa a mensagem do ERP', () => {
    expect(erroDaAcao(new ErroApi(403, 'sem_permissao', 'x'))).toBe('Seu usuário não pode mudar a etapa desta OS.');
    expect(erroDaAcao(new ErroApi(422, 'bloqueado', 'Falta foto da vistoria.'))).toBe('Falta foto da vistoria.');
    expect(erroDaAcao(new ErroApi(409, 'etapa_mudou', 'A OS mudou de etapa.'))).toBe('A OS mudou de etapa.');
    expect(erroDaAcao(null)).toBe('Não foi possível mudar a etapa. Tente de novo.');
  });
});

describe('tela 03 · avançar etapa — ação recusada pelo ERP', () => {
  it('nao_suportada (ação fora da lista ou com efeito colateral) mostra a mensagem do ERP', () => {
    expect(erroDaAcao(new ErroApi(422, 'nao_suportada', 'Esta ação não é feita pelo app.'))).toBe('Esta ação não é feita pelo app.');
  });
});
