// P3 · protocolo de entrega: o que é obrigatório (assinatura, motivo, localização) e o contrato da rota na demo
// (que imita o ERP #9464).
import { afterEach, describe, expect, it } from 'vitest';
import { demo } from './demo';
import {
  assinaturaValida, botaoEntrega, bytesDataUrl, corpoEntrega, faltaNaEntrega, parteDoCampo, podeSemAssinatura,
  reacaoAoErroEntrega, textoLocal, type Entrega,
} from './entrega-regras';
import { novaChave } from './venda';
import type { EntregaRegistrada, PedidoDetalheApi } from './api';

const livre = { app_entrega_exige_assinatura: false, app_entrega_exige_localizacao: false };
const comAss = { ...livre, app_entrega_exige_assinatura: true };
const comLocal = { ...livre, app_entrega_exige_localizacao: true };
const LINHAS = [5512, 5513, 5514];
const PNG = 'data:image/png;base64,' + 'iVBORw0KGgo='; // 8 bytes
const local = { lat: -26.8977, lng: -49.2316, precisao_m: 12.4 };
const pronta: Entrega = { conferidos: LINHAS, recebidoPor: 'Dra. Paula Reis', semAssinatura: false, motivo: '', assinou: true, local: null };

describe('o que é obrigatório na entrega', () => {
  it('pronta com tudo conferido, nome e assinatura', () => {
    expect(faltaNaEntrega(LINHAS, pronta, livre)).toBe('');
  });

  it('conferência: todas as linhas, na ordem da tela', () => {
    expect(faltaNaEntrega(LINHAS, { ...pronta, conferidos: [5512, 5513] }, livre)).toBe('Confira todos os itens.');
    expect(faltaNaEntrega([], { ...pronta, conferidos: [] }, livre)).toBe('Confira todos os itens.');
  });

  it('quem recebeu: 2 a 120 caracteres', () => {
    expect(faltaNaEntrega(LINHAS, { ...pronta, recebidoPor: ' A ' }, livre)).toBe('Informe quem recebeu.');
    expect(faltaNaEntrega(LINHAS, { ...pronta, recebidoPor: 'x'.repeat(121) }, livre)).toMatch(/120/);
  });

  it('sem assinatura: só com o ajuste desligado, e com motivo de 5 a 200', () => {
    const sem = { ...pronta, assinou: false, semAssinatura: true };
    expect(faltaNaEntrega(LINHAS, { ...sem, motivo: 'pq' }, livre)).toBe('Diga por que ficou sem assinatura.');
    expect(faltaNaEntrega(LINHAS, { ...sem, motivo: 'x'.repeat(201) }, livre)).toMatch(/200/);
    expect(faltaNaEntrega(LINHAS, { ...sem, motivo: 'Deixado com o porteiro' }, livre)).toBe('');
    expect(podeSemAssinatura(livre)).toBe(true);
  });

  it('com app_entrega_exige_assinatura a opção some e a assinatura é obrigatória', () => {
    expect(podeSemAssinatura(comAss)).toBe(false);
    const sem = { ...pronta, assinou: false, semAssinatura: true, motivo: 'Deixado com o porteiro' };
    expect(faltaNaEntrega(LINHAS, sem, comAss)).toBe('Falta a assinatura.');
    expect(faltaNaEntrega(LINHAS, { ...pronta, assinou: false }, livre)).toBe('Falta a assinatura — ou marque "Recebido sem assinatura".');
  });

  it('localização só trava com app_entrega_exige_localizacao', () => {
    expect(faltaNaEntrega(LINHAS, pronta, livre)).toBe('');
    expect(faltaNaEntrega(LINHAS, pronta, comLocal)).toBe('A empresa exige a localização da entrega.');
    expect(faltaNaEntrega(LINHAS, { ...pronta, local }, comLocal)).toBe('');
  });
});

