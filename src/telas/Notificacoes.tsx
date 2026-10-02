// Notificações — desenho v4 (tela 16), D16 Onda A. Abre pelo sino do Início. Rota GET
// /api/app/notificacoes, contrato §6.1 (ERP #8557). Tocar numa não lida marca como lida (na tela na hora;
// se o servidor recusar, volta a não lida com aviso) e, se houver destino, abre a área de origem.
// "Marcar todas como lidas" aparece quando há não lidas. Escrita: contrato §6.1 (ERP #8569).
import { useCallback, useEffect, useState } from 'react';
import { api, type DestinoNotificacao, type ListaNotificacoes, type Notificacao } from '../api';
import { haQuanto } from '../tempo';

const ORIGENS = ['OS', 'CRM', 'FIN', 'PNT', 'MFG', 'OFI'];

interface Props {
  aoVoltar: () => void; abrirDestino: (tipo: DestinoNotificacao, id: number | string | null) => void;
  avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  /** Avisa o Início para o ponto do sino acompanhar. */
  aoMudarNaoLidas?: (n: number) => void;
}

/** Lista com uma notificação marcada (ou desmarcada) e o contador ajustado. */
export function comLida(d: ListaNotificacoes, id: string, lida: boolean): ListaNotificacoes {
  const alvo = d.itens.find((x) => x.id === id);
  if (!alvo || alvo.lida === lida) return d;
  return { ...d, itens: d.itens.map((x) => (x.id === id ? { ...x, lida } : x)), nao_lidas: Math.max(0, d.nao_lidas + (lida ? -1 : 1)) };
}

export function Notificacoes({ aoVoltar, abrirDestino, avisar, aoMudarNaoLidas }: Props) {
  const [dados, setDados] = useState<ListaNotificacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setDados(await api.notificacoes()); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.notificacoes(dados.pagina + 1);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const tocar = (n: Notificacao) => {
    if (!n.lida && dados) {
      const otimista = comLida(dados, n.id, true);
      setDados(otimista);
      aoMudarNaoLidas?.(otimista.nao_lidas);
      api.marcarLida(n.id)
        .then((r) => { setDados((d) => (d ? { ...d, nao_lidas: r.nao_lidas } : d)); aoMudarNaoLidas?.(r.nao_lidas); })
        .catch(() => {
          setDados((d) => (d ? comLida(d, n.id, false) : d));
          aoMudarNaoLidas?.(otimista.nao_lidas + 1);
          avisar('Não foi possível marcar como lida.', 'erro');
        });
    }
    if (n.destino.tipo) abrirDestino(n.destino.tipo, n.destino.id);
  };

  const marcarTodas = async () => {
    setMarcandoTodas(true);
    try {
      const r = await api.marcarTodasLidas();
      setDados((d) => (d ? { ...d, itens: d.itens.map((x) => ({ ...x, lida: true })), nao_lidas: r.nao_lidas } : d));
      aoMudarNaoLidas?.(r.nao_lidas);
    } catch (e) { avisar(e instanceof Error ? e.message : 'Não foi possível marcar como lidas.', 'erro'); }
    finally { setMarcandoTodas(false); }
  };

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para o Início">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{dados ? (dados.nao_lidas ? `${dados.nao_lidas} ${dados.nao_lidas === 1 ? 'não lida' : 'não lidas'}` : 'Tudo lido') : 'Notificações'}</div>
          <div className="pd-dtitulo">Notificações</div>
        </div>
        {!!dados?.nao_lidas && (
          <button className="nt-todas" disabled={marcandoTodas} onClick={marcarTodas}>{marcandoTodas ? 'Marcando…' : 'Marcar todas como lidas'}</button>
        )}
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && <div className="p4-vazio"><b>Nenhuma notificação</b><span>Os avisos do sistema aparecem aqui.</span></div>}
          {dados && dados.itens.length > 0 && (
            <div className="p4-lista">
              {dados.itens.map((n) => {
                const o = n.origem.toUpperCase();
                const conhecida = ORIGENS.includes(o);
                const conteudo = (
                  <>
                    <span className="nt-origem" style={conhecida ? { background: `var(--origin-${o.toLowerCase()}-bg)`, color: `var(--origin-${o.toLowerCase()}-fg)` }
                      : { background: 'var(--bg-2)', color: 'var(--text-dim)' }}>{o}</span>
                    <span className="nt-texto">
                      <b>{n.titulo}</b>
                      {n.texto && <small>{n.texto}</small>}
                      <span>{haQuanto(n.quando)}</span>
                    </span>
                    <span className="nt-ponto" aria-hidden="true" />
                    {!n.lida && <span className="sr-only">Não lida.</span>}
                  </>
                );
                // Toca quem tem destino ou ainda não foi lida (tocar marca como lida).
                return n.destino.tipo || !n.lida
                  ? <button key={n.id} className={'nt-linha' + (n.lida ? '' : ' nova')} onClick={() => tocar(n)}>{conteudo}</button>
                  : <div key={n.id} className={'nt-linha' + (n.lida ? '' : ' nova')}>{conteudo}</div>;
              })}
            </div>
          )}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Tocar marca como lida e abre a tela de origem, quando houver.</p>}
        </div>
      </div>
    </>
  );
}
