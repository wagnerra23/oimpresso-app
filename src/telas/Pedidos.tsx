// Pedidos — desenho v4 (telas 21 Pedidos · 22 Detalhe do pedido), dados pelo contrato
// API-CONTRATO-v1 §2 (Pedido = venda do ERP; etapas = grupos da FSM). P1 · tela 22 (ERP #9445): o rodapé do Detalhe
// move a etapa só pelas ações que o ERP manda em acoes[] (lista segura, sem efeito em valor ou estoque) e que a empresa
// liberou (`app_acoes_fsm_liberadas`). Confirma em folha; offline trava; 409 etapa_mudou recarrega o pedido.
// P3 · tela 22 (ERP #9464): com `entrega.pode`, o rodapé abre "Registrar entrega" (EntregaPedido), fora de acoes[].
// "+ Venda" abre a Venda rápida (tela 11, D16 Onda A). Fora do v4 de propósito: "Link de aprovação" (não está no contrato).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, type FiltroPedidos, type GrupoEtapa, type ListaPedidos, type PedidoDetalheApi } from '../api';
import { useAjustes } from '../ajustes';
import { acoesDoRodape, corpoAcao, reacaoAoErro, soConsulta, textoMudanca, tituloConfirmacao, type AcaoPedido } from '../pedido-acao-regras';
import { botaoEntrega } from '../entrega-regras';
import { haQuanto } from '../tempo';
import { novaChave } from '../venda';
import { useVoltar } from '../voltar';
import { CampoBusca } from '../busca';
import { EntregaPedido } from './EntregaPedido';
import { VendaRapida } from './VendaRapida';

const FILTROS: Array<{ id: FiltroPedidos; label: string }> = [
  { id: 'ativos', label: 'Ativos' }, { id: 'atrasados', label: 'Atrasados' },
  { id: 'concluidos', label: 'Concluídos' }, { id: 'todos', label: 'Todos' },
];
const TINTA: Record<GrupoEtapa, string> = {
  orcamento: 'var(--text-dim)', aprovacao: 'var(--warn)', producao: 'var(--accent-text)', entrega: 'var(--info)', concluido: 'var(--text-mute)',
};
export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');

/** `voltar`: botão para Mais, quando Pedidos não está na barra (tela 30). */
export function Pedidos({ voltar, avisar, online }: { voltar?: ReactNode; avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void; online: boolean }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [vendendo, setVendendo] = useState(false);
  useVoltar(aberto !== null, () => setAberto(null));
  useVoltar(vendendo, () => setVendendo(false));
  if (vendendo) return <VendaRapida aoVoltar={() => setVendendo(false)} avisar={avisar} online={online} />;
  return aberto !== null ? <Detalhe id={aberto} aoVoltar={() => setAberto(null)} avisar={avisar} online={online} /> : <Lista aoAbrir={setAberto} aoVender={() => setVendendo(true)} voltar={voltar} />;
}

