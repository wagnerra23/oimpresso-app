// Orçamentos — desenho v4 (tela 04), D16 Onda A. Só leitura: ficam de fora "+ Novo", "Editar", "PDF" e
// "Converter em pedido" (escrevem ou geram documento — PR próprio; converter mexe em valor e passa pela
// regra mestre). Mora dentro de Mais (a barra de baixo é a do §7.1). Rota GET /api/app/orcamentos,
// contrato §2.1 (ERP #8555).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type FiltroOrcamentos, type ListaOrcamentos, type StatusOrcamento } from '../api';
import { reais } from './Pedidos';

const FILTROS: Array<{ id: FiltroOrcamentos; label: string }> = [
  { id: 'todos', label: 'Todos' }, { id: 'rascunho', label: 'Rascunho' }, { id: 'enviado', label: 'Enviado' },
  { id: 'aprovado', label: 'Aprovado' }, { id: 'convertido', label: 'Convertido' },
];
// Mesmas cores do protótipo (QS): rascunho cinza, enviado alerta, aprovado positivo, convertido roxo.
const STATUS: Record<StatusOrcamento, { label: string; cor: string }> = {
  rascunho: { label: 'Rascunho', cor: 'var(--text-dim)' },
  enviado: { label: 'Enviado', cor: 'var(--warn)' },
  aprovado: { label: 'Aprovado', cor: 'var(--ok)' },
  convertido: { label: 'Convertido', cor: 'var(--accent-text)' },
};
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
const m2 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

export function Orcamentos({ voltar }: { voltar?: ReactNode }) {
  const [filtro, setFiltro] = useState<FiltroOrcamentos>('todos');
  const [dados, setDados] = useState<ListaOrcamentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async (f: FiltroOrcamentos) => {
    setDados(null); setErro(null);
    try { setDados(await api.orcamentos(f)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso a orçamentos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(filtro); }, [filtro, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.orcamentos(filtro, dados.pagina + 1);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const c = dados?.contadores;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{c ? `${c.todos} ${c.todos === 1 ? 'proposta' : 'propostas'} · ${c.aprovado} ${c.aprovado === 1 ? 'aprovada' : 'aprovadas'}` : 'Orçamentos'}</div>
            <div className="pd-titulo">Orçamentos</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="pd-chips" role="tablist" aria-label="Situação do orçamento">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && <div className="p4-vazio"><b>Nenhum orçamento aqui</b><span>Troque o filtro para ver outras propostas.</span></div>}
          {dados?.itens.map((q) => {
            const s = STATUS[q.status];
            return (
              <article key={q.id} className="oc-card" aria-label={`Orçamento ${q.numero}`}>
                <div className="oc-l1">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{q.titulo ?? q.numero}</b>
                    <small>{q.cliente}{q.validade ? ` · validade ${dataCurta(q.validade)}` : ''}</small>
                  </div>
                  <span className="oc-status" style={{ color: s.cor, borderColor: s.cor }}><i style={{ background: s.cor }} aria-hidden="true" />{s.label}</span>
                </div>
                <div className="oc-l2">
                  <span className="oc-valor">{reais(q.valor)}</span>
                  <span className="oc-meta">{q.area_m2 !== null ? `${m2(q.area_m2)} m² · ` : ''}{q.itens} {q.itens === 1 ? 'item' : 'itens'}</span>
                </div>
              </article>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Criar, editar, gerar PDF e converter em pedido continuam no computador.</p>}
        </div>
      </div>
    </>
  );
}
