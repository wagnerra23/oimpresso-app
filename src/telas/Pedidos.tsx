// Pedidos — desenho v4 (telas 21 Pedidos · 22 Detalhe do pedido), dados pelo contrato
// API-CONTRATO-v1 §2 (Pedido = venda do ERP; etapas = grupos da FSM). Só leitura na v1:
// o botão da etapa fica desabilitado com "Abrir no computador" (ações mexem em estoque/cobrança).
// Fora do v4 de propósito: "+ Venda" (Venda rápida é v2) e "Link de aprovação" (não está no contrato).
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type FiltroPedidos, type GrupoEtapa, type ListaPedidos, type PedidoDetalheApi } from '../api';
import { useVoltar } from '../voltar';

const FILTROS: Array<{ id: FiltroPedidos; label: string }> = [
  { id: 'ativos', label: 'Ativos' }, { id: 'atrasados', label: 'Atrasados' },
  { id: 'concluidos', label: 'Concluídos' }, { id: 'todos', label: 'Todos' },
];
const TINTA: Record<GrupoEtapa, string> = {
  orcamento: 'var(--text-dim)', aprovacao: 'var(--warn)', producao: 'var(--accent-text)', entrega: 'var(--info)', concluido: 'var(--text-mute)',
};
export const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');

export function Pedidos() {
  const [aberto, setAberto] = useState<number | null>(null);
  useVoltar(aberto !== null, () => setAberto(null));
  return aberto !== null ? <Detalhe id={aberto} aoVoltar={() => setAberto(null)} /> : <Lista aoAbrir={setAberto} />;
}

function Lista({ aoAbrir }: { aoAbrir: (id: number) => void }) {
  const [filtro, setFiltro] = useState<FiltroPedidos>('ativos');
  const [dados, setDados] = useState<ListaPedidos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async (f: FiltroPedidos) => {
    setDados(null); setErro(null);
    try { setDados(await api.pedidos(f)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso a pedidos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(filtro); }, [filtro, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.pedidos(filtro, dados.pagina + 1);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const c = dados?.contadores;
  return (
    <>
      <div className="pd-head">
        <div className="p4-rotulo">{c ? `${c.ativos} ativos · ${c.atrasados} atrasados` : 'Pedidos'}</div>
        <div className="pd-titulo">Pedidos</div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="pd-chips" role="tablist" aria-label="Filtro de pedidos">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && <div className="p4-vazio"><b>Nenhum pedido aqui</b><span>Troque o filtro para ver outros pedidos.</span></div>}
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

export function Detalhe({ id, aoVoltar }: { id: number; aoVoltar: () => void }) {
  const [p, setP] = useState<PedidoDetalheApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { api.pedido(id).then(setP).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')); }, [id]);

  const acao = p?.acoes.find((a) => a.pode) ?? p?.acoes[0];
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
          </div>
        )}
      </div>
      {p && acao && (
        <div className="pd-rodape">
          <button className="p4-cta" disabled>{acao.rotulo}</button>
          <span className="pd-rodape-nota">Abrir no computador — no app esta etapa é só consulta.</span>
        </div>
      )}
    </>
  );
}
