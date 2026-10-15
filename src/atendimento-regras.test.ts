// Tela 41 · Atendimento WhatsApp (P5): bloqueio do envio (LGPD + offline), atalhos, erros e a demo que imita o ERP PR 18.
import { afterEach, describe, expect, it } from 'vitest';
import {
  avisoDeConsentimento, bloqueioDoEnvio, janelaAberta, manterChave, mensagemDeErro, mostraAtalhos, MSG_OFFLINE, MSG_SEM_CONSENTIMENTO,
  textoDaMensagem, totalNaoLidas, type DetalheAtendimento, type ListaAtendimento,
} from './atendimento-regras';
import { montarNavegacao, NAV_PADRAO } from './navegacao';
import { demo } from './demo';
import { novaChave } from './venda';
import type { PainelInicio } from './api';

const AGORA = Date.parse('2026-10-05T13:00:00Z');
const aberta = '2026-10-06T12:31:00Z';
const fechou = '2026-10-05T12:59:00Z';

describe('janelaAberta', () => {
  it('vale até o fim das 24 h', () => expect(janelaAberta({ janela_aberta_ate: aberta }, AGORA)).toBe(true));
  it('null ou no passado = fechada', () => {
    expect(janelaAberta({ janela_aberta_ate: null }, AGORA)).toBe(false);
    expect(janelaAberta({ janela_aberta_ate: fechou }, AGORA)).toBe(false);
    expect(janelaAberta({ janela_aberta_ate: 'lixo' }, AGORA)).toBe(false);
  });
});

describe('bloqueioDoEnvio (LGPD Art. 7º, I + offline)', () => {
  it('com consentimento envia mesmo com a janela fechada (envio ativo)', () =>
    expect(bloqueioDoEnvio({ consentimento: true, janela_aberta_ate: null }, true, AGORA)).toBeNull());
  it('sem consentimento responde dentro da janela que o cliente abriu', () =>
    expect(bloqueioDoEnvio({ consentimento: false, janela_aberta_ate: aberta }, true, AGORA)).toBeNull());
  it('sem consentimento e fora da janela: travado, com o motivo', () =>
    expect(bloqueioDoEnvio({ consentimento: false, janela_aberta_ate: null }, true, AGORA)).toBe(MSG_SEM_CONSENTIMENTO));
  it('offline trava sempre', () => {
    expect(bloqueioDoEnvio({ consentimento: true, janela_aberta_ate: aberta }, false, AGORA)).toBe(MSG_OFFLINE);
    expect(bloqueioDoEnvio({ consentimento: false, janela_aberta_ate: null }, false, AGORA)).toBe(MSG_OFFLINE);
  });
});

describe('avisoDeConsentimento', () => {
  it('só na conversa sem consentimento com a janela aberta', () => {
    expect(avisoDeConsentimento({ consentimento: false, janela_aberta_ate: aberta }, AGORA)).toMatch(/LGPD/);
    expect(avisoDeConsentimento({ consentimento: true, janela_aberta_ate: aberta }, AGORA)).toBeNull();
    // Fora da janela quem fala é o bloqueio do rodapé, não o aviso.
    expect(avisoDeConsentimento({ consentimento: false, janela_aberta_ate: null }, AGORA)).toBeNull();
  });
});

describe('atalhos e contadores', () => {
  it('atalhos só com o ajuste ligado e conversa ligada a cliente', () => {
    expect(mostraAtalhos(true, { contato: { id: 1, nome: 'X' } })).toBe(true);
    expect(mostraAtalhos(false, { contato: { id: 1, nome: 'X' } })).toBe(false);
    expect(mostraAtalhos(true, { contato: { id: null, nome: '+55' } })).toBe(false);
  });
  it('soma das não lidas', () => expect(totalNaoLidas([{ nao_lidas: 2 }, { nao_lidas: 0 }, { nao_lidas: 1 }])).toBe(3));
  it('mídia vira rótulo (sem URL na v1)', () => {
    expect(textoDaMensagem({ texto: null, midia: { tipo: 'image', nome: 'logo.png' } })).toBe('[imagem · logo.png]');
    expect(textoDaMensagem({ texto: 'veja', midia: { tipo: 'document', nome: null } })).toBe('[documento] veja');
    expect(textoDaMensagem({ texto: null, midia: { tipo: 'outro', nome: null } })).toBe('[outro]');
    expect(textoDaMensagem({ texto: ' oi ', midia: null })).toBe('oi');
  });
});

describe('mensagemDeErro e chave de idempotência', () => {
  it('códigos do contrato viram texto em PT-BR', () => {
    expect(mensagemDeErro({ status: 422, codigo: 'sem_consentimento', message: 'x' })).toBe(MSG_SEM_CONSENTIMENTO);
    expect(mensagemDeErro({ status: 422, codigo: 'janela_fechada' })).toMatch(/24 h/);
    expect(mensagemDeErro({ status: 502, codigo: 'falha_envio' })).toMatch(/não aceitou/);
    expect(mensagemDeErro({ status: 429, codigo: 'erro', message: 'Too Many Attempts.' })).toMatch(/Espere um minuto/);
    expect(mensagemDeErro({ status: 403, codigo: 'sem_permissao', message: 'Os atalhos estão desligados.' })).toBe('Os atalhos estão desligados.');
    expect(mensagemDeErro({ status: 422, codigo: 'validacao', campos: { texto: 'Escreva a mensagem.' } })).toBe('Escreva a mensagem.');
  });
  it('rede, 5xx e 409 mantêm a chave; regra e falha_envio (gravada no ERP) pedem chave nova', () => {
    expect(manterChave(0)).toBe(true);
    expect(manterChave(503)).toBe(true);
    expect(manterChave(409, 'em_andamento')).toBe(true);
    expect(manterChave(502, 'falha_envio')).toBe(false);
    expect(manterChave(422, 'sem_consentimento')).toBe(false);
  });
});

