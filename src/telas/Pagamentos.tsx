// Pagamentos — desenho v4 (tela 15), D16 Onda C. Links de cobrança do provedor (Asaas) por situação, com valor,
// vencimento, método, data do pagamento e "Copiar link". Escrita (regra mestre): "+ Link" gera cobrança de um
// pedido ou orçamento SEM mandar valor (o ERP tira do documento — ver pagamento-regras.ts), "Consultar" pergunta
// ao provedor e "Cancelar" pede confirmação mostrando o valor. Mora dentro de Mais. Rotas /api/app/pagamentos*
// (formato proposto ao ERP).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, type FiltroPagamentos, type LinkPagamento, type ListaPagamentos, type MetodoPagamento, type ReferenciaCobranca, type StatusPagamento } from '../api';
import { corpoNovoLink, emAberto, mensagemGerar, PRAZOS, type MetodoApp, type Prazo } from '../pagamento-regras';
import { useVoltar } from '../voltar';
import { reais } from './Pedidos';

const FILTROS: Array<{ id: FiltroPagamentos; label: string }> = [
  { id: 'todos', label: 'Todos' }, { id: 'pendente', label: 'Pendente' }, { id: 'pago', label: 'Pago' },
  { id: 'vencido', label: 'Vencido' }, { id: 'cancelado', label: 'Cancelado' },
];
// Mesmas cores do protótipo: pendente alerta, pago positivo, vencido erro, cancelado apagado.
const STATUS: Record<StatusPagamento, { label: string; cor: string }> = {
  pendente: { label: 'Pendente', cor: 'var(--warn)' },
  pago: { label: 'Pago', cor: 'var(--ok)' },
  vencido: { label: 'Vencido', cor: 'var(--danger)' },
  cancelado: { label: 'Cancelado', cor: 'var(--text-dim)' },
};
const METODO: Record<MetodoPagamento, string> = { qualquer: 'Qualquer método', pix: 'PIX', boleto: 'Boleto', cartao: 'Cartão' };
// Cartão não aparece: exige o token do cartão e não sai do app (§10.6).
const METODOS: Array<{ id: MetodoApp; label: string }> = [
  { id: 'qualquer', label: 'Qualquer' }, { id: 'pix', label: 'PIX' }, { id: 'boleto', label: 'Boleto' },
];
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
const msgErro = (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível concluir.');

export function Pagamentos({ voltar, avisar }: { voltar?: ReactNode; avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void }) {
  const [filtro, setFiltro] = useState<FiltroPagamentos>('todos');
  const [dados, setDados] = useState<ListaPagamentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // Troca rápida de filtro: só a resposta do pedido mais recente entra na tela.
  const pedido = useRef(0);
  const carregar = useCallback(async (f: FiltroPagamentos) => {
    const n = ++pedido.current;
    setDados(null); setErro(null);
    try { const r = await api.pagamentos(f); if (n === pedido.current) setDados(r); }
    catch (e) {
      if (n !== pedido.current) return;
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso aos pagamentos.' : e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, []);
  useEffect(() => { carregar(filtro); }, [filtro, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.pagamentos(filtro, dados.pagina + 1);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  // Escrita: um envio por vez (botões desabilitados enquanto envia; o 409 ja_existe do ERP cobre o duplo toque).
  const [ocupado, setOcupado] = useState<number | 'novo' | null>(null);
  const [novo, setNovo] = useState(false);
  const [cancelando, setCancelando] = useState<LinkPagamento | null>(null);
  useVoltar(novo || cancelando !== null, () => { if (ocupado === null) { setNovo(false); setCancelando(null); } });

  const trocar = (l: LinkPagamento) => setDados((d) => (d ? { ...d, itens: d.itens.map((x) => (x.id === l.id ? l : x)) } : d));
  const consultar = async (p: LinkPagamento) => {
    setOcupado(p.id);
    try {
      const l = await api.consultarPagamento(p.id);
      if (l.status !== p.status) carregar(filtro); else trocar(l);
      avisar(l.status === 'pago' ? `Pagamento confirmado · ${reais(l.valor)}` : 'Ainda não consta pagamento.', l.status === 'pago' ? 'ok' : 'warn');
    } catch (e) { avisar(msgErro(e), 'erro'); }
    finally { setOcupado(null); }
  };
  const cancelar = async (p: LinkPagamento) => {
    setOcupado(p.id);
    try { await api.cancelarPagamento(p.id); setCancelando(null); avisar('Cobrança cancelada.'); carregar(filtro); }
    catch (e) { avisar(msgErro(e), 'erro'); }
    finally { setOcupado(null); }
  };

  const copiar = async (link: string) => {
    try { await navigator.clipboard.writeText(link); avisar('Link copiado.'); }
    catch { avisar('Não foi possível copiar o link.', 'erro'); }
  };

  const c = dados?.contadores;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{c ? `${c.todos} ${c.todos === 1 ? 'link' : 'links'} · ${c.vencido} ${c.vencido === 1 ? 'vencido' : 'vencidos'}` : 'Links de pagamento'}</div>
            <div className="pd-titulo">Pagamentos</div>
          </div>
          <button className="oi-btn primary pg-novo" onClick={() => setNovo(true)}>+ Link</button>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="pd-chips" role="tablist" aria-label="Situação do pagamento">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && <div className="p4-vazio"><b>Nenhum link aqui</b><span>Troque o filtro para ver outras cobranças.</span></div>}
          {dados?.itens.map((p) => {
            const s = STATUS[p.status];
            const aberto = emAberto(p.status);
            const podeCopiar = !!p.link && p.status !== 'pago';
            return (
              <article key={p.id} className="oc-card" aria-label={p.descricao}>
                <div className="oc-l1">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{p.descricao}</b>
                    <small>venc. {dataCurta(p.vencimento)} · {METODO[p.metodo] ?? p.metodo}</small>
                  </div>
                  <span className="oc-status" style={{ color: s.cor, borderColor: s.cor }}><i style={{ background: s.cor }} aria-hidden="true" />{s.label}</span>
                </div>
                <div className="oc-l2">
                  <span className="oc-valor">{reais(p.valor)}</span>
                  {p.status === 'pago' && p.pago_em && <span className="pg-pago">pago em {dataCurta(p.pago_em)}</span>}
                </div>
                {(podeCopiar || aberto) && (
                  <div className="pg-acoes">
                    {podeCopiar && <button className="oi-btn" onClick={() => copiar(p.link!)}>Copiar link</button>}
                    {aberto && <button className="oi-btn" disabled={ocupado !== null} onClick={() => consultar(p)}>{ocupado === p.id ? 'Consultando…' : 'Consultar'}</button>}
                    {aberto && <button className="oi-btn pg-perigo" disabled={ocupado !== null} onClick={() => setCancelando(p)}>Cancelar</button>}
                  </div>
                )}
              </article>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Provedor: Asaas. O valor do link é o do pedido ou orçamento, calculado no ERP.</p>}
        </div>
      </div>
      {novo && <NovoLink fechar={() => setNovo(false)} ocupado={ocupado === 'novo'} setOcupado={setOcupado}
        aoGerar={(l) => { setNovo(false); avisar(`Link gerado · ${reais(l.valor)}`); if (filtro === 'todos' || filtro === 'pendente') carregar(filtro); else setFiltro('todos'); }} />}
      {cancelando && (
        <div className="oi-sheet-backdrop" onClick={() => ocupado === null && setCancelando(null)}>
          <div className="oi-sheet" role="dialog" aria-modal="true" aria-labelledby="pg-canc-t" onClick={(e) => e.stopPropagation()}>
            <div className="oi-sheet-grip" />
            <div className="oi-sheet-h"><b id="pg-canc-t">Cancelar cobrança?</b></div>
            <div className="pg-folha">
              <p className="pg-conf">{cancelando.descricao}<br /><b>{reais(cancelando.valor)}</b> · venc. {dataCurta(cancelando.vencimento)}</p>
              <p className="p4-legal">O link deixa de aceitar pagamento. Isso não se desfaz pelo app.</p>
              <div className="pg-acoes">
                <button className="oi-btn" disabled={ocupado !== null} onClick={() => setCancelando(null)}>Voltar</button>
                <button className="oi-btn pg-perigo-cheio" disabled={ocupado !== null} onClick={() => cancelar(cancelando)}>{ocupado === cancelando.id ? 'Cancelando…' : 'Cancelar cobrança'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Folha "Novo link de pagamento": escolhe o documento, o método e o prazo. O valor mostrado é o saldo em aberto que o ERP
 *  calcula (o link sai com esse valor). */
function NovoLink({ fechar, aoGerar, ocupado, setOcupado }: {
  fechar: () => void; aoGerar: (l: LinkPagamento) => void; ocupado: boolean; setOcupado: (v: 'novo' | null) => void;
}) {
  const [refs, setRefs] = useState<ReferenciaCobranca[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sel, setSel] = useState<ReferenciaCobranca | null>(null);
  const [metodo, setMetodo] = useState<MetodoApp>('qualquer');
  const [prazo, setPrazo] = useState<Prazo>(7);

  useEffect(() => {
    let vivo = true;
    // Sem documento pré-selecionado: quem gera a cobrança escolhe, e o botão só habilita depois disso.
    api.referenciasCobranca().then((r) => { if (vivo) setRefs(r.itens); }).catch((e) => { if (vivo) setErro(msgErro(e)); });
    return () => { vivo = false; };
  }, []);

  const gerar = async () => {
    if (!sel || ocupado) return;
    setOcupado('novo'); setErro(null);
    try { aoGerar(await api.gerarLink(corpoNovoLink(sel, metodo, prazo))); }
    // 409 ja_existe (em aberto ou JÁ PAGA — a 2ª cobrança seria em dobro), 422, 503 e 429: a mensagem vem do ERP.
    catch (e) { setErro(mensagemGerar(e)); }
    finally { setOcupado(null); }
  };

  return (
    <div className="oi-sheet-backdrop" onClick={() => !ocupado && fechar()}>
      <div className="oi-sheet pg-sheet" role="dialog" aria-modal="true" aria-labelledby="pg-novo-t" onClick={(e) => e.stopPropagation()}>
        <div className="oi-sheet-grip" />
        <div className="oi-sheet-h"><b id="pg-novo-t">Novo link de pagamento</b>
          <button className="oi-btn close" disabled={ocupado} onClick={fechar}>Fechar</button></div>
        <div className="pg-folha">
          <div className="p4-rotulo">Cobrar</div>
          {!refs && !erro && <p className="p4-legal">Carregando…</p>}
          {refs && refs.length === 0 && <p className="p4-legal">Nenhum pedido ou orçamento em aberto para cobrar.</p>}
          {refs && refs.length > 0 && (
            <div className="pg-refs" role="radiogroup" aria-label="Documento a cobrar">
              {refs.map((r) => {
                const on = sel?.tipo === r.tipo && sel.id === r.id;
                return (
                  <button key={r.tipo + r.id} role="radio" aria-checked={on} className={'pg-ref' + (on ? ' on' : '')} onClick={() => setSel(r)}>
                    <span><b>{r.rotulo}</b><small>{r.cliente}</small></span><span className="pg-ref-v">{reais(r.valor)}<small>em aberto</small></span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="p4-rotulo">Método preferido</div>
          <div className="pg-seg" role="radiogroup" aria-label="Método preferido">
            {METODOS.map((m) => <button key={m.id} role="radio" aria-checked={metodo === m.id} className={'pg-seg-b' + (metodo === m.id ? ' on' : '')} onClick={() => setMetodo(m.id)}>{m.label}</button>)}
          </div>
          <div className="p4-rotulo">Vencimento</div>
          <div className="pg-seg" role="radiogroup" aria-label="Vencimento">
            {PRAZOS.map((d) => <button key={d} role="radio" aria-checked={prazo === d} className={'pg-seg-b' + (prazo === d ? ' on' : '')} onClick={() => setPrazo(d)}>+{d} dias</button>)}
          </div>
          {erro && <p className="pg-erro" role="alert">{erro}</p>}
          <button className="oi-btn primary block pg-gerar" disabled={!sel || ocupado} onClick={gerar}>
            {ocupado ? 'Gerando…' : sel ? `Gerar link de ${reais(sel.valor)}` : 'Escolha o pedido ou orçamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
