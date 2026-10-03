// Dashboard — desenho v4 (tela 35), D16 Onda C. Só leitura: faturamento de 30 dias com a tendência semanal,
// indicadores (pedidos, produção, a receber), pedidos por dia e o fechamento do mês. "OS no pátio" é da oficina
// (Onda D) e fica de fora. Mora em Mais; os cartões de pedidos e produção abrem as abas.
// Rota GET /api/app/dashboard, contrato §10.4 (ERP #8599).
import { useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type Dashboard as Dados } from '../api';
import { reais } from './Pedidos';

const dataCurta = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
const sinal = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';

/** Linha da tendência (7 pontos). Decorativa: o número está em texto ao lado. */
function Tendencia({ serie }: { serie: number[] }) {
  if (serie.length < 2) return null;
  const min = Math.min(...serie), max = Math.max(...serie), amp = max - min || 1;
  const pts = serie.map((v, i) => `${(i / (serie.length - 1)) * 100},${36 - ((v - min) / amp) * 32 - 2}`).join(' ');
  return (
    <svg className="db-tend" viewBox="0 0 100 36" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Dashboard({ voltar, irParaPedidos, irParaProducao }: { voltar?: ReactNode; irParaPedidos: () => void; irParaProducao: () => void }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api.dashboard().then((d) => { if (vivo) setDados(d); })
      .catch((e) => { if (vivo) setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso ao dashboard.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); });
    return () => { vivo = false; };
  }, []);

  const f = dados?.faturamento_30d;
  const k = dados?.kpis;
  const dias = dados?.pedidos_por_dia ?? [];
  const maxDia = Math.max(1, ...dias.map((d) => d.total));
  const pc = dados?.producao_concluida;
  const pcPct = pc && pc.total > 0 ? Math.round((pc.concluidas / pc.total) * 100) : 0;

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">BI · últimos 30 dias</div>
            <div className="pd-titulo">Dashboard</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {f && (
            <section className="in-hero db-hero" aria-label="Faturamento 30 dias">
              <span>Faturamento 30 dias</span>
              <b>{reais(f.valor)}</b>
              <div className="db-hero-l">
                {f.variacao_pct !== null ? <small className={f.variacao_pct >= 0 ? 'db-pos' : 'db-neg'}>{sinal(f.variacao_pct)} vs. mês anterior</small> : <small />}
                <Tendencia serie={f.serie_semanal} />
              </div>
            </section>
          )}
          {k && (k.pedidos_ativos !== null || k.producao_em_curso !== null || k.a_receber !== null) && (
            <div className="db-kpis">
              {k.pedidos_ativos !== null && (
                <button className="in-kpi db-kpi" onClick={irParaPedidos}
                  aria-label={`Pedidos: ${k.pedidos_ativos} ativos${k.pedidos_novos !== null ? `, ${k.pedidos_novos} hoje` : ''}. Abrir pedidos`}>
                  <span>Pedidos</span><b>{k.pedidos_ativos}</b>{k.pedidos_novos !== null && <small>{k.pedidos_novos} hoje</small>}
                </button>
              )}
              {k.producao_em_curso !== null && (
                <button className="in-kpi db-kpi" onClick={irParaProducao} aria-label={`Produção: ${k.producao_em_curso} em produção. Abrir produção`}>
                  <span>Produção</span><b>{k.producao_em_curso}</b><small>em produção</small>
                </button>
              )}
              {k.a_receber !== null && (
                <div className="in-kpi db-kpi db-largo">
                  <span>A receber</span><b className="db-valor">{reais(k.a_receber)}</b>
                  {k.vencido !== null && k.vencido > 0 && <small className="db-alerta">{reais(k.vencido)} vencido</small>}
                </div>
              )}
            </div>
          )}
          {dias.length > 0 && (
            <section className="db-bloco" aria-label="Pedidos por dia">
              <div className="p4-rotulo">Pedidos por dia</div>
              <div className="db-colunas" role="img"
                aria-label={`Pedidos por dia, de ${dataCurta(dias[0].data)} a ${dataCurta(dias[dias.length - 1].data)}; hoje ${dias[dias.length - 1].total}, maior dia ${maxDia}.`}>
                {dias.map((d, i) => (
                  <i key={d.data} className={i === dias.length - 1 ? 'ult' : ''} style={{ height: `${Math.max(3, (d.total / maxDia) * 100)}%` }} title={`${dataCurta(d.data)} · ${d.total}`} />
                ))}
              </div>
              <div className="db-eixo"><span>{dataCurta(dias[0].data)}</span><span>hoje · {dias[dias.length - 1].total}</span></div>
            </section>
          )}
          {dados && (dados.meta_mes || (pc && pc.total > 0)) && (
            <section className="db-bloco" aria-label="Fechamento do mês">
              <div className="p4-rotulo">Fechamento do mês</div>
              {dados.meta_mes && (
                <div className="db-prog">
                  <span>Meta de faturamento · {dados.meta_mes.realizado_pct}%</span>
                  <div className="in-barra" role="progressbar" aria-label="Meta de faturamento" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, dados.meta_mes.realizado_pct)}>
                    <i style={{ width: `${Math.min(100, dados.meta_mes.realizado_pct)}%` }} />
                  </div>
                </div>
              )}
              {pc && pc.total > 0 && (
                <div className="db-prog">
                  <span>Produção concluída · {pc.concluidas}/{pc.total}</span>
                  <div className="in-barra" role="progressbar" aria-label="Produção concluída" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pcPct}>
                    <i className="db-ok" style={{ width: `${pcPct}%` }} />
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