describe('área em Mais', () => {
  it('Atendimento só aparece quando o ERP manda a área (canal ligado)', () => {
    expect(montarNavegacao('erp', ['inicio', 'pagamentos', 'atendimento', 'mais'], 'inicio').modulosMais).toEqual(['pagamentos', 'atendimento', 'conta']);
    expect(montarNavegacao('erp', ['inicio', 'pagamentos', 'mais'], 'inicio').modulosMais).not.toContain('atendimento');
    expect(NAV_PADRAO.modulosMais).not.toContain('atendimento');
  });
});

describe('demo da tela 41 (imita o ERP PR 18)', () => {
  afterEach(() => { demo.definirCanalAtendimento(true); demo.definirAjustes(); });
  const lista = () => demo.chamar<ListaAtendimento>('GET', '/api/app/atendimento?pagina=1');
  const enviar = (id: number, texto: string, chave = novaChave()) =>
    demo.chamar<{ mensagem: { texto: string; de: string } }>('POST', `/api/app/atendimento/${id}/mensagens`, { texto, modelo: null, anexo: null }, { 'Idempotency-Key': chave });
  const atalho = (id: number, tipo: string, ref_id: number) =>
    demo.chamar<{ mensagem: { texto: string } }>('POST', `/api/app/atendimento/${id}/atalho`, { tipo, ref_id }, { 'Idempotency-Key': novaChave() });

  it('canal desligado: área some de /inicio e a lista vem vazia', async () => {
    await demo.entrar('demo', '1234');
    expect((await demo.chamar<PainelInicio>('GET', '/api/app/inicio')).areas).toContain('atendimento');
    demo.definirCanalAtendimento(false);
    expect((await demo.chamar<PainelInicio>('GET', '/api/app/inicio')).areas).not.toContain('atendimento');
    expect(await lista()).toMatchObject({ canal: { ligado: false, numero: null }, conversas: [] });
  });

  it('envio sem consentimento fora da janela é recusado no servidor; dentro da janela passa', async () => {
    const cs = (await lista()).conversas;
    const travada = cs.find((c) => !c.consentimento && !c.janela_aberta_ate)!;
    const janela = cs.find((c) => !c.consentimento && c.janela_aberta_ate && c.contato.id !== null)!;
    expect(bloqueioDoEnvio(travada, true)).toBe(MSG_SEM_CONSENTIMENTO);
    await expect(enviar(travada.id, 'Promoção!')).rejects.toMatchObject({ status: 422, codigo: 'sem_consentimento' });
    expect((await enviar(janela.id, 'Fica pronto amanhã.')).mensagem).toMatchObject({ de: 'eu', texto: 'Fica pronto amanhã.' });
  });

  it('mesma chave não envia duas vezes; outro corpo com a mesma chave é conflito', async () => {
    const id = (await lista()).conversas[0].id;
    const chave = novaChave();
    await enviar(id, 'Olá', chave);
    await enviar(id, 'Olá', chave);
    const d = await demo.chamar<DetalheAtendimento>('GET', `/api/app/atendimento/${id}`);
    expect(d.mensagens.filter((m) => m.texto === 'Olá')).toHaveLength(1);
    await expect(enviar(id, 'Outro', chave)).rejects.toMatchObject({ status: 422, codigo: 'idempotencia_conflito' });
    await expect(demo.chamar('POST', `/api/app/atendimento/${id}/mensagens`, { texto: 'x' })).rejects.toMatchObject({ status: 422, codigo: 'validacao' });
  });

  it('atalhos: o ERP monta o texto do registro do cliente; de outro cliente = 404; ajuste desligado = 403', async () => {
    const bistro = (await lista()).conversas.find((c) => c.contato.nome === 'Bistrô do Forno')!;
    expect((await atalho(bistro.id, 'orcamento', 201)).mensagem.texto).toBe('Orçamento #ORC-0118: total R$ 3.840,00.');
    expect((await atalho(bistro.id, 'status_pedido', 108)).mensagem.texto).toBe('Seu pedido #0045 está em Em espera.');
    expect((await atalho(bistro.id, 'link_arte', 501)).mensagem.texto).toBe('Arte do pedido OP-0045: https://oimpresso.com/a/0045');
    await expect(atalho(bistro.id, 'orcamento', 205)).rejects.toMatchObject({ status: 404, codigo: 'nao_encontrado' });
    demo.definirAjustes({ app_atendimento_atalhos: false });
    await expect(atalho(bistro.id, 'orcamento', 201)).rejects.toMatchObject({ status: 403, codigo: 'sem_permissao' });
  });
});
