// Relatórios — desenho v4 (tela 13), D16 Onda C. Só leitura: período (mês, 3 meses, 12 meses), quatro
// indicadores e quatro recortes (DRE, vendas, produção, estoque). "Exportar PDF" e "Excel" geram arquivo
// no servidor e continuam no computador. "OS por status" é da oficina (Onda D) e fica de fora. Mora em Mais.
// Rota GET /api/app/relatorios, contrato §10.3 (entrou no ERP com o #8599).
// P6: abas Lucratividade e Comissões (ERP #9448, api/tela-13-lucratividade.md) — os números vêm prontos do ERP.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, type AbaRelatorio, type PeriodoRelatorio, type Relatorios as Dados } from '../api';
import { reais } from './Pedidos';
import { useAjustes } from '../ajustes';
import { avisoSemComissoes, equilibrio, reaisCurto, rotuloBase, tomMargem } from '../lucratividade-regras';

const PERIODOS: Array<{ id: PeriodoRelatorio; label: string }> = [
  { id: 'mes', label: 'Este mês' }, { id: 'trimestre', label: '3 meses' }, { id: 'ano', label: '12 meses' },
];
const ABAS: Array<{ id: AbaRelatorio; label: string }> = [
  { id: 'dre', label: 'DRE' }, { id: 'vendas', label: 'Vendas' }, { id: 'producao', label: 'Produção' }, { id: 'estoque', label: 'Estoque' },
  { id: 'lucratividade', label: 'Lucro' }, { id: 'comissoes', label: 'Comissões' },
];
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const pct = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

function Linhas({ titulo, itens }: { titulo: string; itens: Array<{ k: string; v: string; tom?: string }> }) {
  return (
    <section className="rl-bloco" aria-label={titulo}>
      <div className="p4-rotulo">{titulo}</div>
      {itens.map((i) => <div key={i.k} className="rl-linha"><span>{i.k}</span><b className={i.tom}>{i.v}</b></div>)}
    </section>
  );
}

