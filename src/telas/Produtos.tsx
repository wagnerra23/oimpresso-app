// Produtos — desenho v4 (tela 19), dados pelo contrato API-CONTRATO-v1 §9.1 (ERP #8574). Só leitura.
// "+ Produto" abre a tela 20 (NovoProduto.tsx), por enquanto só na demo (ESCRITA_PRODUTO).
// Fora de propósito: a barra de abas própria do protótipo
// (no app, Produtos mora dentro de Mais). Os chips são as categorias que o ERP devolve, com a contagem
// da busca atual; a busca vai ao servidor (nome, código ou categoria).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, ESCRITA_PRODUTO, type ListaProdutos, type ProdutoResumo } from '../api';
import { Ic } from '../icones';
import { reais } from './Pedidos';
import { NovoProdutoTela } from './NovoProduto';
import { useVoltar } from '../voltar';

/** Quantidade como o protótipo ("18 m²", "9 un"): até 2 casas, sem zeros sobrando. */
export function textoEstoque(e: ProdutoResumo['estoque']): string {
  if (!e.controla || e.qtd === null) return 'sob demanda';
  const n = e.qtd.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return e.unidade ? `${n} ${e.unidade}` : n;
}

/** Preço do cartão; sem preço cadastrado, travessão. */
export const textoPreco = (preco: number | null): string => (preco === null ? '—' : reais(preco));
/** Com mais de uma variação o ERP manda o menor preço: a tela escreve "a partir de" acima dele. */
export const aPartirDe = (p: Pick<ProdutoResumo, 'preco' | 'variacoes'>): boolean => p.preco !== null && p.variacoes !== null && p.variacoes > 1;

/** Linha de baixo: código · categoria · cálculo, pulando o que vier vazio. */
export function textoMeta(p: Pick<ProdutoResumo, 'codigo' | 'categoria' | 'calculo'>): string[] {
  return [p.codigo, p.categoria ?? 'Sem categoria', p.calculo].filter((x): x is string => !!x);
}

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

/** Rótulo do topo, curto para caber numa linha ao lado do "+ Produto" a 360 px: "6 produtos · 2 em baixa". */
export function rotuloProdutos(total: number, baixo: number): string {
  return `${total} ${total === 1 ? 'produto' : 'produtos'}` + (baixo ? ` · ${baixo} em baixa` : '');
}

export function Produtos({ voltar, avisar }: { voltar?: ReactNode; avisar: Aviso }) {
  const [novo, setNovo] = useState(false);
  // Muda depois de um cadastro: o catálogo volta recarregado, com o produto novo.
  const [versao, setVersao] = useState(0);
  useVoltar(novo, () => setNovo(false));
  if (novo) {
    return <NovoProdutoTela avisar={avisar} aoCancelar={() => setNovo(false)}
      aoVerCatalogo={() => { setNovo(false); setVersao((v) => v + 1); }} />;
  }
  return <Catalogo key={versao} voltar={voltar} aoNovo={ESCRITA_PRODUTO ? () => setNovo(true) : undefined} />;
}

function Catalogo({ voltar, aoNovo }: { voltar?: ReactNode; aoNovo?: () => void }) {
  const [categoria, setCategoria] = useState<number | 'todas'>('todas');
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [dados, setDados] = useState<ListaProdutos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // A busca vai ao servidor só depois de uma pausa na digitação.
  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t); }, [texto]);

  const carregar = useCallback(async (c: number | 'todas', busca: string) => {
    setErro(null);
    try {
      const res = await api.produtos(c, 1, busca);
      // A busca pode tirar a categoria escolhida da lista de chips: volta para "Todas" em vez de prender numa lista vazia.
      if (c !== 'todas' && !res.categorias.some((x) => x.id === c)) { setCategoria('todas'); return; }
      setDados(res);
    }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso aos produtos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { setDados(null); carregar(categoria, q); }, [categoria, q, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.produtos(categoria, dados.pagina + 1, q);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const rotulo = dados ? rotuloProdutos(dados.total, dados.baixo_estoque) : 'Catálogo';
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{rotulo}</div>
            <div className="pd-titulo">Produtos</div>
          </div>
          {aoNovo && <button className="np-nova" onClick={aoNovo}>+ Produto</button>}
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Nome, código ou categoria" aria-label="Buscar produto" enterKeyHint="search" />
          </label>
          {dados && (
            <div className="pd-chips" role="tablist" aria-label="Categoria">
              <button role="tab" aria-selected={categoria === 'todas'} className={'pd-chip' + (categoria === 'todas' ? ' on' : '')} onClick={() => setCategoria('todas')}>
                Todas<span>{dados.total}</span>
              </button>
              {dados.categorias.map((c) => (
                <button key={c.id} role="tab" aria-selected={categoria === c.id} className={'pd-chip' + (categoria === c.id ? ' on' : '')} onClick={() => setCategoria(c.id)}>
                  {c.nome}<span>{c.total}</span>
                </button>
              ))}
            </div>
          )}
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><b>Nenhum produto encontrado</b><span>{q ? 'Tente outro nome ou código.' : 'Troque a categoria para ver outros produtos.'}</span></div>
          )}
          {dados && dados.itens.length > 0 && (
            <div className="p4-lista">
              {dados.itens.map((p) => (
                <div key={p.id} className="prd-linha">
                  <span className="prd-ico" aria-hidden="true"><Ic.pacote tamanho={18} /></span>
                  <span className="prd-texto">
                    <b>{p.nome}</b>
                    <small>{textoMeta(p).map((x, i) => <span key={i} className={i === 0 ? 'prd-cod' : undefined}>{i > 0 && ' · '}{x}</span>)}</small>
                  </span>
                  <span className="prd-valores">
                    {aPartirDe(p) && <small className="prd-apartir">a partir de</small>}
                    <b>{textoPreco(p.preco)}</b>
                    <small className={p.baixo ? 'baixo' : undefined}>{textoEstoque(p.estoque)}{p.baixo && ' · baixo'}</small>
                  </span>
                </div>
              ))}
            </div>
          )}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
        </div>
      </div>
    </>
  );
}
