// Equipamentos — desenho v4 (tela 24), Onda D. Só leitura. Mora dentro de Mais (área `equipamentos`).
// Rota PROVISÓRIA GET /api/app/equipamentos: formato pedido ao ERP, ainda sem contrato; só a demo responde.
// Equipamento é bem de um cliente: veículo (placa + hodômetro) ou máquina (série + horímetro).
// Fora de propósito: "+ Novo" (tela 32, escrita) e o detalhe (tela 31, PR próprio).
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type EquipamentoResumo, type FiltroEquipamentos, type ListaEquipamentos } from '../api';

const ABAS: Array<{ id: FiltroEquipamentos; label: string }> = [
  { id: 'todos', label: 'Todos' }, { id: 'veiculo', label: 'Veículos' }, { id: 'equipamento', label: 'Equipamentos' },
];

/** Título do cartão: "Scania R 450 · Vermelhão". */
export const nomeEquipamento = (e: Pick<EquipamentoResumo, 'nome' | 'apelido'>): string => (e.apelido ? `${e.nome} · ${e.apelido}` : e.nome);

/** Linha de baixo: "184.523 km · 2019", pulando o que vier vazio. */
export function textoMedida(e: Pick<EquipamentoResumo, 'medida' | 'unidade' | 'ano'>): string {
  return [e.medida === null ? null : `${e.medida.toLocaleString('pt-BR')} ${e.unidade}`, e.ano ? String(e.ano) : null].filter(Boolean).join(' · ');
}

/** Cabeçalho: "6 vinculados a clientes". */
export const rotuloEquipamentos = (total: number): string => `${total} ${total === 1 ? 'vinculado' : 'vinculados'} a clientes`;

export function Equipamentos({ voltar }: { voltar?: ReactNode }) {
  const [tipo, setTipo] = useState<FiltroEquipamentos>('todos');
  const [dados, setDados] = useState<ListaEquipamentos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async (t: FiltroEquipamentos) => {
    setDados(null); setErro(null);
    try { setDados(await api.equipamentos(t)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso aos equipamentos.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(tipo); }, [tipo, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.equipamentos(tipo, dados.pagina + 1);
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
            <div className="p4-rotulo">{c ? rotuloEquipamentos(c.todos) : 'Frota e máquinas'}</div>
            <div className="pd-titulo">Equipamentos</div>
          </div>
        </div>
        <div className="p4-abas eq-abas" role="tablist" aria-label="Tipo de equipamento">
          {ABAS.map((a) => (
            <button key={a.id} role="tab" aria-selected={tipo === a.id} className={tipo === a.id ? 'on' : undefined} onClick={() => setTipo(a.id)}>
              {a.label}{c && <span className="eq-conta"> {c[a.id]}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><b>Nada cadastrado aqui</b><span>{tipo === 'todos' ? 'Veículos e máquinas dos clientes aparecem aqui.' : 'Troque o tipo para ver os outros.'}</span></div>
          )}
          {dados && dados.itens.length > 0 && (
            <div className="p4-lista">
              {dados.itens.map((e) => {
                const medida = textoMedida(e);
                return (
                  <div key={e.id} className="eq-linha">
                    {e.tipo === 'veiculo' && e.placa
                      ? <span className="eq-placa" aria-label={`Placa ${e.placa}`}>{e.placa}</span>
                      : <span className="eq-serie" aria-label={e.serie ? `Série ${e.serie}` : 'Sem número de série'}>{e.serie ?? 's/ série'}</span>}
                    <span className="eq-texto">
                      <b>{nomeEquipamento(e)}</b>
                      <small>{[e.categoria, e.dono].filter(Boolean).join(' · ')}</small>
                      {medida && <small className="eq-medida">{medida}</small>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
        </div>
      </div>
    </>
  );
}
