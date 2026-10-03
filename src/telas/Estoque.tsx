// Estoque — desenho v4 (tela 05), dados pelo contrato API-CONTRATO-v1 §9.2 (ERP #8577). Só leitura.
// Uma linha por variação × loja, só de produto que controla estoque. Tocar na linha abre as Movimentações
// (tela 29, só leitura, contrato §9.3). Fora de propósito: "+ Item",
// "+ Entrada" (escrita espera decisão do Wagner) e a barra de abas própria do protótipo
// (no app, Estoque mora dentro de Mais). "Baixo" é a regra do alerta da web: qtd ≤ mínimo.
import { useCallback, useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { api, DETALHE_ESTOQUE, ErroApi, type FiltroEstoque, type ItemEstoque, type ListaEstoque } from '../api';
import { Movimentacoes } from './Movimentacoes';
import { useVoltar } from '../voltar';

const FILTROS: Array<{ id: FiltroEstoque; label: string }> = [{ id: 'todos', label: 'Todos' }, { id: 'baixo', label: 'Baixo estoque' }];
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

/** Quantidade com unidade ("18 m²"), até 2 casas. */
export const textoQtd = (qtd: number, unidade: string | null) => (unidade ? `${num(qtd)} ${unidade}` : num(qtd));

/** Mesma regra do alerta da web (§9.2): só há "baixo" quando o item tem mínimo. */
export const ehBaixo = (i: Pick<ItemEstoque, 'qtd' | 'minimo'>) => i.minimo !== null && i.qtd <= i.minimo;

/** Tom do número e da barra, como o protótipo: até o mínimo = perigo, até o dobro = atenção, acima = ok. */
export function tomEstoque(i: Pick<ItemEstoque, 'qtd' | 'minimo'>): 'danger' | 'warn' | 'ok' | null {
  if (i.minimo === null) return null;
  if (i.qtd <= i.minimo) return 'danger';
  return i.qtd <= i.minimo * 2 ? 'warn' : 'ok';
}

/** Barra: o cheio é 3× o mínimo (protótipo). Sem mínimo (ou mínimo 0) não há barra. */
export function pctBarra(i: Pick<ItemEstoque, 'qtd' | 'minimo'>): number | null {
  if (i.minimo === null || i.minimo <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((i.qtd / (i.minimo * 3)) * 100)));
}

/** Onde está: prateleira (rack · fileira · posição) e a loja, pulando o que vier vazio. */
export const textoOnde = (i: Pick<ItemEstoque, 'prateleira' | 'local'>) => [i.prateleira, i.local].filter(Boolean).join(' · ');

export function Estoque({ voltar, filtroInicial = 'todos' }: { voltar?: ReactNode; filtroInicial?: FiltroEstoque }) {
  const [aberto, setAberto] = useState<number | null>(null);
  useVoltar(aberto !== null, () => setAberto(null));
  // A lista fica montada (escondida) enquanto o item está aberto: o voltar devolve a mesma busca e rolagem.
  return (
    <>
      {aberto !== null && <Movimentacoes id={aberto} aoVoltar={() => setAberto(null)} />}
      <div style={{ display: aberto !== null ? 'none' : 'contents' }}>
        <Lista voltar={voltar} filtroInicial={filtroInicial} aoAbrir={DETALHE_ESTOQUE ? setAberto : undefined} />
      </div>
    </>
  );
}

function Lista({ voltar, filtroInicial, aoAbrir }: { voltar?: ReactNode; filtroInicial: FiltroEstoque; aoAbrir?: (id: number) => void }) {
  const [filtro, setFiltro] = useState<FiltroEstoque>(filtroInicial);
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [dados, setDados] = useState<ListaEstoque | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // A busca vai ao servidor só depois de uma pausa na digitação.
  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t); }, [texto]);

  const carregar = useCallback(async (f: FiltroEstoque, busca: string) => {
    setErro(null);
    try { setDados(await api.estoque(f, 1, busca)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso ao estoque.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { setDados(null); carregar(filtro, q); }, [filtro, q, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.estoque(filtro, dados.pagina + 1, q);
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
            <div className="p4-rotulo">{c ? `${c.todos} ${c.todos === 1 ? 'item' : 'itens'}` : 'Estoque'}</div>
            <div className="pd-titulo">Estoque</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {c && c.baixo > 0 && filtro !== 'baixo' && (
            <button className="est-alerta" onClick={() => setFiltro('baixo')}>
              <b>{c.baixo} {c.baixo === 1 ? 'item com estoque baixo' : 'itens com estoque baixo'}</b>
              <span>Toque para ver só os itens abaixo do mínimo.</span>
            </button>
          )}
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar por nome ou código" aria-label="Buscar no estoque" enterKeyHint="search" />
          </label>
          <div className="pd-chips" role="tablist" aria-label="Filtro do estoque">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio">
              <b>{q ? 'Nada encontrado' : filtro === 'baixo' ? 'Nenhum item abaixo do mínimo' : 'Nenhum item no estoque'}</b>
              <span>{q ? 'Tente outro nome ou código.' : filtro === 'baixo' ? 'Tudo acima do mínimo nas suas lojas.' : 'Só aparecem produtos que controlam estoque.'}</span>
            </div>
          )}
          {dados?.itens.map((i) => {
            const tom = tomEstoque(i);
            const pct = pctBarra(i);
            const onde = textoOnde(i);
            // Linha que abre a tela 29: div com papel de botão (o cartão tem blocos dentro, que <button> não aceita).
            const abrir = aoAbrir ? {
              role: 'button', tabIndex: 0, onClick: () => aoAbrir(i.id),
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoAbrir(i.id); } },
            } : {};
            return (
              <div key={i.id} className={'est-card' + (aoAbrir ? ' abre' : '')} {...abrir}>
                <div className="est-linha">
                  <b className="est-nome">{i.nome}</b>
                  {i.codigo && <span className="est-cod">{i.codigo}</span>}
                </div>
                <div className="est-linha">
                  <span className={'est-qtd' + (tom ? ' ' + tom : '')}>{textoQtd(i.qtd, i.unidade)}</span>
                  <span className="est-meta">{i.minimo !== null ? `mín ${num(i.minimo)}` : 'sem mínimo'}{onde && ` · ${onde}`}{tom === 'danger' && ' · baixo'}</span>
                </div>
                {pct !== null && <div className="est-barra" aria-hidden="true"><i className={tom ?? ''} style={{ width: pct + '%' }} /></div>}
              </div>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
        </div>
      </div>
    </>
  );
}
