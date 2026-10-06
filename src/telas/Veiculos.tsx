// Veículos — desenho v4 (tela 08), Onda D. Só leitura. Aba da Oficina, ao lado das ordens de serviço.
// Rota GET /api/app/veiculos (formato fechado pela sessão ERP da Onda D, tabela vehicles do OficinaAuto).
// Tocar no veículo abre o histórico de OS dele (busca ao expandir); tocar numa OS abre o detalhe (tela 03).
// O ERP não guarda marca/modelo nem o desenho da placa: o título é o tipo e o desenho sai do formato da placa.
// Tocar no veículo abre o histórico de OS dele (HISTORICO_VEICULO, rota do ERP #8635).
// "Km registrado" (no cartão aberto): leituras do cadastro e da entrada de cada OS, da mais nova para a mais antiga,
// com a diferença para a anterior. Aparece só quando o ERP manda km_cadastro (ERP #8732).
// "Editar" (dentro do cartão aberto) abre o formulário do cadastro em modo edição (EDITAR_VEICULO + pode_editar).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AGENDA_OFICINA, api, EDITAR_VEICULO, ErroApi, HISTORICO_VEICULO, NOVO_VEICULO, REVISAO_KM, type HistoricoVeiculo, type ListaVeiculos, type VeiculoResumo } from '../api';
import { reais } from './Pedidos';
import { textoKm } from './OsDetalhe';

/** Linha de baixo do cartão: "48.312 km · 2019/2020 · Branco", pulando o que vier vazio. */
export function textoVeiculo(v: Pick<VeiculoResumo, 'km' | 'ano' | 'cor'>): string {
  return [textoKm(v.km), v.ano, v.cor].filter(Boolean).join(' · ');
}

