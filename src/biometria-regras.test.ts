import { describe, expect, it } from 'vitest';
import { aposTentativa, DESTRAVAR_INICIAL, MAX_FALHAS_BIOMETRIA, ofereceBiometria, resultadoDoErro, type ResultadoBiometria } from './biometria-regras';

const tentar = (...rs: ResultadoBiometria[]) => rs.reduce(aposTentativa, DESTRAVAR_INICIAL);

describe('três falhas → senha (P9)', () => {
  it('são três', () => expect(MAX_FALHAS_BIOMETRIA).toBe(3));

  it('a primeira e a segunda falha deixam tentar de novo, contando o que resta', () => {
    expect(tentar('falhou')).toEqual({ falhas: 1, pedeSenha: false, mensagem: 'Não reconhecida. Restam 2 tentativas.' });
    expect(tentar('falhou', 'falhou')).toEqual({ falhas: 2, pedeSenha: false, mensagem: 'Não reconhecida. Resta 1 tentativa.' });
  });

  it('a terceira falha seguida pede a senha', () => {
    const e = tentar('falhou', 'falhou', 'falhou');
    expect(e.pedeSenha).toBe(true);
    expect(e.mensagem).toBe('A biometria falhou 3 vezes. Entre com a senha.');
  });

  it('cancelar não conta como falha e não tira a opção', () => {
    expect(tentar('falhou', 'cancelou', 'falhou')).toMatchObject({ falhas: 2, pedeSenha: false });
    expect(tentar('cancelou', 'cancelou', 'cancelou', 'cancelou')).toEqual(DESTRAVAR_INICIAL);
  });

  it('depois de pedir a senha, nada volta para a biometria', () => {
    expect(tentar('falhou', 'falhou', 'falhou', 'ok', 'falhou').falhas).toBe(3);
    expect(tentar('falhou', 'falhou', 'falhou', 'cancelou').pedeSenha).toBe(true);
  });

  it('celular bloqueado ou sem biometria vai direto para a senha', () => {
    expect(tentar('bloqueado')).toMatchObject({ pedeSenha: true, falhas: 0 });
    expect(tentar('falhou', 'indisponivel')).toMatchObject({ pedeSenha: true, falhas: 1 });
  });

  it('acerto não mexe no estado (o app entra)', () => {
    expect(tentar('falhou', 'ok')).toEqual(tentar('falhou'));
  });
});

describe('erro do plugin → resultado', () => {
  it('traduz os códigos do BiometricAuthError', () => {
    expect(resultadoDoErro(10)).toBe('falhou');
    expect(resultadoDoErro('10')).toBe('falhou');
    expect(resultadoDoErro(16)).toBe('cancelou');
    expect(resultadoDoErro(17)).toBe('cancelou');
    expect(resultadoDoErro(2)).toBe('bloqueado');
    expect(resultadoDoErro(4)).toBe('bloqueado');
    expect(resultadoDoErro(3)).toBe('indisponivel');
    expect(resultadoDoErro(14)).toBe('indisponivel');
  });

  it('código desconhecido conta como falha (nunca destrava)', () => {
    expect(resultadoDoErro(undefined)).toBe('falhou');
    expect(resultadoDoErro(0)).toBe('falhou');
  });
});

describe('opção em Conta', () => {
  it('só aparece com o ajuste da empresa ligado e biometria no celular', () => {
    expect(ofereceBiometria(true, true)).toBe(true);
    expect(ofereceBiometria(false, true)).toBe(false);
    expect(ofereceBiometria(true, false)).toBe(false);
  });
});
