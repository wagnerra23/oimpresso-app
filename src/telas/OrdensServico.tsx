// Ordens de serviço — desenho v4 (tela 07), Onda D. Só leitura. Mora dentro de Mais (área `oficina`).
// Rota GET /api/app/os (formato fechado pela sessão ERP da Onda D): a mesma lista da web
// /oficina-auto/ordens-servico — só OS ativas. As etapas (chips, rótulo e barra de progresso) vêm do
// pipeline do ERP: o app não conhece a lista de etapas. Fora desta tela de propósito: "+ Nova OS", "→ próxima etapa" e
// "Link" (são escritas, cada uma num PR próprio) e "Abrir" (o detalhe é a tela 03, PR seguinte).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type ListaOs, type OsResumo } from '../api';
import { reais } from './Pedidos';

/** Cor da etapa: travada em vermelho, última etapa do pipeline em verde, o resto no acento. */
export function tintaOs(o: Pick<OsResumo, 'travada' | 'etapa'>): string {
  if (o.travada) return 'var(--danger)';
  if (o.etapa.indice >= o.etapa.total_etapas) return 'var(--ok)';
  return 'var(--accent-text)';
}

/** Barra de progresso: um segmento por etapa do pipeline, aceso até a etapa atual. */
export function segmentosOs(e: Pick<OsResumo['etapa'], 'indice' | 'total_etapas'>): boolean[] {
  const total = Math.max(1, e.total_etapas);
  return Array.from({ length: total }, (_, i) => i < e.indice);
}

/** Linha de cima do cabeçalho, como o protótipo: "6 OS · 2 travadas". */
export function rotuloOs(d: Pick<ListaOs, 'total' | 'travadas'> | null): string {
  if (!d) return 'Oficina';
  const os = `${d.total} OS`;
  return d.travadas ? `${os} · ${d.travadas} ${d.travadas === 1 ? 'travada' : 'travadas'}` : os;
}

/** Valor da OS; sem valor ainda (antes do orçamento), travessão. */
export const valorOs = (v: number | null): string => (v === null ? '—' : reais(v));

export function OrdensServico({ voltar }: { voltar?: ReactNode }) {
  const [etapa, setEtapa] = useState('todas');
  const [dados, setDados] = useState<ListaOs | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async (e: string) => {
    setDados(null); setErro(null);
    try { setDados(await api.os(e)); }
    catch (x) { setErro(x instanceof ErroApi && x.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso às ordens de serviço.' : x instanceof Error ? x.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(etapa); }, [etapa, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.os(etapa, dados.pagina + 1);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (x) { setErro(x instanceof Error ? x.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{rotuloOs(dados)}</div>
            <div className="pd-titulo">Ordens de serviço</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {dados && (
            <div className="pd-chips" role="tablist" aria-label="Etapa da OS">
              <button role="tab" aria-selected={etapa === 'todas'} className={'pd-chip' + (etapa === 'todas' ? ' on' : '')} onClick={() => setEtapa('todas')}>
                Todas<span>{dados.total}</span>
              </button>
              {dados.etapas.filter((x) => x.total > 0 || x.chave === etapa).map((x) => (
                <button key={x.chave} role="tab" aria-selected={etapa === x.chave} className={'pd-chip' + (etapa === x.chave ? ' on' : '')} onClick={() => setEtapa(x.chave)}>
                  {x.rotulo}<span>{x.total}</span>
                </button>
              ))}
            </div>
          )}
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><b>Nenhuma OS aqui</b><span>{etapa === 'todas' ? 'As ordens de serviço da oficina aparecem aqui.' : 'Troque a etapa para ver outras OS.'}</span></div>
          )}
          {dados?.itens.map((o) => {
            const tinta = tintaOs(o);
            return (
              <div key={o.id} className="pd-card os-card" style={{ borderLeftColor: tinta }}>
                <span className="pd-card-l1">
                  <span className="pd-num">{o.numero}</span>
                  <span className="pd-status" style={{ color: tinta }}><i style={{ background: tinta }} />{o.etapa.rotulo}{o.travada && <span className="sr-only"> (travada)</span>}</span>
                </span>
                <span className="os-linha">
                  {o.placa && <span className="os-placa" aria-label={`Placa ${o.placa}`}>{o.placa}</span>}
                  <span className="os-texto">
                    <b>{o.veiculo ?? (o.placa ? 'Veículo' : 'Sem veículo')}</b>
                    <small>{o.cliente}</small>
                  </span>
                  <span className="pd-valor">{valorOs(o.valor)}</span>
                </span>
                <span className="os-pipe" role="img" aria-label={`Etapa ${o.etapa.indice} de ${o.etapa.total_etapas}`}>
                  {segmentosOs(o.etapa).map((aceso, i) => <i key={i} style={aceso ? { background: tinta } : undefined} />)}
                </span>
              </div>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && dados.itens.length > 0 && <p className="p4-legal">No app a OS é só consulta. Para abrir, mudar de etapa ou faturar, use o computador.</p>}
        </div>
      </div>
    </>
  );
}