/** Data curta do histórico: "12/06". */
export const dataOs = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Data com ano para o km: "12/06/26". */
export const dataKm = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`;

/** Aviso de revisão do cartão (ERP #8750): atrasada (passou do km), próxima (dentro do aviso do ERP) ou nada. Sem km conhecido
 *  não há como saber: nada. Conta só pelo km real anotado (decisão [W]). */
export function situacaoRevisao(v: Pick<VeiculoResumo, 'km' | 'proxima_revisao_km'>, aviso: number): { tom: 'danger' | 'warn'; texto: string } | null {
  if (v.proxima_revisao_km == null || v.km == null) return null;
  const falta = v.proxima_revisao_km - v.km;
  if (falta <= 0) return { tom: 'danger', texto: falta === 0 ? 'Revisão agora' : `Revisão atrasada ${Math.abs(falta).toLocaleString('pt-BR')} km` };
  if (falta <= aviso) return { tom: 'warn', texto: `Revisão em ${falta.toLocaleString('pt-BR')} km` };
  return null;
}

export interface LeituraKm { data: string | null; origem: string; km: number; diferenca: number | null }

/** Leituras de km do veículo: o cadastro e cada OS com km, em ordem de data (sem data = cadastro, a mais antiga),
 *  devolvidas da mais nova para a mais antiga, com a diferença para a leitura anterior. Km menor que o anterior
 *  aparece com diferença negativa (o ERP aceita; o app não corrige). */
export function leiturasKm(h: HistoricoVeiculo): LeituraKm[] {
  const base: Array<Omit<LeituraKm, 'diferenca'>> = [];
  if (h.km_cadastro !== null && h.km_cadastro !== undefined) base.push({ data: h.cadastrado_em ?? null, origem: 'Cadastro', km: h.km_cadastro });
  for (const o of h.itens) if (o.km !== null && o.km !== undefined) base.push({ data: o.data, origem: o.numero, km: o.km });
  const ordem = base.map((l, i) => ({ l, i })).sort((a, b) => {
    const da = a.l.data ?? '', db = b.l.data ?? '';
    return da === db ? (a.l.origem === 'Cadastro' ? -1 : b.l.origem === 'Cadastro' ? 1 : a.i - b.i) : da < db ? -1 : 1;
  }).map((x) => x.l);
  return ordem.map((l, i) => ({ ...l, diferenca: i === 0 ? null : l.km - ordem[i - 1].km })).reverse();
}

/** "+3.120 km" / "−500 km" / null. */
export function textoDiferenca(d: number | null): string | null {
  if (d === null) return null;
  return (d >= 0 ? '+' : '−') + Math.abs(d).toLocaleString('pt-BR') + ' km';
}

/** Desenho da placa pelo formato: antiga = 3 letras + 4 números (com ou sem hífen); o resto ganha o desenho Mercosul. */
export function placaAntiga(placa: string): boolean {
  return /^[A-Z]{3}-?[0-9]{4}$/.test(placa.trim().toUpperCase());
}

/** Placa no desenho certo: Mercosul ganha a faixa azul; a antiga, não. */
export function Placa({ placa }: { placa: string }) {
  return <span className={'os-placa' + (placaAntiga(placa) ? ' antiga' : '')} aria-label={`Placa ${placa}`}>{placa}</span>;
}

interface Props { voltar?: ReactNode; abas: ReactNode; aoAbrirOs: (id: number) => void; aoNovo?: () => void; aoEditar?: (id: number) => void; aoAgendar?: (v: VeiculoResumo) => void }

export function Veiculos({ voltar, abas, aoAbrirOs, aoNovo, aoEditar, aoAgendar }: Props) {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [dados, setDados] = useState<ListaVeiculos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [historico, setHistorico] = useState<Record<number, HistoricoVeiculo | 'erro'>>({});
  const [soRevisao, setSoRevisao] = useState(false);

  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t); }, [texto]);

  const carregar = useCallback(async (busca: string, revisao: boolean) => {
    setDados(null); setErro(null);
    try { setDados(await api.veiculos(1, busca, revisao)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso aos veículos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(q, soRevisao); }, [q, soRevisao, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.veiculos(dados.pagina + 1, q, soRevisao);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const alternar = (id: number) => {
    const abrir = aberto !== id;
    setAberto(abrir ? id : null);
    if (abrir && !historico[id]) {
      api.veiculoOs(id).then((h) => setHistorico((x) => ({ ...x, [id]: h }))).catch(() => setHistorico((x) => ({ ...x, [id]: 'erro' })));
    }
  };

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{dados ? `${dados.total} ${dados.total === 1 ? 'veículo' : 'veículos'}` : 'Oficina'}</div>
            <div className="pd-titulo">Veículos</div>
          </div>
          {NOVO_VEICULO && aoNovo && dados?.pode_criar && <button className="oi-btn primary nos-nova" onClick={aoNovo}>+ Veículo</button>}
        </div>
        {abas}
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Placa, tipo ou dono" aria-label="Buscar veículo" enterKeyHint="search" />
          </label>
          {REVISAO_KM && (soRevisao || (dados?.revisao_proxima ?? 0) > 0) && (
            <div className="pd-chips" role="tablist" aria-label="Filtro de revisão">
              <button role="tab" aria-selected={!soRevisao} className={'pd-chip' + (!soRevisao ? ' on' : '')} onClick={() => setSoRevisao(false)}>Todos</button>
              <button role="tab" aria-selected={soRevisao} className={'pd-chip' + (soRevisao ? ' on' : '')} onClick={() => setSoRevisao(true)}>
                Revisão próxima{dados?.revisao_proxima !== undefined && <span>{dados.revisao_proxima}</span>}
              </button>
            </div>
          )}
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            soRevisao
              ? <div className="p4-vazio"><b>Nenhuma revisão próxima</b><span>Os veículos perto do km da próxima revisão aparecem aqui.</span></div>
              : <div className="p4-vazio"><b>Nenhum veículo encontrado</b><span>{q ? 'Tente outra placa, modelo ou cliente.' : 'Os veículos atendidos pela oficina aparecem aqui.'}</span></div>
          )}
          {dados?.itens.map((v) => {
            const estaAberto = aberto === v.id;
            const h = historico[v.id];
            const meta = textoVeiculo(v);
            const rev = REVISAO_KM ? situacaoRevisao(v, dados.revisao_aviso_km ?? 1000) : null;
            return (
              <div key={v.id} className="pd-card vei-card">
                {(() => {
                  const conteudo = (<>
                  <span className="vei-placas">
                    <Placa placa={v.placa} />
                    {v.placa_secundaria && <Placa placa={v.placa_secundaria} />}
                  </span>
                  <span className="os-texto">
                    <b>{v.descricao ?? 'Veículo'}{v.placa_secundaria && <span className="vei-reboque"> + reboque</span>}</b>
                    <small>{v.cliente ?? 'Sem dono cadastrado'}</small>
                    {meta && <small className="vei-meta">{meta}</small>}
                    {rev && <span className={'p4-pill vei-rev ' + rev.tom}>{rev.texto}</span>}
                  </span>
                  {HISTORICO_VEICULO && <span className="vei-chev" aria-hidden="true">{estaAberto ? '−' : '+'}</span>}
                  </>);
                  return HISTORICO_VEICULO
                    ? <button className="vei-topo" aria-expanded={estaAberto} onClick={() => alternar(v.id)}>{conteudo}</button>
                    : <div className="vei-topo">{conteudo}</div>;
                })()}
                {HISTORICO_VEICULO && estaAberto && (
                  <div className="vei-hist">
                    {((EDITAR_VEICULO && aoEditar && dados?.pode_editar) || (AGENDA_OFICINA && aoAgendar)) && (
                      <div className="vei-acoes">
                        {AGENDA_OFICINA && aoAgendar && <button className="oi-btn vei-editar" onClick={() => aoAgendar(v)}>Agendar revisão</button>}
                        {EDITAR_VEICULO && aoEditar && dados?.pode_editar && <button className="oi-btn vei-editar" onClick={() => aoEditar(v.id)}>Editar veículo</button>}
                      </div>
                    )}
                    <span className="p4-rotulo">Histórico de OS</span>
                    {!h && <p className="p4-legal">Carregando…</p>}
                    {h === 'erro' && <p className="p4-legal">Não foi possível carregar o histórico.</p>}
                    {h && h !== 'erro' && h.itens.length === 0 && <p className="p4-legal">Nenhuma OS para este veículo.</p>}
                    {h && h !== 'erro' && h.itens.map((x) => (
                      <button key={x.os_id} className="vei-os" onClick={() => aoAbrirOs(x.os_id)}>
                        <span className="pd-num">{x.numero}</span>
                        <span className="vei-os-t">
                          {dataOs(x.data)} · {x.etapa_rotulo ?? 'fora do fluxo'}
                          {x.cliente && x.cliente !== v.cliente && <small>{x.cliente}</small>}
                        </span>
                        <span className="vei-os-v">{x.valor === null ? '—' : reais(x.valor)}</span>
                      </button>
                    ))}
                    {h && h !== 'erro' && 'km_cadastro' in h && (() => {
                      const ls = leiturasKm(h);
                      return (
                        <div className="vei-km">
                          <span className="p4-rotulo">Km registrado</span>
                          {ls.length === 0 && <p className="p4-legal">Nenhum km registrado.</p>}
                          {ls.map((l, i) => (
                            <div key={l.origem + i} className="vei-km-l">
                              <span className="vei-km-d">{l.data ? dataKm(l.data) : '—'}<small>{l.origem}</small></span>
                              <span className="vei-km-v"><b>{textoKm(l.km)}</b>{l.diferenca !== null && <small className={l.diferenca < 0 ? 'neg' : undefined}>{textoDiferenca(l.diferenca)}</small>}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
        </div>
      </div>
    </>
  );
}
