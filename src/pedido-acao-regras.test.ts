// P1 · avançar etapa do pedido: regras do rodapé e o contrato da rota na demo (que imita o ERP #9445).
import { afterEach, describe, expect, it } from 'vitest';
import { demo } from './demo';
import { acoesDoRodape, corpoAcao, reacaoAoErro, soConsulta, textoMudanca, tituloConfirmacao } from './pedido-acao-regras';
import { novaChave } from './venda';
import type { PedidoDetalheApi } from './api';

const pausar = { chave: 'pausar_producao', rotulo: 'Pausar produção', pode: true };
const iniciar = { chave: 'iniciar_producao', rotulo: 'Iniciar produção', pode: true };

describe('rodapé do detalhe', () => {
  it('ajuste vazio mostra todas as ações que o usuário pode; com itens, só as liberadas', () => {
    expect(acoesDoRodape([pausar, iniciar], [])).toEqual([pausar, iniciar]);
    expect(acoesDoRodape([pausar, iniciar], ['iniciar_producao'])).toEqual([iniciar]);
    expect(acoesDoRodape([pausar], ['concluir'])).toEqual([]);
  });

  it('sem permissão o botão some e o rodapé diz que é só consulta', () => {
    const semPode = { ...pausar, pode: false };
    expect(acoesDoRodape([semPode], [])).toEqual([]);
    expect(soConsulta([semPode], [])).toBe(true);
    // Ação não liberada pela empresa não é "só consulta": simplesmente não existe no app.
    expect(soConsulta([semPode], ['concluir'])).toBe(false);
    expect(soConsulta([], [])).toBe(false);
    expect(soConsulta([pausar], [])).toBe(false);
  });

  it('folha usa o destino da lista segura e cai no rótulo para ação desconhecida', () => {
    expect(tituloConfirmacao(iniciar)).toBe('Mover para Em produção?');
    expect(tituloConfirmacao(pausar)).toBe('Mover para Em espera?');
    expect(tituloConfirmacao({ chave: 'nova', rotulo: 'Liberar', pode: true })).toBe('Liberar?');
  });

  it('corpo leva etapa_esperada e motivo vazio vira null', () => {
    expect(corpoAcao('pausar_producao', 'in_production', '  ')).toEqual({ acao: 'pausar_producao', motivo: null, etapa_esperada: 'in_production' });
    expect(corpoAcao('pausar_producao', 'in_production', ' falta lona ').motivo).toBe('falta lona');
  });

  it('cada código do contrato tem a sua reação', () => {
    expect(reacaoAoErro(409, 'etapa_mudou')).toMatchObject({ reacao: 'recarregar', manterChave: false });
    expect(reacaoAoErro(409, 'em_andamento')).toMatchObject({ reacao: 'repetir', manterChave: true });
    expect(reacaoAoErro(403, 'sem_permissao').reacao).toBe('sumir');
    expect(reacaoAoErro(404, 'nao_encontrado').reacao).toBe('voltar');
    expect(reacaoAoErro(404, 'erro').reacao).toBe('avisar');
    expect(reacaoAoErro(429, 'erro')).toMatchObject({ reacao: 'repetir', mensagem: 'Tente de novo em instantes.' });
    expect(reacaoAoErro(0, 'rede').manterChave).toBe(true);
    expect(reacaoAoErro(500, 'falha').manterChave).toBe(true);
    expect(reacaoAoErro(422, 'idempotencia_conflito')).toMatchObject({ reacao: 'avisar', manterChave: false });
  });

  it('linha do histórico', () => {
    expect(textoMudanca({ em: '', quem: null, de: 'Em produção', para: 'Em espera' })).toBe('Em produção → Em espera');
    expect(textoMudanca({ em: '', quem: null, de: null, para: 'Orçamento' })).toBe('Orçamento');
  });
});

const detalhe = (id: number) => demo.chamar<PedidoDetalheApi>('GET', `/api/app/pedidos/${id}`);
const mover = (id: number, corpo: unknown, chave: string | null = novaChave()) =>
  demo.chamar<PedidoDetalheApi>('POST', `/api/app/pedidos/${id}/acao`, corpo, chave ? { 'Idempotency-Key': chave } : {});
const falha = async (pr: Promise<unknown>) => { try { await pr; } catch (e) { return e as { status: number; codigo?: string; campos?: Record<string, string> }; } throw new Error('não falhou'); };

describe('POST /pedidos/{id}/acao na demo', () => {
  afterEach(() => { demo.definirAjustes(); demo.definirPodeAcoesPedido(true); });

  it('acoes[] só traz a ação segura da etapa; o POST move, grava o histórico e repete sem mover 2×', async () => {
    const antes = await detalhe(106);
    expect(antes.etapa.chave).toBe('quote_approved');
    expect(antes.acoes).toEqual([{ chave: 'iniciar_producao', rotulo: 'Iniciar produção', pode: true }]);
    const corpo = corpoAcao('iniciar_producao', 'quote_approved'), chave = novaChave();
    const depois = await mover(106, corpo, chave);
    expect(depois.etapa).toMatchObject({ chave: 'in_production', grupo: 'producao' });
    expect(depois.acoes.map((a) => a.chave)).toEqual(['pausar_producao']);
    expect(depois.historico?.[0]).toMatchObject({ de: 'Aprovado pelo cliente', para: 'Em produção', origem: 'app' });
    const n = depois.historico!.length;
    const repetida = await mover(106, corpo, chave);
    expect(repetida.etapa.chave).toBe('in_production');
    expect((await detalhe(106)).historico).toHaveLength(n);
    expect(await falha(mover(106, corpoAcao('pausar_producao', 'in_production'), chave))).toMatchObject({ status: 422, codigo: 'idempotencia_conflito' });
  });

  it('etapa_esperada velha → 409 etapa_mudou, e a etapa não muda', async () => {
    expect(await falha(mover(107, corpoAcao('pausar_producao', 'quote_approved')))).toMatchObject({ status: 409, codigo: 'etapa_mudou' });
    expect((await detalhe(107)).etapa.chave).toBe('in_production');
  });

  it('ação fora da lista liberada ou sem RBAC → 403; e some de acoes[]', async () => {
    demo.definirAjustes({ app_acoes_fsm_liberadas: ['concluir'] });
    expect((await detalhe(103)).acoes).toEqual([]);
    expect(await falha(mover(103, corpoAcao('pausar_producao', 'in_production')))).toMatchObject({ status: 403, codigo: 'sem_permissao' });
    demo.definirAjustes();
    demo.definirPodeAcoesPedido(false);
    expect((await detalhe(103)).acoes).toEqual([{ chave: 'pausar_producao', rotulo: 'Pausar produção', pode: false, pede_motivo: true }]);
    expect(await falha(mover(103, corpoAcao('pausar_producao', 'in_production')))).toMatchObject({ status: 403 });
    expect(await falha(mover(103, corpoAcao('cancelar_venda', 'in_production')))).toMatchObject({ status: 403 });
  });

  it('422 validacao sem chave ou sem etapa_esperada; 404 para pedido que não existe', async () => {
    expect(await falha(mover(103, corpoAcao('pausar_producao', 'in_production'), null))).toMatchObject({ status: 422, codigo: 'validacao' });
    expect((await falha(mover(103, { acao: 'pausar_producao' })))?.campos).toHaveProperty('etapa_esperada');
    expect(await falha(mover(9999, corpoAcao('pausar_producao', 'in_production')))).toMatchObject({ status: 404, codigo: 'nao_encontrado' });
  });
});
