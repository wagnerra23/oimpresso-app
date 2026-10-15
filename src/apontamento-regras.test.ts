// Regras puras do apontamento por QR (P8, tela 02).
import { describe, expect, it } from 'vitest';
import {
  codigoDoQr, duracao, erroJustificativa, horaDe, horaNoDia, mensagemDoErro, numeroDigitado, relogio, segundosDecorridos,
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

describe('apontamento — campos e erros', () => {
  it('justificativa da correção: 5 a 500 letras', () => {
    expect(erroJustificativa('erro')).toMatch(/pelo menos 5/);
    expect(erroJustificativa('   abcd   ')).toMatch(/pelo menos 5/);
    expect(erroJustificativa('Comecei às 8h')).toBeNull();
    expect(erroJustificativa('x'.repeat(501))).toMatch(/até 500/);
  });
  it('hora certa "HH:MM" no dia do início', () => {
    const d = horaNoDia('08:15', '2026-10-15T14:03:00-03:00')!;
    expect(horaDe(d.toISOString())).toBe('08:15');
    expect(horaNoDia('25:00', '2026-10-15T14:03:00-03:00')).toBeNull();
    expect(horaNoDia('8h', '2026-10-15T14:03:00-03:00')).toBeNull();
  });
  it('traduz os erros do contrato', () => {
    const erro = (status: number, codigo: string, msg = '', extra = {}) => Object.assign(new Error(msg), { status, codigo, ...extra });
    expect(mensagemDoErro(erro(404, 'nao_encontrado'))).toMatch(/não encontrada/);
    expect(mensagemDoErro(erro(403, 'sem_permissao'))).toMatch(/não pode apontar/);
    expect(mensagemDoErro(erro(409, 'etapa_alheia', 'Esta etapa está em Laminação, com Felipe.'))).toBe('Esta etapa está em Laminação, com Felipe.');
    expect(mensagemDoErro(erro(409, 'em_andamento'))).toMatch(/Conclua a anterior/);
    expect(mensagemDoErro(erro(422, 'bloqueado', 'Esta etapa já foi concluída.'))).toBe('Esta etapa já foi concluída.');
    expect(mensagemDoErro(erro(422, 'validacao', 'Confira', { campos: { momento: 'Envio vencido; peça a correção ao gestor' } }))).toBe('Envio vencido; peça a correção ao gestor');
    expect(mensagemDoErro(erro(429, 'erro'))).toMatch(/Espere/);
    expect(mensagemDoErro(erro(0, 'rede'))).toMatch(/Sem conexão/);
    expect(mensagemDoErro(erro(503, 'indisponivel'))).toMatch(/ERP/);
  });
});
