// Contrato: API-CONTRATO-v1 §6 (`perfil`/`abre_em`/`areas`) + D6 ("perfil colaborador abre no ponto").
// Os dois primeiros casos são as respostas que o teste do ERP (#8495) prova para revisor.ponto e para
// um usuário de vendas; os demais são bordas da montagem.
import { describe, expect, it } from 'vitest';
import { montarNavegacao, NAV_PADRAO } from './navegacao';

describe('montarNavegacao', () => {
  it('colaborador (revisor.ponto): barra Ponto · Mais, abre no Ponto, Mais só com Conta', () => {
    const n = montarNavegacao('colaborador', ['ponto', 'mais'], 'ponto');
    expect(n.abas).toEqual(['ponto', 'mais']);
    expect(n.casa).toBe('ponto');
    expect(n.pontoNaBarra).toBe(true);
    expect(n.modulosMais).toEqual(['conta']);
  });

  it('ERP de vendas sem Essentials: sem Tarefas nem Pessoas, Ponto fora da barra', () => {
    const n = montarNavegacao('erp', ['inicio', 'pedidos', 'producao', 'mais'], 'inicio');
    expect(n.abas).toEqual(['inicio', 'pedidos', 'producao', 'mais']);
    expect(n.casa).toBe('inicio');
    expect(n.modulosMais).toEqual(['conta']);
  });

  it('ERP que também bate ponto: Ponto e Pessoas dentro de Mais, nunca na barra', () => {
    const n = montarNavegacao('erp', ['inicio', 'tarefas', 'pedidos', 'producao', 'pessoas', 'ponto', 'mais'], 'inicio');
    expect(n.abas).toEqual(['inicio', 'tarefas', 'pedidos', 'producao', 'mais']);
    expect(n.pontoNaBarra).toBe(false);
    expect(n.modulosMais).toEqual(['pessoas', 'ponto', 'conta']);
  });

  it('Pagamentos (D16 Onda C) mora em Mais e só com a área liberada', () => {
    const n = montarNavegacao('erp', ['inicio', 'pedidos', 'orcamentos', 'pagamentos', 'ponto', 'mais'], 'inicio');
    expect(n.abas).not.toContain('pagamentos');
    expect(n.modulosMais).toEqual(['orcamentos', 'pagamentos', 'ponto', 'conta']);
    expect(montarNavegacao('erp', ['inicio', 'mais'], 'inicio').modulosMais).toEqual(['conta']);
  });

  it('colaborador sem ponto liberado: abre em Mais, que é a única aba', () => {
    const n = montarNavegacao('colaborador', ['mais'], 'mais');
    expect(n.abas).toEqual(['mais']);
    expect(n.casa).toBe('mais');
  });

  it('abre_em que não está nas áreas cai na primeira aba (nunca numa aba escondida)', () => {
    const n = montarNavegacao('erp', ['pedidos', 'mais'], 'inicio');
    expect(n.casa).toBe('pedidos');
  });

  it('Orçamentos (D16) mora em Mais e só aparece se a área vier liberada', () => {
    expect(montarNavegacao('erp', ['inicio', 'orcamentos', 'mais'], 'inicio').modulosMais).toEqual(['orcamentos', 'conta']);
    expect(montarNavegacao('erp', ['inicio', 'orcamentos', 'mais'], 'inicio').abas).toEqual(['inicio', 'mais']);
    expect(montarNavegacao('erp', ['inicio', 'mais'], 'inicio').modulosMais).toEqual(['conta']);
  });

  it('padrão (ERP sem resposta): as 5 abas de antes da D6', () => {
    expect(NAV_PADRAO.abas).toEqual(['inicio', 'tarefas', 'pedidos', 'producao', 'mais']);
    expect(NAV_PADRAO.modulosMais).toEqual(['pessoas', 'orcamentos', 'produtos', 'estoque', 'pagamentos', 'ponto', 'conta']);
  });
});
