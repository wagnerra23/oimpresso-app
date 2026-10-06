// Agenda da Oficina — agendamento de revisão (decisões [W] 2026-10-06): veículo + cliente + dia e hora + observação;
// na chegada, "Abrir OS" abre a Nova OS preenchida e o ERP marca o agendamento como atendido, ligado à OS. Aba da
// Oficina, ao lado das OS e dos Veículos. Rotas do ERP #8784 (GET/POST /api/app/agendamentos e /cancelar),
// ligadas por AGENDA_OFICINA. Agendar não gera valor, estoque nem cobrança, e não avisa o cliente.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AGENDA_OFICINA, api, ErroApi, NOVA_OS, type Agendamento, type ListaAgendamentos } from '../api';
import { Placa } from './Veiculos';

/** Dia no fuso do aparelho, "AAAA-MM-DD". */
export function diaLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Soma dias a um "AAAA-MM-DD" (meio-dia, para não tropeçar no horário de verão). */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return diaLocal(new Date(a, m - 1, d + n, 12));
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "Hoje" / "Amanhã" / "Ontem" ou "qua, 08/10". */
export function rotuloDia(dia: string, hoje: string): string {
  if (dia === hoje) return 'Hoje';
  if (dia === somarDias(hoje, 1)) return 'Amanhã';
  if (dia === somarDias(hoje, -1)) return 'Ontem';
  const [a, m, d] = dia.split('-').map(Number);
  return `${SEMANA[new Date(a, m - 1, d, 12).getDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** "08:30" de "AAAA-MM-DDTHH:MM…". */
export const horaDe = (inicio: string): string => inicio.slice(11, 16);

/** Situação do agendamento: rótulo e tom da pílula. */
export function situacaoAgendamento(a: Pick<Agendamento, 'status' | 'os_id'>): { texto: string; tom: string } {
  if (a.status === 'atendido') return { texto: a.os_id ? `Atendido · OS-${String(a.os_id).padStart(5, '0')}` : 'Atendido', tom: 'ok' };
  if (a.status === 'cancelado') return { texto: 'Cancelado', tom: '' };
  return { texto: 'Agendado', tom: 'warn' };
}

interface Props {
  voltar?: ReactNode; abas: ReactNode;
  aoAgendar: (dia: string) => void;
  aoAbrirOs: (a: Agendamento) => void;
  aoVerOs: (id: number) => void;
  avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  /** Dia mostrado ao abrir (ex.: o dia do agendamento recém-criado). */
  diaInicial?: string;
}

export function Agenda({ voltar, abas, aoAgendar, aoAbrirOs, aoVerOs, avisar, diaInicial }: Props) {
  const hoje = diaLocal(new Date());
  const [dia, setDia] = useState(diaInicial ?? hoje);
  const [dados, setDados] = useState<ListaAgendamentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Agendamento | null>(null);
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async (d: string) => {
    setDados(null); setErro(null);
    try { setDados(await api.agendamentos(d, d)); }
    catch (e) { setErro(e instanceof ErroApi && e.status === 403 ? 'Seu usuário não tem acesso à agenda da oficina.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(dia); }, [dia, carregar]);

  const cancelar = async () => {
    if (!cancelando) return;
    setEnviando(true);
    try {
      await api.cancelarAgendamento(cancelando.id, motivo.trim() || null);
      avisar?.(`Agendamento de ${cancelando.veiculo.placa} cancelado`);
      setCancelando(null); setMotivo('');
      carregar(dia);
    } catch (e) {
      avisar?.(e instanceof Error && e.message ? e.message : 'Não foi possível cancelar.', 'erro');
      // Já atendido ou cancelado por outra pessoa (422 estado_invalido): a lista se atualiza.
      setCancelando(null); carregar(dia);
    } finally { setEnviando(false); }
  };

  const qtd = dados?.itens.filter((a) => a.status === 'agendado').length ?? 0;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{dados ? `${qtd} ${qtd === 1 ? 'agendado' : 'agendados'}` : 'Oficina'}</div>
            <div className="pd-titulo">Agenda</div>
          </div>
          {AGENDA_OFICINA && dados?.pode_criar && <button className="oi-btn primary nos-nova" onClick={() => aoAgendar(dia)}>+ Agendar</button>}
        </div>
        {abas}
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="age-dia" role="group" aria-label="Dia da agenda">
            <button className="oi-btn age-seta" aria-label="Dia anterior" onClick={() => setDia(somarDias(dia, -1))}>‹</button>
            <button className="age-rotulo" onClick={() => setDia(hoje)} aria-label={dia === hoje ? 'Hoje' : 'Voltar para hoje'}>
              <b>{rotuloDia(dia, hoje)}</b><small>{dia.slice(8, 10)}/{dia.slice(5, 7)}/{dia.slice(0, 4)}</small>
            </button>
            <button className="oi-btn age-seta" aria-label="Próximo dia" onClick={() => setDia(somarDias(dia, 1))}>›</button>
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><b>Nenhum agendamento</b><span>Os veículos agendados para este dia aparecem aqui.</span></div>
          )}
          {dados?.itens.map((a) => {
            const s = situacaoAgendamento(a);
            return (
              <div key={a.id} className={'pd-card age-card' + (a.status === 'cancelado' ? ' cancelado' : '')}>
                <div className="age-topo">
                  <span className="age-hora">{horaDe(a.inicio)}</span>
                  <Placa placa={a.veiculo.placa} />
                  <span className="os-texto">
                    <b>{a.veiculo.descricao ?? 'Veículo'}</b>
                    <small>{a.cliente?.nome ?? 'Sem cliente'}</small>
                  </span>
                </div>
                {a.observacao && <p className="age-obs">{a.observacao}</p>}
                <div className="age-pe">
                  {a.status === 'atendido' && a.os_id
                    ? <button className={'p4-pill age-pill ' + s.tom} onClick={() => aoVerOs(a.os_id!)}>{s.texto}</button>
                    : <span className={'p4-pill age-pill ' + s.tom}>{s.texto}</span>}
                  {a.status === 'agendado' && AGENDA_OFICINA && (
                    <span className="age-bts">
                      <button className="nos-link" onClick={() => { setMotivo(''); setCancelando(a); }}>Cancelar</button>
                      {NOVA_OS && <button className="oi-btn primary age-abrir" onClick={() => aoAbrirOs(a)}>Abrir OS</button>}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {cancelando && (
        <div className="oi-sheet-backdrop" onClick={() => !enviando && setCancelando(null)}>
          <div className="oi-sheet" role="dialog" aria-modal="true" aria-labelledby="age-canc-t" onClick={(e) => e.stopPropagation()}>
            <div className="oi-sheet-grip" />
            <div className="oi-sheet-h"><b id="age-canc-t">Cancelar o agendamento?</b></div>
            <div className="osd-folha">
              <p className="osd-conf">{cancelando.veiculo.placa} · {rotuloDia(cancelando.inicio.slice(0, 10), hoje)} às {horaDe(cancelando.inicio)}. O cliente não é avisado pelo app.</p>
              <div className="p4-campo">
                <label htmlFor="age-motivo">Motivo (opcional)</label>
                <textarea id="age-motivo" className="nos-obs" rows={2} maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: cliente remarcou" />
              </div>
              <div className="osd-conf-bts">
                <button className="oi-btn" disabled={enviando} onClick={() => setCancelando(null)}>Voltar</button>
                <button className="oi-btn osd-perigo" disabled={enviando} onClick={cancelar}>{enviando ? 'Cancelando…' : 'Cancelar agendamento'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
