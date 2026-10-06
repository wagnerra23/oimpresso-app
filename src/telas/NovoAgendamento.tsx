// Novo agendamento de revisão — abre pelo "+ Agendar" da Agenda e pelo "Agendar revisão" do cartão do veículo.
// Veículo + cliente (sugerido do dono) + dia e hora + observação (decisão [W] 2026-10-06). Rota
// POST /api/app/agendamentos (ERP #8784), ligada por AGENDA_OFICINA. Não avisa o cliente.
import { useState } from 'react';
import { api, camposDoErro, ErroApi, type Agendamento, type VeiculoResumo } from '../api';
import { useVoltar } from '../voltar';
import { BuscaCliente, BuscaVeiculo, textoOuNulo, type Cliente } from './NovaOs';
import { Placa } from './Veiculos';
import { diaLocal } from './Agenda';

export interface FormAgendamento { dia: string; hora: string; obs: string }

/** Confere antes de enviar: veículo, dia e hora obrigatórios; hora no formato HH:MM; dia passado não (o ERP recusa;
 *  o próprio dia vale, em qualquer hora). */
export function errosAgendamento(veiculo: VeiculoResumo | null, f: FormAgendamento, hoje: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!veiculo) e.vehicle_id = 'Escolha o veículo.';
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(f.dia)) e.inicio = 'Escolha o dia.';
  else if (f.dia < hoje) e.inicio = 'Escolha hoje ou um dia futuro.';
  else if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(f.hora)) e.inicio = 'Escolha a hora.';
  return e;
}

interface Props {
  aoVoltar: () => void; aoCriar: (a: Agendamento) => void;
  avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  /** Veículo já escolhido (vindo do cartão do veículo). */
  veiculoInicial?: VeiculoResumo | null;
  /** Dia sugerido (o dia aberto na Agenda). */
  diaInicial: string;
}

export function NovoAgendamento({ aoVoltar, aoCriar, avisar, veiculoInicial = null, diaInicial }: Props) {
  const [modo, setModo] = useState<'form' | 'veiculo' | 'cliente'>(veiculoInicial ? 'form' : 'veiculo');
  const [veiculo, setVeiculo] = useState<VeiculoResumo | null>(veiculoInicial);
  const [cliente, setCliente] = useState<Cliente>(veiculoInicial?.cliente_id && veiculoInicial.cliente ? { id: veiculoInicial.cliente_id, nome: veiculoInicial.cliente } : null);
  const [f, setF] = useState<FormAgendamento>({ dia: diaInicial, hora: '08:00', obs: '' });
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);

  useVoltar(modo !== 'form' && veiculo !== null, () => setModo('form'));

  const escolherVeiculo = (v: VeiculoResumo) => {
    setVeiculo(v);
    setCliente(v.cliente_id && v.cliente ? { id: v.cliente_id, nome: v.cliente } : null);
    setErros((e) => ({ ...e, vehicle_id: '' }));
    setModo('form');
  };

  const salvar = async () => {
    const e = errosAgendamento(veiculo, f, diaLocal(new Date()));
    if (Object.keys(e).length) { setErros(e); return; }
    setSalvando(true); setErros({});
    try {
      const a = await api.criarAgendamento({ vehicle_id: veiculo!.id, contact_id: cliente?.id ?? null, inicio: `${f.dia}T${f.hora}`, observacao: textoOuNulo(f.obs) });
      avisar?.(`${a.veiculo.placa} agendado às ${f.hora}`);
      aoCriar(a);
    } catch (x) {
      const campos = camposDoErro(x);
      setErros(campos);
      if (!Object.keys(campos).length) avisar?.(x instanceof ErroApi && x.status === 403 ? 'Seu usuário não pode agendar.'
        : x instanceof ErroApi && x.status === 503 ? 'A oficina ainda não está configurada nesta empresa.'
        : x instanceof Error ? x.message : 'Não foi possível agendar.', 'erro');
    } finally { setSalvando(false); }
  };

  if (modo === 'veiculo') return <BuscaVeiculo rotulo="Agendar" aoEscolher={escolherVeiculo} aoVoltar={veiculo ? () => setModo('form') : aoVoltar} />;
  if (modo === 'cliente') return <BuscaCliente rotulo="Agendar" aoEscolher={(c) => { setCliente(c); setModo('form'); }} aoVoltar={() => setModo('form')} />;

  const erro = (k: string) => erros[k] ? <span id={'age-e-' + k} className="np-erro">{erros[k]}</span> : null;
  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Cancelar e voltar">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">Agenda</div>
          <div className="pd-dtitulo">Agendar revisão</div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="p4-rotulo">Veículo</div>
          {veiculo ? (
            <button className="pd-cartao nos-escolha" onClick={() => setModo('veiculo')}>
              <Placa placa={veiculo.placa} />
              <span className="os-texto"><b>{veiculo.descricao ?? 'Veículo'}</b><small>{veiculo.cliente ?? 'Sem dono cadastrado'}</small></span>
              <span className="nos-trocar">Trocar</span>
            </button>
          ) : <button className="oi-btn block" style={{ minHeight: 44 }} onClick={() => setModo('veiculo')}>Escolher veículo</button>}
          {erro('vehicle_id')}

          <div className="p4-rotulo">Cliente</div>
          <div className="pd-cartao nos-escolha nos-cliente">
            <span className="os-texto">
              <b>{cliente?.nome ?? 'Sem cliente'}</b>
              <small>{cliente && veiculo?.cliente_id === cliente.id ? 'Dono do veículo' : cliente ? 'Outro cliente' : 'Sem cliente no agendamento'}</small>
            </span>
            <span className="nos-bts">
              <button className="nos-link" onClick={() => setModo('cliente')}>Trocar</button>
              {cliente && <button className="nos-link" onClick={() => setCliente(null)}>Tirar</button>}
            </span>
          </div>
          {erro('contact_id')}

          <div className="nve-dupla">
            <div className="p4-campo">
              <label htmlFor="age-dia">Dia</label>
              <input id="age-dia" type="date" min={diaLocal(new Date())} value={f.dia} onChange={(e) => setF((x) => ({ ...x, dia: e.target.value }))}
                aria-invalid={!!erros.inicio} aria-describedby={erros.inicio ? 'age-e-inicio' : undefined} />
            </div>
            <div className="p4-campo">
              <label htmlFor="age-hora">Hora</label>
              <input id="age-hora" type="time" step={900} value={f.hora} onChange={(e) => setF((x) => ({ ...x, hora: e.target.value }))}
                aria-invalid={!!erros.inicio} aria-describedby={erros.inicio ? 'age-e-inicio' : undefined} />
            </div>
          </div>
          {erro('inicio')}
          <div className="p4-campo">
            <label htmlFor="age-obs">Observação (opcional)</label>
            <textarea id="age-obs" className="nos-obs" rows={3} maxLength={500} value={f.obs} onChange={(e) => setF((x) => ({ ...x, obs: e.target.value }))} placeholder="Ex.: revisão 60 mil + freio" />
            {erro('observacao')}
          </div>
          <p className="np-ajuda">O cliente não é avisado pelo app. Quando o veículo chegar, use "Abrir OS" na agenda.</p>
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando} onClick={aoVoltar}>Cancelar</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando || !veiculo} onClick={salvar}>{salvando ? 'Agendando…' : 'Agendar'}</button>
      </div>
    </>
  );
}
