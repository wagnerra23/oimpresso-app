import { describe, expect, it } from 'vitest';
import { horaDe, rotuloDia, situacaoAgendamento, somarDias } from './Agenda';
import { errosAgendamento } from './NovoAgendamento';
import { veiculoDoAgendamento } from './OrdensServico';

describe('Agenda da Oficina — dias', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(somarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(somarDias('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('rótulo: hoje, amanhã, ontem e dia da semana', () => {
    expect(rotuloDia('2026-10-06', '2026-10-06')).toBe('Hoje');
    expect(rotuloDia('2026-10-07', '2026-10-06')).toBe('Amanhã');
    expect(rotuloDia('2026-10-05', '2026-10-06')).toBe('Ontem');
    expect(rotuloDia('2026-10-08', '2026-10-06')).toBe('qui, 08/10');
  });
  it('hora do início', () => {
    expect(horaDe('2026-10-06T08:30')).toBe('08:30');
  });
});

describe('Agenda da Oficina — situação', () => {
  it('agendado, atendido com a OS, cancelado', () => {
    expect(situacaoAgendamento({ status: 'agendado', os_id: null })).toEqual({ texto: 'Agendado', tom: 'warn' });
    expect(situacaoAgendamento({ status: 'atendido', os_id: 1046 })).toEqual({ texto: 'Atendido · OS-01046', tom: 'ok' });
    expect(situacaoAgendamento({ status: 'cancelado', os_id: null }).texto).toBe('Cancelado');
  });
});

describe('Agendar revisão — conferência antes de enviar', () => {
  const v = { id: 1, placa: 'RLV2E48', placa_secundaria: null, descricao: 'Picape', ano: null, cliente: null, km: null, cor: null };
  it('veículo, dia e hora obrigatórios', () => {
    expect(errosAgendamento(null, { dia: '', hora: '', obs: '' }, '2026-10-06')).toEqual({ vehicle_id: 'Escolha o veículo.', inicio: 'Escolha o dia.' });
    expect(errosAgendamento(v, { dia: '2026-10-06', hora: '', obs: '' }, '2026-10-06')).toEqual({ inicio: 'Escolha a hora.' });
  });
  it('dia passado não; o próprio dia vale em qualquer hora', () => {
    expect(errosAgendamento(v, { dia: '2026-10-05', hora: '08:00', obs: '' }, '2026-10-06')).toEqual({ inicio: 'Escolha hoje ou um dia futuro.' });
    expect(errosAgendamento(v, { dia: '2026-10-06', hora: '06:00', obs: '' }, '2026-10-06')).toEqual({});
  });
});

describe('Abrir OS do agendamento', () => {
  it('o veículo vai para a Nova OS com o cliente do agendamento como dono sugerido', () => {
    const vr = veiculoDoAgendamento({ id: 9, inicio: '2026-10-06T08:00', veiculo: { id: 3, placa: 'MLK4109', descricao: 'Furgão' },
      cliente: { id: 102, nome: 'Mercado Bom Preço' }, observacao: 'x', status: 'agendado', os_id: null });
    expect([vr.id, vr.placa, vr.descricao, vr.cliente_id, vr.cliente]).toEqual([3, 'MLK4109', 'Furgão', 102, 'Mercado Bom Preço']);
  });
});