export function Relatorios({ voltar }: { voltar?: ReactNode }) {
  const [periodo, setPeriodo] = useState<PeriodoRelatorio>('mes');
  const [aba, setAba] = useState<AbaRelatorio>('dre');
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lendo, setLendo] = useState(true);
  const ajustes = useAjustes();

  // Troca rápida de período ou aba: só a resposta do pedido mais recente entra na tela.
  const pedido = useRef(0);
  const carregar = useCallback(async (p: PeriodoRelatorio, a: AbaRelatorio) => {
    const n = ++pedido.current;
    setErro(null); setLendo(true);
    try { const r = await api.relatorios(p, a); if (n === pedido.current) setDados(r); }
    catch (e) {
      if (n !== pedido.current) return;
      setDados(null);
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso aos relatórios.' : e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
    finally { if (n === pedido.current) setLendo(false); }
  }, []);
  useEffect(() => { carregar(periodo, aba); }, [periodo, aba, carregar]);

  const k = dados?.kpis;
  // Bloco null: troca em andamento ("Carregando…") ou, com a resposta já na tela, sem permissão para esse recorte.
  const bloco = dados ? dados[aba] ?? null : null;
  const luc = aba === 'lucratividade' ? dados?.lucratividade ?? null : null;
  const eq = luc ? equilibrio(luc) : null;
  const com = aba === 'comissoes' ? dados?.comissoes ?? null : null;
  const maxDia = dados?.vendas ? Math.max(1, ...dados.vendas.receita_por_dia.map((d) => d.valor)) : 1;
  const maxDre = dados?.dre ? Math.max(1, k?.receitas ?? 0, k?.despesas ?? 0) : 1;

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">DRE · vendas · produção · estoque</div>
            <div className="pd-titulo">Relatórios</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="rl-seg" role="tablist" aria-label="Período">
            {PERIODOS.map((p) => (
              <button key={p.id} role="tab" aria-selected={periodo === p.id} className={'rl-seg-b' + (periodo === p.id ? ' on' : '')} onClick={() => setPeriodo(p.id)}>{p.label}</button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {k && (
            <div className="rl-kpis">
              <div className="rl-kpi"><small>Receitas</small><b className="pos">{reais(k.receitas)}</b></div>
              <div className="rl-kpi"><small>Despesas</small><b className="neg">{reais(k.despesas)}</b></div>
              <div className="rl-kpi"><small>Saldo</small><b>{reais(k.saldo)}</b></div>
              <div className="rl-kpi"><small>Margem</small><b>{k.margem_pct === null ? '—' : pct(k.margem_pct)}</b></div>
            </div>
          )}
          {dados && (
            <div className="rl-seg rl-seg-2l" role="tablist" aria-label="Relatório">
              {ABAS.map((a) => (
                <button key={a.id} role="tab" aria-selected={aba === a.id} className={'rl-seg-b' + (aba === a.id ? ' on' : '')} onClick={() => setAba(a.id)}>{a.label}</button>
              ))}
            </div>
          )}
          {dados && !bloco && lendo && <p className="p4-legal">Carregando…</p>}
          {dados && !bloco && !lendo && <div className="p4-vazio"><b>Sem acesso a este relatório</b>
            <span>{aba === 'comissoes' ? avisoSemComissoes(ajustes.app_comissao_vendedor_ve_propria) : 'Seu usuário não pode ver este recorte.'}</span></div>}

          {aba === 'dre' && dados?.dre && k && (
            <>
              <section className="rl-bloco" aria-label="Receitas vs. despesas">
                <div className="p4-rotulo">Receitas vs. despesas</div>
                {[{ l: 'Receitas', v: k.receitas, c: 'pos' }, { l: 'Despesas', v: k.despesas, c: 'neg' }].map((b) => (
                  <div key={b.l} className="rl-comp">
                    <span>{b.l} · {reais(b.v)}</span>
                    <div className="rl-barra" role="progressbar" aria-label={b.l} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((b.v / maxDre) * 100)}>
                      <i className={b.c} style={{ width: `${(b.v / maxDre) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </section>
              <Linhas titulo="Receitas por categoria" itens={dados.dre.receitas_por_categoria.map((c) => ({ k: c.nome, v: reais(c.valor) }))} />
              <Linhas titulo="Despesas por categoria" itens={dados.dre.despesas_por_categoria.map((c) => ({ k: c.nome, v: reais(c.valor) }))} />
            </>
          )}

          {aba === 'vendas' && dados?.vendas && (
            <>
              <section className="rl-bloco" aria-label="Receita por dia, últimos 14">
                <div className="p4-rotulo">Receita por dia · últimos 14</div>
                <div className="rl-colunas" role="img"
                  aria-label={`Receita por dia, de ${dataCurta(dados.vendas.receita_por_dia[0]?.data ?? '')} a ${dataCurta(dados.vendas.receita_por_dia.at(-1)?.data ?? '')}; maior dia ${reais(maxDia)}.`}>
                  {dados.vendas.receita_por_dia.map((d, i, a) => (
                    <i key={d.data} className={i === a.length - 1 ? 'ult' : ''} style={{ height: `${Math.max(2, (d.valor / maxDia) * 100)}%` }} title={`${dataCurta(d.data)} · ${reais(d.valor)}`} />
                  ))}
                </div>
                {dados.vendas.receita_por_dia.length > 0 && (
                  <div className="rl-eixo"><span>{dataCurta(dados.vendas.receita_por_dia[0].data)}</span><span>hoje · {reais(dados.vendas.receita_por_dia.at(-1)!.valor)}</span></div>
                )}
              </section>
              {dados.vendas.top_clientes.length > 0
                ? <Linhas titulo="Top 5 clientes" itens={dados.vendas.top_clientes.map((c, i) => ({ k: `${i + 1}. ${c.nome}`, v: reais(c.valor) }))} />
                : <div className="p4-vazio"><b>Sem vendas no período</b></div>}
            </>
          )}

          {aba === 'producao' && dados?.producao && (
            dados.producao.por_etapa.length > 0
              ? <Linhas titulo="Pedidos na produção · agora" itens={dados.producao.por_etapa.map((e) => ({ k: e.rotulo, v: String(e.total) }))} />
              : <div className="p4-vazio"><b>Nada na produção agora</b></div>
          )}

          {aba === 'estoque' && dados?.estoque && (
            dados.estoque.baixo.length > 0
              ? <Linhas titulo="Itens com estoque baixo · agora" itens={dados.estoque.baixo.map((i) => ({ k: i.nome, v: `${i.quantidade.toLocaleString('pt-BR')}${i.unidade ? ' ' + i.unidade : ''} / mín ${i.minimo.toLocaleString('pt-BR')}`, tom: 'neg' }))} />
              : <Linhas titulo="Itens com estoque baixo · agora" itens={[{ k: 'Nenhum item abaixo do mínimo', v: '', tom: 'pos' }]} />
          )}

          {luc && (
            <>
              <section className="rl-bloco" aria-label="Margem de contribuição">
                <div className="p4-rotulo">Margem de contribuição</div>
                <div className="lc-margem">
                  <b>{reais(luc.margem_contribuicao)}</b>
                  {luc.margem_pct !== null && <span className={luc.margem_pct >= 0 ? 'pos' : 'neg'}>{pct(luc.margem_pct)}</span>}
                </div>
                <div className="lc-tres">
                  {[{ l: 'Receita', v: luc.receita }, { l: 'Custo variável', v: luc.custo_variavel }, { l: 'Custo fixo', v: luc.custo_fixo }].map((c) => (
                    <div key={c.l} aria-label={`${c.l}: ${reais(c.v)}`}><small>{c.l}</small><b>{reaisCurto(c.v)}</b></div>
                  ))}
                </div>
              </section>
              <section className="rl-bloco" aria-label="Ponto de equilíbrio">
                <div className="p4-rotulo">Ponto de equilíbrio</div>
                {eq && luc.ponto_equilibrio !== null ? (
                  <div className="rl-comp">
                    <span>Equilíbrio em {reais(luc.ponto_equilibrio)}</span>
                    <div className="rl-barra" role="progressbar" aria-label="Receita até o ponto de equilíbrio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={eq.preenchido}>
                      <i className={eq.acima ? 'pos' : 'warn'} style={{ width: `${eq.preenchido}%` }} />
                    </div>
                    <span>{eq.acima ? 'A receita já passou do equilíbrio: o que vier daqui é lucro.' : 'A receita ainda não chegou ao equilíbrio.'}</span>
                  </div>
                ) : <span className="lc-nota">Sem ponto de equilíbrio no período (sem receita ou margem negativa).</span>}
              </section>
              {luc.menores_margens.length > 0 ? (
                <section className="rl-bloco" aria-label="Pedidos com menor margem">
                  <div className="p4-rotulo">Pedidos com menor margem</div>
                  {luc.menores_margens.map((m) => (
                    <div key={m.pedido_id} className="lc-linha">
                      <div><b>{m.resumo}</b><small>#{m.numero} · {reais(m.valor)}</small></div>
                      <span className={tomMargem(m.margem_pct)}>{pct(m.margem_pct)}</span>
                    </div>
                  ))}
                </section>
              ) : <div className="p4-vazio"><b>Sem vendas no período</b></div>}
            </>
          )}

          {com && (
            com.vendedores.length > 0 ? (
              <section className="rl-bloco" aria-label="Comissões">
                <div className="p4-rotulo">{rotuloBase(com.base)}</div>
                {com.vendedores.map((v) => (
                  <div key={v.id} className="lc-linha">
                    <span className="pd-avatar" aria-hidden="true">{iniciais(v.nome)}</span>
                    <div className="lc-vend">
                      <div><b>{v.nome}</b><b className="lc-valor">{reais(v.comissao)}</b></div>
                      <small><span>vendeu {reaisCurto(v.vendido)}</span> · <span>recebido {reaisCurto(v.recebido)}</span></small>
                      <small>{pct(v.percentual)} de comissão{com.base === 'payment_received' && <> · {reais(v.a_liberar)} a liberar</>}</small>
                    </div>
                  </div>
                ))}
              </section>
            ) : <div className="p4-vazio"><b>Nenhuma comissão no período</b></div>
          )}

          {dados && (aba === 'lucratividade' || aba === 'comissoes')
            ? <p className="p4-legal">Custos e regra de comissão vêm do ERP. Pagar comissão continua no computador.</p>
            : dados && <p className="p4-legal">Exportar em PDF ou Excel continua no computador.</p>}
        </div>
      </div>
    </>
  );
}
