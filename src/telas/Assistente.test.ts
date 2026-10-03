// Tela 25: quando dá para enviar e como a hora aparece na bolha.
import { describe, expect, it } from 'vitest';
import { horaCurta, mensagemDeErro, podeEnviar } from './Assistente';
import { ErroApi } from '../api';

describe('podeEnviar (tela 25)', () => {
  it('envia texto com conteúdo, online e sem resposta pendente', () => expect(podeEnviar('Oi', false, true)).toBe(true));
  it('não envia só espaços', () => expect(podeEnviar('   ', false, true)).toBe(false));
  it('não envia enquanto espera a resposta da Jana', () => expect(podeEnviar('Oi', true, true)).toBe(false));
  it('não envia sem internet', () => expect(podeEnviar('Oi', false, false)).toBe(false));
});

describe('horaCurta', () => {
  it('formata HH:MM no fuso do aparelho', () => {
    const d = new Date(2026, 9, 2, 9, 5);
    expect(horaCurta(d.toISOString())).toBe('09:05');
  });
  it('data inválida não mostra hora', () => expect(horaCurta('')).toBe(''));
});

describe('mensagemDeErro (tela 25)', () => {
  it('429 do Laravel (em inglês) vira aviso em PT-BR', () =>
    expect(mensagemDeErro(new ErroApi(429, 'erro', 'Too Many Attempts.'))).toBe('Muitas mensagens em pouco tempo. Espere um minuto e tente de novo.'));
  it('sem permissão', () => expect(mensagemDeErro(new ErroApi(403, 'sem_permissao', 'x'))).toBe('Seu usuário não tem acesso ao assistente.'));
  it('conversa sumiu', () => expect(mensagemDeErro(new ErroApi(404, 'nao_encontrado', 'x'))).toBe('Esta conversa não está mais disponível. Comece outra.'));
  it('outros erros usam a mensagem do servidor', () => expect(mensagemDeErro(new ErroApi(422, 'validacao', 'Mensagem muito longa.'))).toBe('Mensagem muito longa.'));
});
