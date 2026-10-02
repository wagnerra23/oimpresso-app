// Pagamentos — desenho v4 (tela 15), D16 Onda C. Leitura: links de cobrança do provedor (Asaas) por situação,
// com valor, vencimento, método e data do pagamento, e "Copiar link" para mandar ao cliente. Ficam de fora
// "+ Link", "Consultar Asaas" e "Cancelar": criam, confirmam ou cancelam cobrança, mexem em valor e vêm no PR
// de escrita, pela regra mestre. Mora dentro de Mais. Rota GET /api/app/pagamentos (formato proposto ao ERP).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, type FiltroPagamentos, type ListaPagamentos, type MetodoPagamento, type StatusPagamento } from '../api';
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
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');

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
                {p.link && p.status !== 'pago' && (
                  <div className="pg-acoes">
                    <button className="oi-btn" onClick={() => copiar(p.link!)}>Copiar link</button>
                  </div>
                )}
              </article>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Gerar link, consultar o provedor e cancelar cobrança continuam no computador.</p>}
        </div>
      </div>
    </>
  );
}
