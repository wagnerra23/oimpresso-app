// Marcações a validar — desenho v4 (tela 39), D16 Onda E. Visão do gestor. Decisão [W] 2026-10-02: só as
// marcações FORA DO GEOFENCE (as justificativas da tela 38 ficam para outra tela).
// Portaria 671/2021: a marcação é append-only. "Validar" aceita; "Recusar" pede ao servidor que grave uma
// ANULAÇÃO nova — o app nunca edita nem apaga marcação. Recusar é irreversível, então pede confirmação
// (o protótipo recusa no primeiro toque; o segundo toque é proteção contra toque acidental).
// Rotas /api/app/ponto/aprovacoes: FORMATO PROPOSTO, ainda sem PR no ERP — ver ListaValidacao em api.ts.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type EstadoValidacao, type FiltroValidacao, type ListaValidacao } from '../api';
import { rotuloTipo } from '../ponto-regras';
import { useVoltar } from '../voltar';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

const FILTROS: Array<{ id: FiltroValidacao; label: string }> = [
  { id: 'pendente', label: 'A validar' }, { id: 'validada', label: 'Validadas' },
  { id: 'recusada', label: 'Recusadas' }, { id: 'todas', label: 'Todas' },
];
const ESTADO: Record<EstadoValidacao, { label: string; cor: string }> = {
  pendente: { label: 'A validar', cor: 'var(--warn)' },
  validada: { label: 'Validada', cor: 'var(--ok)' },
  recusada: { label: 'Recusada', cor: 'var(--danger)' },
};
const quando = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Aplica a decisão que o servidor confirmou: muda o estado, acerta os contadores e tira o item do filtro
 *  que não o mostra mais. Item desconhecido ou já decidido: devolve a mesma lista. */
export function aplicarDecisao(l: ListaValidacao, id: number, novo: Exclude<EstadoValidacao, 'pendente'>, filtro: FiltroValidacao): ListaValidacao {
  const item = l.itens.find((x) => x.id === id);
  if (!item || item.estado !== 'pendente') return l;
  const itens = l.itens.map((x) => (x.id === id ? { ...x, estado: novo } : x)).filter((x) => filtro === 'todas' || x.estado === filtro);
  const contadores = { ...l.contadores, pendente: l.contadores.pendente - 1, [novo]: l.contadores[novo] + 1 };
  return { itens, contadores };
}

export function FilaGestor({ avisar, voltar }: { avisar: Aviso; voltar?: ReactNode }) {
  const [filtro, setFiltro] = useState<FiltroValidacao>('pendente');
  const [dados, setDados] = useState<ListaValidacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [enviando, setEnviando] = useState<number | null>(null);

  const carregar = useCallback(async (f: FiltroValidacao) => {
    setDados(null); setErro(null); setConfirmar(null);
    try { setDados(await api.marcacoesAValidar(f)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não pode validar marcações.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(filtro); }, [filtro, carregar]);

  // Voltar do Android com a confirmação aberta só fecha a confirmação.
  useVoltar(confirmar !== null, () => setConfirmar(null));

  const decidir = async (id: number, nsr: number, acao: 'validar' | 'recusar') => {
    if (enviando !== null) return;
    setEnviando(id);
    try {
      if (acao === 'validar') {
        await api.validarMarcacao(id);
        setDados((d) => (d ? aplicarDecisao(d, id, 'validada', filtro) : d));
        avisar(`Marcação NSR ${nsr} validada.`);
      } else {
        const r = await api.recusarMarcacao(id);
        setDados((d) => (d ? aplicarDecisao(d, id, 'recusada', filtro) : d));
        avisar(`Anulação gravada (NSR ${r.nsr_anulacao}). A marcação ${nsr} continua no registro.`);
      }
      setConfirmar(null);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível salvar.', 'erro');
      // Outro gestor pode ter decidido antes: recarrega para mostrar o estado real.
      if (e instanceof ErroApi && (e.status === 404 || e.status === 409)) carregar(filtro);
    } finally { setEnviando(null); }
  };

  const c = dados?.contadores;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{c ? `${c.pendente} ${c.pendente === 1 ? 'pendente' : 'pendentes'} · últimos 7 dias` : 'Ponto · gestor'}</div>
            <div className="pd-titulo">Marcações a validar</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="pd-chips" role="tablist" aria-label="Situação da marcação">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          <div className="fg-info" role="note">
            <b>Por que uma fila</b>
            <span>Fora da área, a marcação não é recusada: entra aqui para revisão. Recusar grava uma anulação; a original continua imutável.</span>
          </div>
          {erro && (
            <div className="p4-vazio">
              <b>Não foi possível carregar</b><span>{erro}</span>
              <button className="oi-btn" style={{ minHeight: 44 }} onClick={() => carregar(filtro)}>Tentar de novo</button>
            </div>
          )}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio">
              <b>{filtro === 'pendente' ? 'Nada a validar' : 'Nenhuma marcação aqui'}</b>
              <span>{filtro === 'pendente' ? 'Todas as marcações fora da área foram revisadas.' : 'Troque o filtro para ver outras marcações.'}</span>
            </div>
          )}
          {dados?.itens.map((m) => {
            const e = ESTADO[m.estado];
            const ocupado = enviando === m.id;
            return (
              <article key={m.id} className="fg-card" aria-label={`${m.colaborador_nome}, ${rotuloTipo(m.tipo)}, NSR ${m.nsr}`}>
                <div className="fg-l1">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{m.colaborador_nome} · {rotuloTipo(m.tipo)}</b>
                    {m.local_texto && <small>{m.local_texto}</small>}
                  </div>
                  <span className="fg-estado" style={{ color: e.cor }}><i style={{ background: e.cor }} aria-hidden="true" />{e.label}</span>
                </div>
                <div className="fg-meta">
                  <span>{quando(m.marcada_em)}</span><span>NSR {m.nsr}</span>
                  <span className={m.gps_precisao_m > 300 ? 'fg-gps ruim' : 'fg-gps'}>GPS ±{m.gps_precisao_m}m</span>
                  {m.dispositivo && <span>{m.dispositivo}</span>}<span>#{m.hash_curto}</span>
                </div>
                {m.estado === 'recusada' && <p className="fg-anulada">Anulação gravada. A marcação original continua no registro.</p>}
                {m.estado === 'pendente' && confirmar !== m.id && (
                  <div className="fg-acoes">
                    <button className="fg-recusar" disabled={ocupado} onClick={() => setConfirmar(m.id)}>Recusar</button>
                    <button className="oi-btn primary" disabled={ocupado} onClick={() => decidir(m.id, m.nsr, 'validar')}>{ocupado ? 'Salvando…' : 'Validar'}</button>
                  </div>
                )}
                {m.estado === 'pendente' && confirmar === m.id && (
                  <div className="fg-confirma" role="alertdialog" aria-label="Confirmar recusa">
                    <span>Recusar grava uma anulação da marcação NSR {m.nsr}. Não dá para desfazer pelo app.</span>
                    <div className="fg-acoes">
                      <button className="oi-btn" disabled={ocupado} onClick={() => setConfirmar(null)}>Cancelar</button>
                      <button className="oi-btn danger" disabled={ocupado} onClick={() => decidir(m.id, m.nsr, 'recusar')}>{ocupado ? 'Gravando…' : 'Gravar anulação'}</button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {dados && <p className="p4-legal">Visão do gestor. Precisão de GPS acima de 500 m é recusada no servidor e nem chega aqui.</p>}
        </div>
      </div>
    </>
  );
}
