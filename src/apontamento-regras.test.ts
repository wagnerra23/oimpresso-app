// Regras puras do apontamento por QR (P8, tela 02).
import { describe, expect, it } from 'vitest';
import {
  codigoDoQr, duracao, erroMotivo, m2Digitado, mensagemDoErro, motivoBloqueio, numeroDigitado, relogio, segundosDecorridos,
} from './apontamento-regras';

describe('apontamento — leitura da etiqueta', () => {
  it('aceita só o QR de produção do oimpresso (hash de 12 hex + id)', () => {
    expect(codigoDoQr('oimpresso:p:a1b2c3d4e5f6:4812')).toBe('oimpresso:p:a1b2c3d4e5f6:4812');
    expect(codigoDoQr('  OIMPRESSO:P:A1B2C3D4E5F6:4812\n')).toBe('oimpresso:p:a1b2c3d4e5f6:4812');
    expect(codigoDoQr('oimpresso:p:a1b2c3:4812')).toBeNull();
    expect(codigoDoQr('oimpresso:p:a1b2c3d4e5f6:0')).toBeNull();
    expect(codigoDoQr('https://oimpresso.com/os/4812')).toBeNull();
    expect(codigoDoQr('4812')).toBeNull();
  });
  it('número digitado: id ou OS-AAAA-NNNNN', () => {
    expect(numeroDigitado('4812')).toBe('4812');
    expect(numeroDigitado(' os-2026-00012 ')).toBe('OS-2026-00012');
    expect(numeroDigitado('')).toBeNull();
    expect(numeroDigitado('0')).toBeNull();
    expect(numeroDigitado('48a12')).toBeNull();
  });
});

describe('apontamento — cronômetro (tempo do servidor)', () => {
  const inicio = '2026-10-15T12:00:00Z';
  const t = Date.parse(inicio);
  it('conta a partir do iniciado_em do servidor', () => {
    expect(segundosDecorridos(inicio, t + 3725_000, 0)).toBe(3725);
    expect(segundosDecorridos(inicio, t + 3725_000, null)).toBe(3725);
  });
  it('desconta o relógio adiantado ou atrasado do aparelho', () => {
    // Aparelho 90 s adiantado: o relógio local mostra 90 s a mais, a conta tira.
    expect(segundosDecorridos(inicio, t + 600_000 + 90_000, 90)).toBe(600);
    expect(segundosDecorridos(inicio, t + 600_000 - 30_000, -30)).toBe(600);
  });
  it('nunca fica negativo e ignora data inválida', () => {
    expect(segundosDecorridos(inicio, t - 5000, 0)).toBe(0);
    expect(segundosDecorridos('ontem', t, 0)).toBe(0);
  });
  it('formata HH:MM:SS e a duração do ERP', () => {
    expect(relogio(0)).toBe('00:00:00');
    expect(relogio(3725)).toBe('01:02:05');
    expect(relogio(100 * 3600)).toBe('100:00:00');
    expect(duracao(0)).toBe('menos de 1 min');
    expect(duracao(12)).toBe('12 min');
    expect(duracao(65)).toBe('1 h 05 min');
  });
});

describe('apontamento — campos e trava', () => {
  it('motivo do cancelamento: 5 a 500 letras', () => {
    expect(erroMotivo('erro')).toMatch(/pelo menos 5/);
    expect(erroMotivo('   abcd   ')).toMatch(/pelo menos 5/);
    expect(erroMotivo('Pedido errado')).toBeNull();
    expect(erroMotivo('x'.repeat(501))).toMatch(/até 500/);
  });
  it('m² produzido vira texto com ponto e 3 casas; vazio é opcional', () => {
    expect(m2Digitado('4,5')).toBe('4.500');
    expect(m2Digitado('4.5')).toBe('4.500');
    expect(m2Digitado('12')).toBe('12.000');
    expect(m2Digitado('0,125')).toBe('0.125');
    expect(m2Digitado('  ')).toBeNull();
    expect(m2Digitado('4,5678')).toBe('invalido');
    expect(m2Digitado('-1')).toBe('invalido');
    expect(m2Digitado('1.000,5')).toBe('invalido');
  });
  it('sem internet a escrita trava, sem fila (regra 8)', () => {
    expect(motivoBloqueio(true)).toBeNull();
    expect(motivoBloqueio(false)).toMatch(/Sem conexão/);
  });
  it('traduz os erros do contrato', () => {
    const erro = (status: number, codigo: string, msg = '') => Object.assign(new Error(msg), { status, codigo });
    expect(mensagemDoErro(erro(404, 'nao_encontrado'))).toMatch(/não encontrada/);
    expect(mensagemDoErro(erro(403, 'sem_permissao'))).toMatch(/não pode apontar/);
    expect(mensagemDoErro(erro(409, 'etapa_mudou'))).toMatch(/etapa/);
    expect(mensagemDoErro(erro(422, 'bloqueado', 'Esta OS já foi encerrada.'))).toBe('Esta OS já foi encerrada.');
    expect(mensagemDoErro(erro(429, 'erro'))).toMatch(/Espere/);
    expect(mensagemDoErro(erro(0, 'rede'))).toMatch(/duas vezes/);
    expect(mensagemDoErro(erro(503, 'indisponivel'))).toMatch(/duas vezes/);
  });
});