describe('corpo do POST', () => {
  it('com assinatura: PNG vai, motivo não; localização arredondada', () => {
    expect(corpoEntrega(LINHAS, { ...pronta, motivo: 'esquecido', local }, livre, PNG, 'paid')).toEqual({
      itens: LINHAS.map((linha_id) => ({ linha_id, conferido: true })), recebido_por: 'Dra. Paula Reis', documento: null,
      assinatura_png: PNG, sem_assinatura_motivo: null, lat: -26.8977, lng: -49.2316, precisao_m: 12, etapa_esperada: 'paid',
    });
  });

  it('sem assinatura: motivo vai aparado, PNG não; sem local vai null', () => {
    const c = corpoEntrega(LINHAS, { ...pronta, semAssinatura: true, motivo: '  Deixado com o porteiro ' }, livre, PNG, 'paid');
    expect(c).toMatchObject({ assinatura_png: null, sem_assinatura_motivo: 'Deixado com o porteiro', lat: null, lng: null, precisao_m: null });
  });

  it('a opção "sem assinatura" marcada não vale quando a empresa exige', () => {
    const c = corpoEntrega(LINHAS, { ...pronta, semAssinatura: true, motivo: 'Deixado com o porteiro' }, comAss, PNG, 'paid');
    expect(c).toMatchObject({ assinatura_png: PNG, sem_assinatura_motivo: null });
  });

  it('assinatura: data URL PNG de até 200 KB decodificado', () => {
    expect(bytesDataUrl(PNG)).toBe(8);
    expect(assinaturaValida(PNG)).toBe(true);
    expect(assinaturaValida('data:image/jpeg;base64,AAAA')).toBe(false);
    expect(assinaturaValida(null)).toBe(false);
    expect(assinaturaValida('data:image/png;base64,' + 'A'.repeat(Math.ceil((200 * 1024 * 4) / 3) + 8))).toBe(false);
  });
});

describe('rodapé e erros', () => {
  it('botão só com entrega.pode e sem 403 nesta visita', () => {
    expect(botaoEntrega({ pode: true }, false)).toBe(true);
    expect(botaoEntrega({ pode: false }, false)).toBe(false);
    expect(botaoEntrega(null, false)).toBe(false);
    expect(botaoEntrega(undefined, false)).toBe(false);
    expect(botaoEntrega({ pode: true }, true)).toBe(false);
  });

  it('cada código do contrato tem a sua reação', () => {
    expect(reacaoAoErroEntrega(409, 'etapa_mudou')).toMatchObject({ reacao: 'recarregar', manterChave: false });
    expect(reacaoAoErroEntrega(409, 'em_andamento')).toMatchObject({ reacao: 'repetir', manterChave: true });
    expect(reacaoAoErroEntrega(403, 'sem_permissao').reacao).toBe('sumir');
    expect(reacaoAoErroEntrega(404, 'nao_encontrado').reacao).toBe('voltar');
    expect(reacaoAoErroEntrega(404, 'erro').reacao).toBe('avisar');
    expect(reacaoAoErroEntrega(422, 'validacao')).toMatchObject({ reacao: 'campos', manterChave: false });
    expect(reacaoAoErroEntrega(422, 'bloqueado').reacao).toBe('avisar');
    expect(reacaoAoErroEntrega(422, 'idempotencia_conflito')).toMatchObject({ reacao: 'avisar', manterChave: false });
    expect(reacaoAoErroEntrega(503, 'sem_configuracao')).toMatchObject({ reacao: 'repetir', manterChave: true });
    expect(reacaoAoErroEntrega(429, 'erro').manterChave).toBe(true);
    expect(reacaoAoErroEntrega(0, 'rede').manterChave).toBe(true);
  });

  it('campo do 422 vai para a parte certa da tela', () => {
    expect(parteDoCampo('itens')).toBe('itens');
    expect(parteDoCampo('itens.0.conferido')).toBe('itens');
    expect(parteDoCampo('recebido_por')).toBe('recebido');
    expect(parteDoCampo('sem_assinatura_motivo')).toBe('assinatura');
    expect(parteDoCampo('lng')).toBe('local');
    expect(parteDoCampo('etapa_esperada')).toBe('geral');
  });

  it('texto do local', () => {
    expect(textoLocal(local)).toBe('-26.89770, -49.23160 · ±12 m');
    expect(textoLocal(null)).toBe('Sem localização');
  });
});

