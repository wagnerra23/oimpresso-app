// Veículos — desenho v4 (tela 08), Onda D. Só leitura. Aba da Oficina, ao lado das ordens de serviço.
// Rota PROVISÓRIA GET /api/app/veiculos: formato pedido ao ERP, ainda sem contrato; só a demo responde.
// Tocar no veículo abre o histórico de OS dele (busca ao expandir); tocar numa OS abre o detalhe (tela 03).
// Fora de propósito: "+ Veículo" (escrita, PR próprio).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type HistoricoVeiculo, type ListaVeiculos, type VeiculoResumo } from '../api';
import { reais } from './Pedidos';
import { textoKm } from './OsDetalhe';

/** Linha de baixo do cartão: "48.312 km · Branco", pulando o que vier vazio. */
export function textoVeiculo(v: Pick<VeiculoResumo, 'km' | 'cor'>): string {
  return [textoKm(v.km), v.cor].filter(Boolean).join(' · ');
}

/** Data curta do histórico: "12/06". */
export const dataOs = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Placa no desenho certo: Mercosul ganha a faixa azul; a antiga, não. */
export function Placa({ placa, padrao }: { placa: string; padrao?: VeiculoResumo['padrao_placa'] }) {
  return <span className={'os-placa' + (padrao === 'antiga' ? ' antiga' : '')} aria-label={`Placa ${placa}`}>{placa}</span>;
}

interface Props { voltar?: ReactNode; abas: ReactNode; aoAbrirOs: (id: number) => void }

export function Veiculos({ voltar, abas, aoAbrirOs }: Props) {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [dados, setDados] = useState<ListaVeiculos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [aberto, setAberto] = useState<number | null>(null);
  const [historico, setHistorico] = useState<Record<number, HistoricoVeiculo | 'erro'>>({});

  useEffect(() => { const t = setTimeout(() => setQ(texto.trim()), 350); return () => clearTimeout(t); }, [texto]);

  const carregar = useCallback(async (busca: string) => {
    setDados(null); setErro(null);
    try { setDados(await api.veiculos(1, busca)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso aos veículos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(q); }, [q, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.veiculos(dados.pagina + 1, q);
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
        </div>
        {abas}
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Placa, marca, modelo ou cliente" aria-label="Buscar veículo" enterKeyHint="search" />
          </label>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><b>Nenhum veículo encontrado</b><span>{q ? 'Tente outra placa, modelo ou cliente.' : 'Os veículos atendidos pela oficina aparecem aqui.'}</span></div>
          )}
          {dados?.itens.map((v) => {
            const estaAberto = aberto === v.id;
            const h = historico[v.id];
            const meta = textoVeiculo(v);
            return (
              <div key={v.id} className="pd-card vei-card">
                <button className="vei-topo" aria-expanded={estaAberto} onClick={() => alternar(v.id)}>
                  <Placa placa={v.placa} padrao={v.padrao_placa} />
                  <span className="os-texto">
                    <b>{v.modelo}</b>
                    <small>{v.cliente}</small>
                    {meta && <small className="vei-meta">{meta}</small>}
                  </span>
                  <span className="vei-chev" aria-hidden="true">{estaAberto ? '−' : '+'}</span>
                </button>
                {estaAberto && (
                  <div className="vei-hist">
                    <span className="p4-rotulo">Histórico de OS</span>
                    {!h && <p className="p4-legal">Carregando…</p>}
                    {h === 'erro' && <p className="p4-legal">Não foi possível carregar o histórico.</p>}
                    {h && h !== 'erro' && h.itens.length === 0 && <p className="p4-legal">Nenhuma OS para este veículo.</p>}
                    {h && h !== 'erro' && h.itens.map((x) => (
                      <button key={x.os_id} className="vei-os" onClick={() => aoAbrirOs(x.os_id)}>
                        <span className="pd-num">{x.numero}</span>
                        <span className="vei-os-t">{dataOs(x.data)} · {x.etapa_rotulo}</span>
                        <span className="vei-os-v">{x.valor === null ? '—' : reais(x.valor)}</span>
                      </button>
                    ))}
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
