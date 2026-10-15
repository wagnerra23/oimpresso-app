// Financeiro — desenho v4 (tela 06), D16 Onda C. Só leitura: saldo do mês, contas e lançamentos em
// aberto (a receber / a pagar) ou liquidados no mês (extrato). Baixar título e pagar ficam na tela 15
// (Pagamentos), que mexe em valor e passa pela regra mestre. Mora dentro de Mais.
// Rota GET /api/app/financeiro, contrato §10.1 (ERP #8584).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, FILTRO_FINANCEIRO, type AbaFinanceiro, type PainelFinanceiro, type StatusLancamento } from '../api';
import { contarFiltros, FILTROS_VAZIOS, paramsFiltros, resumoFiltros, type FiltrosFinanceiro } from '../financeiro-filtros';
import { useVoltar } from '../voltar';
import { reais } from './Pedidos';
import { FiltroFinanceiro } from './FiltroFinanceiro';

const ABAS: Array<{ id: AbaFinanceiro; label: string }> = [
  { id: 'receber', label: 'A receber' }, { id: 'pagar', label: 'A pagar' }, { id: 'extrato', label: 'Extrato' },
];
const STATUS: Record<StatusLancamento, { label: string; cor: string }> = {
  aberto: { label: 'Aberto', cor: 'var(--text-dim)' },
  vencido: { label: 'Vencido', cor: 'var(--danger)' },
  liquidado: { label: 'Liquidado', cor: 'var(--ok)' },
};
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
const VAZIO: Record<AbaFinanceiro, string> = {
  receber: 'Nada a receber em aberto.', pagar: 'Nada a pagar em aberto.', extrato: 'Nenhum lançamento liquidado neste mês.',
};

export function Financeiro({ voltar }: { voltar?: ReactNode }) {
  const [aba, setAba] = useState<AbaFinanceiro>('receber');
  const [dados, setDados] = useState<PainelFinanceiro | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosFinanceiro>(FILTROS_VAZIOS);
  const [filtrando, setFiltrando] = useState(false);
  useVoltar(filtrando, () => setFiltrando(false));

  const [lendo, setLendo] = useState(true);
  // Troca rápida de aba: só a resposta do pedido mais recente entra na tela.
  const pedido = useRef(0);
  const carregar = useCallback(async (a: AbaFinanceiro, f: FiltrosFinanceiro) => {
    const n = ++pedido.current;
    setErro(null); setLendo(true);
    // Troca de aba mantém resumo e contas na tela; só a lista recarrega.
    setDados((d) => (d ? { ...d, itens: [], tem_mais: false } : null));
    try { const r = await api.financeiro(a, 1, paramsFiltros(f)); if (n === pedido.current) setDados(r); }
    catch (e) {
      if (n !== pedido.current) return;
      setDados(null);
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso ao Financeiro.' : e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
    finally { if (n === pedido.current) setLendo(false); }
  }, []);
  useEffect(() => { carregar(aba, filtros); }, [aba, filtros, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.financeiro(aba, dados.pagina + 1, paramsFiltros(filtros));
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const r = dados?.resumo;
  const nFiltros = contarFiltros(filtros);
  if (filtrando && dados) {
    return <FiltroFinanceiro inicial={filtros} contas={dados.contas} formas={dados.formas_pagamento}
      aoVoltar={() => setFiltrando(false)} aoAplicar={(f) => { setFiltros(f); setFiltrando(false); }} />;
  }
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">Caixa · a receber · a pagar</div>
            <div className="pd-titulo">Financeiro</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {r && (
            <section className="fn-saldo" aria-label="Saldo do mês">
              <div className="p4-rotulo">Saldo do mês</div>
              <span className={'fn-saldo-v' + (r.saldo < 0 ? ' neg' : '')}>{reais(r.saldo)}</span>
              <div className="fn-linha">
                <div><small>Recebido</small><b className="pos">{reais(r.recebido)}</b></div>
                <div><small>Pago</small><b className="neg">{reais(r.pago)}</b></div>
              </div>
              <div className="fn-div" />
              <div className="fn-linha tres">
                <div><small>A receber</small><b className="ac">{reais(r.a_receber)}</b></div>
                <div><small>Vencido</small><b className="warn">{reais(r.vencido)}</b></div>
                <div><small>A pagar</small><b>{reais(r.a_pagar)}</b></div>
              </div>
            </section>
          )}
          {dados && dados.contas.length > 0 && (
            <>
              <div className="p4-rotulo">Contas</div>
              <div className="fn-contas">
                {dados.contas.map((c) => (
                  <div key={c.id} className="fn-conta">
                    <b>{c.nome}</b>
                    {c.detalhe && <small>{c.detalhe}</small>}
                    <span>{c.saldo === null ? '—' : reais(c.saldo)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {dados && (
            <div className="fn-abas" role="tablist" aria-label="Lançamentos">
              {ABAS.map((a) => (
                <button key={a.id} role="tab" aria-selected={aba === a.id} className={'fn-aba' + (aba === a.id ? ' on' : '')} onClick={() => setAba(a.id)}>
                  {a.label} <span>{dados.contadores[a.id]}</span>
                </button>
              ))}
            </div>
          )}
          {dados && FILTRO_FINANCEIRO && (
            <div className="ff-barra">
              <button className={'oi-btn ff-botao' + (nFiltros ? ' on' : '')} onClick={() => setFiltrando(true)} aria-label={nFiltros ? `Filtro avançado, ${nFiltros} ligados` : 'Filtro avançado'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                Filtro avançado{nFiltros > 0 && <span>{nFiltros}</span>}
              </button>
              {nFiltros > 0 && <button className="p4-link ff-limpar" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar</button>}
            </div>
          )}
          {dados && nFiltros > 0 && <p className="ff-resumo">{resumoFiltros(filtros, dados.contas).join(' · ')}</p>}
          {dados && lendo && dados.itens.length === 0 && <p className="p4-legal">Carregando…</p>}
          {dados && !lendo && dados.itens.length === 0 && (nFiltros > 0
            ? <div className="p4-vazio"><b>Nenhum lançamento com esses filtros</b><span>Mude o período ou tire algum filtro. As outras abas podem ter resultados.</span></div>
            : <div className="p4-vazio"><b>Nada aqui</b><span>{VAZIO[aba]}</span></div>)}
          {dados?.itens.map((l) => {
            const s = STATUS[l.status];
            const data = l.status === 'liquidado' ? `pago ${dataCurta(l.pago_em)}` : l.status === 'vencido' ? `venceu ${dataCurta(l.vencimento)}` : `vence ${dataCurta(l.vencimento)}`;
            return (
              <article key={l.id} className="fn-lanc" aria-label={l.descricao}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{l.descricao}</b>
                  <small>{l.parte ? `${l.parte} · ` : ''}{data}</small>
                  {(l.forma_pagamento || l.nf_numero) && <small>{[l.forma_pagamento, l.nf_numero && `NF ${l.nf_numero}`].filter(Boolean).join(' · ')}</small>}
                </div>
                <div className="fn-lanc-v">
                  <span className={l.tipo === 'receber' ? 'pos' : 'neg'}>{l.tipo === 'receber' ? '+ ' : '− '}{reais(l.valor)}</span>
                  <small style={{ color: s.cor }}>{s.label}</small>
                </div>
              </article>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Baixar títulos, pagar e conciliar continuam no computador.</p>}
        </div>
      </div>
    </>
  );
}