function Lista({ aoAbrir, aoVender, voltar }: { aoAbrir: (id: number) => void; aoVender: () => void; voltar?: ReactNode }) {
  const [filtro, setFiltro] = useState<FiltroPedidos>('ativos');
  const [dados, setDados] = useState<ListaPedidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  // A busca vai ao servidor (`q`) só depois de uma pausa na digitação, como em Pessoas.
  useEffect(() => { const t = setTimeout(() => setQ(busca.trim()), 350); return () => clearTimeout(t); }, [busca]);

  // Busca e filtro mudam rápido: só a resposta do pedido mais recente entra na tela.
  const pedido = useRef(0);
  const carregar = useCallback(async (f: FiltroPedidos, texto: string) => {
    const n = ++pedido.current;
    setDados(null); setErro(null);
    try { const r = await api.pedidos(f, 1, texto); if (n === pedido.current) setDados(r); }
    catch (e) {
      if (n !== pedido.current) return;
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso a pedidos.' : e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, []);
  useEffect(() => { carregar(filtro, q); }, [filtro, q, carregar]);

  const mais = async () => {
    if (!dados) return;
    const n = pedido.current;
    setCarregandoMais(true);
    try {
      const prox = await api.pedidos(filtro, dados.pagina + 1, q);
      if (n === pedido.current) setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { if (n === pedido.current) setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const c = dados?.contadores;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{c ? `${c.ativos} ativos · ${c.atrasados} atrasados` : 'Pedidos'}</div>
            <div className="pd-titulo">Pedidos</div>
          </div>
          <button className="pd-novo" onClick={aoVender}>+ Venda</button>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <CampoBusca valor={busca} aoMudar={setBusca} placeholder="Cliente ou número do pedido" rotulo="Buscar pedido" />
          <div className="pd-chips" role="tablist" aria-label="Filtro de pedidos">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {/* Durante a busca os contadores seriam do filtro sem o texto: somem para não confundir. */}
                {f.label}{c && !q && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (q
            ? <div className="p4-vazio"><b>Nada encontrado</b><span>Nenhum pedido com “{q}” aqui. Tente outro cliente ou número, ou troque o filtro.</span></div>
            : <div className="p4-vazio"><b>Nenhum pedido aqui</b><span>Troque o filtro para ver outros pedidos.</span></div>)}
          {dados?.itens.map((p) => (
            <button key={p.id} className={'pd-card' + (p.atrasado ? ' atrasado' : '')} style={{ borderLeftColor: p.atrasado ? 'var(--danger)' : TINTA[p.etapa.grupo] }} onClick={() => aoAbrir(p.id)}>
              <span className="pd-card-l1">
                <span className="pd-num">#{p.numero}</span>
                <span className={'pd-prazo' + (p.atrasado ? ' atrasado' : '')}>{p.atrasado ? `atrasado · ${dataCurta(p.prazo)}` : `prazo ${dataCurta(p.prazo)}`}</span>
                <span className="pd-status" style={{ color: TINTA[p.etapa.grupo] }}><i style={{ background: TINTA[p.etapa.grupo] }} />{p.etapa.rotulo}</span>
              </span>
              <span className="pd-card-l2"><b>{p.resumo ?? p.cliente}</b></span>
              <span className="pd-card-l3"><span>{p.cliente}</span><span className="pd-valor">{reais(p.valor)}</span></span>
            </button>
          ))}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
        </div>
      </div>
    </>
  );
}

const statusDe = (e: unknown) => (e instanceof ErroApi ? e.status : (e as { status?: number } | null)?.status ?? 0);
const codigoDe = (e: unknown) => (e instanceof ErroApi ? e.codigo : (e as { codigo?: string } | null)?.codigo ?? '');

export function Detalhe({ id, aoVoltar, avisar, online }: { id: number; aoVoltar: () => void; avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void; online: boolean }) {
  const [p, setP] = useState<PedidoDetalheApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<AcaoPedido | null>(null);
  const [enviando, setEnviando] = useState(false);
  /** Ações recusadas com 403 nesta visita: o botão some até recarregar. */
  const [recusadas, setRecusadas] = useState<string[]>([]);
  /** Idempotency-Key da tentativa: a mesma enquanto ação e etapa forem as mesmas (rede/5xx repetem sem mover 2×). */
  const chave = useRef<{ sig: string; valor: string } | null>(null);
  const ajustes = useAjustes();
  // P3 · entrega: tela aberta e 403 nesta visita (o botão some até recarregar).
  const [entregando, setEntregando] = useState(false);
  const [entregaRecusada, setEntregaRecusada] = useState(false);
  useVoltar(entregando, () => setEntregando(false));

  const recarregar = useCallback(() => api.pedido(id).then((n) => { setP(n); setRecusadas([]); setEntregaRecusada(false); })
    .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')), [id]);
  useEffect(() => { recarregar(); }, [recarregar]);

  const acoes = p ? p.acoes.filter((a) => !recusadas.includes(a.chave)) : [];
  const botoes = acoesDoRodape(acoes, ajustes.app_acoes_fsm_liberadas);
  const entregar = p ? botaoEntrega(p.entrega, entregaRecusada) : false;
  const consulta = !entregar && (soConsulta(acoes, ajustes.app_acoes_fsm_liberadas) || (!!p?.entrega && botoes.length === 0));

  const mover = async (a: AcaoPedido) => {
    if (!p || enviando) return;
    if (!online) { setConfirmando(null); avisar('Sem conexão. Mover etapa precisa de internet.', 'warn'); return; }
    const sig = `${p.id}|${a.chave}|${p.etapa.chave}`;
    if (chave.current?.sig !== sig) chave.current = { sig, valor: novaChave() };
    setEnviando(true);
    try {
      const novo = await api.avancarPedido(p.id, corpoAcao(a.chave, p.etapa.chave), chave.current.valor);
      chave.current = null;
      setP(novo); setConfirmando(null);
      avisar(`Pedido #${novo.numero} em ${novo.etapa.rotulo}`);
    } catch (e) {
      const r = reacaoAoErro(statusDe(e), codigoDe(e));
      if (!r.manterChave) chave.current = null;
      setConfirmando(null);
      avisar(r.reacao === 'avisar' && e instanceof Error && e.message ? e.message : r.mensagem, r.reacao === 'repetir' || r.reacao === 'recarregar' ? 'warn' : 'erro');
      if (r.reacao === 'recarregar') recarregar();
      else if (r.reacao === 'sumir') setRecusadas((x) => [...x, a.chave]);
      else if (r.reacao === 'voltar') aoVoltar();
    } finally { setEnviando(false); }
  };

  if (entregando && p) {
    return (
      <EntregaPedido pedido={p} online={online} avisar={avisar} aoVoltar={() => setEntregando(false)}
        aoRegistrada={(r) => setP(r.pedido)}
        aoReagir={(r) => {
          setEntregando(false);
          if (r === 'recarregar') recarregar();
          else if (r === 'sumir') setEntregaRecusada(true);
          else aoVoltar();
        }} />
    );
  }

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para pedidos">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p?.cliente.nome ?? ''}</div>
          <div className="pd-dtitulo">Pedido #{p?.numero ?? '…'}</div>
        </div>
        {p && <span className="pd-status" style={{ color: p.atrasado ? 'var(--danger)' : TINTA[p.etapa.grupo], paddingRight: 8 }}>
          <i style={{ background: p.atrasado ? 'var(--danger)' : TINTA[p.etapa.grupo] }} />{p.atrasado ? 'Atrasado' : p.etapa.rotulo}</span>}
      </div>
      <div className="oi-scroll">
        {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
        {!p && !erro && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {p && (
          <div className="pd-corpo">
            <div className="pd-cartao">
              <ol className="pd-etapas" aria-label="Andamento do pedido">
                {p.etapas.map((e, i) => (
                  <li key={e.grupo} className={'pd-etapa ' + e.estado} aria-current={e.estado === 'atual' ? 'step' : undefined}>
                    <span className="pd-bola">{e.estado === 'feito' ? '✓' : i + 1}</span>
                    <span className="pd-etapa-r">{e.rotulo}</span>
                  </li>
                ))}
              </ol>
              <div className="pd-prazo-l">Prazo <b>{p.prazo ? p.prazo.split('-').reverse().join('/') : '—'}</b>{p.atrasado && <span className="pd-atrasado">atrasado</span>}</div>
            </div>

            <div className="p4-rotulo">Itens</div>
            <div className="p4-lista">
              {p.itens_venda.map((it, i) => (
                <div key={i} className="pd-item">
                  <div style={{ flex: 1, minWidth: 0 }}><div className="pd-item-d">{it.produto}</div><div className="pd-item-m">{it.quantidade} un</div></div>
                  <span className="pd-item-v">{reais(it.total)}</span>
                </div>
              ))}
              <div className="pd-total"><span>Total</span><span>{reais(p.valor)}</span></div>
            </div>

            <div className="p4-rotulo">Cliente</div>
            <div className="p4-lista">
              <div className="pd-item">
                <span className="pd-avatar" aria-hidden="true">{p.cliente.nome.slice(0, 2).toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}><div className="pd-item-d">{p.cliente.nome}</div>
                  {p.cliente.telefone && <div className="pd-item-m">{p.cliente.telefone}</div>}</div>
                {p.cliente.telefone && <a className="p4-link" href={`tel:${p.cliente.telefone.replace(/\D/g, '')}`}>Ligar</a>}
              </div>
            </div>

            {p.historico && p.historico.length > 0 && (
              <>
                <div className="p4-rotulo">Histórico</div>
                <ol className="pd-hist" aria-label="Histórico de etapas">
                  {p.historico.map((m, i) => (
                    <li key={i} className={'pd-hist-l' + (i === 0 ? ' atual' : '')}>
                      <span className="pd-hist-d">{textoMudanca(m)}</span>
                      <span className="pd-hist-m">{[m.quem, haQuanto(m.em), m.origem === 'app' ? 'pelo app' : null].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ol>
                <span className="pd-hist-nota">Cada mudança grava quem moveu e quando, igual à web. Voltar etapa continua no computador.</span>
              </>
            )}
          </div>
        )}
      </div>
      {p && (botoes.length > 0 || consulta || entregar) && (
        <div className="pd-rodape">
          {consulta && <span className="pd-rodape-nota">Seu usuário só consulta este pedido.</span>}
          {entregar && <button className="p4-cta" disabled={!online || enviando} onClick={() => setEntregando(true)}>Registrar entrega</button>}
          {botoes.map((a, i) => (
            <button key={a.chave} className={i === 0 && !entregar ? 'p4-cta' : 'oi-btn block pd-rodape-2'} disabled={!online || enviando} onClick={() => setConfirmando(a)}>{a.rotulo}</button>
          ))}
          {(botoes.length > 0 || entregar) && !online && <span className="pd-rodape-nota">{entregar && botoes.length === 0 ? 'Sem conexão. Registrar a entrega precisa de internet.' : 'Sem conexão. Mover etapa precisa de internet.'}</span>}
        </div>
      )}
      {confirmando && p && (
        <div className="oi-sheet-backdrop" onClick={() => !enviando && setConfirmando(null)}>
          <div className="oi-sheet" role="dialog" aria-modal="true" aria-labelledby="pd-conf-t" onClick={(e) => e.stopPropagation()}>
            <div className="oi-sheet-grip" />
            <div className="oi-sheet-h"><b id="pd-conf-t">{tituloConfirmacao(confirmando)}</b></div>
            <div className="osd-folha">
              <p className="osd-conf">O pedido #{p.numero} sai de <b>{p.etapa.rotulo}</b>. Fica no histórico com seu nome e a hora.</p>
              <div className="osd-conf-bts">
                <button className="oi-btn" disabled={enviando} onClick={() => setConfirmando(null)}>Cancelar</button>
                <button className="p4-cta" disabled={enviando || !online} onClick={() => mover(confirmando)}>{enviando ? 'Movendo…' : 'Mover'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