const detalhe = (id: number) => demo.chamar<PedidoDetalheApi>('GET', `/api/app/pedidos/${id}`);
const entregar = (id: number, corpo: unknown, chave: string | null = novaChave()) =>
  demo.chamar<EntregaRegistrada>('POST', `/api/app/pedidos/${id}/entrega`, corpo, chave ? { 'Idempotency-Key': chave } : {});
const falha = async (pr: Promise<unknown>) => { try { await pr; } catch (e) { return e as { status: number; codigo?: string; campos?: Record<string, string> }; } throw new Error('não falhou'); };

describe('POST /pedidos/{id}/entrega na demo', () => {
  afterEach(() => { demo.definirAjustes(); demo.definirPodeAcoesPedido(true); });

  it('detalhe manda entrega e linha_id; fora da etapa, entrega null', async () => {
    const p = await detalhe(102);
    expect(p.entrega).toEqual({ pode: true });
    expect(p.itens_venda.map((i) => i.linha_id)).toEqual([10201, 10202]);
    expect(p.acoes.map((a) => a.chave)).not.toContain('entregar');
    expect((await detalhe(103)).entrega).toBeNull();
    demo.definirPodeAcoesPedido(false);
    expect((await detalhe(102)).entrega).toEqual({ pode: false });
  });

  it('valida como o ERP, respeita os ajustes e registra uma vez só com a mesma chave', async () => {
    const p = await detalhe(102);
    const linhas = p.itens_venda.map((i) => i.linha_id!);
    const e: Entrega = { ...pronta, conferidos: linhas, assinou: false, semAssinatura: true, motivo: 'Deixado com o porteiro' };
    const corpo = (x: Entrega = e, png: string | null = null) => corpoEntrega(linhas, x, livre, png, p.etapa.chave);

    expect(await falha(entregar(102, corpo(), null))).toMatchObject({ status: 422, campos: { idempotency_key: expect.any(String) } });
    expect(await falha(entregar(102, corpo({ ...e, conferidos: [linhas[0]] })))).toMatchObject({ status: 422, campos: { itens: expect.any(String) } });
    expect(await falha(entregar(102, corpo({ ...e, motivo: 'pq' })))).toMatchObject({ status: 422, campos: { assinatura_png: expect.any(String) } });
    expect(await falha(entregar(102, { ...corpo(), etapa_esperada: 'in_production' }))).toMatchObject({ status: 409, codigo: 'etapa_mudou' });

    demo.definirAjustes({ app_entrega_exige_assinatura: true });
    expect(await falha(entregar(102, corpo()))).toMatchObject({ status: 422, campos: { assinatura_png: expect.any(String) } });
    demo.definirAjustes({ app_entrega_exige_assinatura: false, app_entrega_exige_localizacao: true });
    expect(await falha(entregar(102, corpo()))).toMatchObject({ status: 422, campos: { lat: expect.any(String) } });
    demo.definirAjustes();

    demo.definirPodeAcoesPedido(false);
    expect(await falha(entregar(102, corpo()))).toMatchObject({ status: 403, codigo: 'sem_permissao' });
    demo.definirPodeAcoesPedido(true);

    const chave = novaChave();
    const c = corpo({ ...e, semAssinatura: false, assinou: true, local }, PNG);
    const r = await entregar(102, c, chave);
    expect(r.protocolo).toMatch(/^ENT-\d{4}$/);
    expect(r).toMatchObject({ recebido_por: 'Dra. Paula Reis', com_assinatura: true });
    expect(r.pedido.etapa).toMatchObject({ chave: 'delivered', grupo: 'entrega' });
    expect(r.pedido.entrega).toBeNull();
    expect(r.pedido.acoes.map((a) => a.chave)).toEqual(['concluir']);
    expect(r.pedido.historico?.[0]).toMatchObject({ para: 'Entregue', origem: 'app' });

    const repetida = await entregar(102, c, chave);
    expect(repetida.protocolo).toBe(r.protocolo);
    expect(await falha(entregar(102, corpo(), chave))).toMatchObject({ status: 422, codigo: 'idempotencia_conflito' });
    // Já entregue: chave nova cai em etapa_mudou.
    expect(await falha(entregar(102, c))).toMatchObject({ status: 409, codigo: 'etapa_mudou' });
    expect(await falha(entregar(999, c))).toMatchObject({ status: 404, codigo: 'nao_encontrado' });
  });
});
