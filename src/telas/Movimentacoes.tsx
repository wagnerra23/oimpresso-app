// Movimentações — tela 29 do v4, SÓ LEITURA: saldo e histórico de uma linha do estoque (variação × loja,
// aberta pela tela 05). Contrato §9.3 (ERP #8581). Até o #8581 estar em produção a tela só existe na demo
// (DETALHE_ESTOQUE). O saldo de cada linha vem do ERP; o app não soma nada.
// Fora de propósito por enquanto: o bloco "Registrar movimento" do protótipo. No ERP não há movimento
// genérico: entrada é compra (com fornecedor e custo); saída e perda são ajuste de estoque, com valor e
// custeio FIFO; e o ajuste só diminui. Quais tipos o app pode fazer, e com qual valor, é decisão do Wagner
// pela regra mestre (estoque e valor).
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type DetalheEstoque } from '../api';
import { textoOnde, textoQtd, tomEstoque } from './Estoque';

/** Histórico com sinal: "+50 m²", "−3,6 m²". */
export const textoMovimento = (qtd: number, unidade: string | null) =>
  (qtd > 0 ? '+' : qtd < 0 ? '−' : '') + textoQtd(Math.abs(qtd), unidade);

const diaLocal = (x: Date) => `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
/** "hoje 08:10", "ontem 14:02" ou "26/09", no fuso do aparelho. */
export function quando(iso: string, agora = new Date()): string {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ontem = new Date(agora); ontem.setDate(agora.getDate() - 1);
  if (diaLocal(d) === diaLocal(agora)) return 'hoje ' + hora;
  if (diaLocal(d) === diaLocal(ontem)) return 'ontem ' + hora;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const statusDe = (e: unknown) => (e instanceof ErroApi ? e.status : (e as { status?: number } | null)?.status ?? 0);
const codigoDe = (e: unknown) => (e instanceof ErroApi ? e.codigo : (e as { codigo?: string } | null)?.codigo ?? '');

export function Movimentacoes({ id, aoVoltar }: { id: number; aoVoltar: () => void }) {
  const [dados, setDados] = useState<DetalheEstoque | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setDados(await api.estoqueDetalhe(id)); }
    catch (e) {
      setErro(codigoDe(e) === 'sem_permissao' ? 'Seu usuário não tem acesso ao estoque.'
        : statusDe(e) === 404 ? 'Item de estoque não encontrado.' : e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.estoqueDetalhe(id, dados.pagina + 1);
      setDados({ ...prox, historico: [...dados.historico, ...prox.historico] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  const item = dados?.item;
  const tom = item ? tomEstoque(item) : null;
  const rotulo = item ? [item.codigo, textoOnde(item)].filter(Boolean).join(' · ') : 'Estoque';
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          <button className="pd-voltar ms-voltar" onClick={aoVoltar} aria-label="Voltar para Estoque">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo mov-rotulo">{rotulo}</div>
            <div className="pd-titulo mov-titulo">{item?.nome ?? 'Movimentações'}</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {item && dados && (
            <>
              <div className="mov-saldo">
                <span>Saldo</span>
                <b className={'est-qtd' + (tom ? ' ' + tom : '')}>{textoQtd(item.qtd, item.unidade)}</b>
                <small className={tom === 'danger' ? 'baixo' : undefined}>
                  {item.minimo !== null ? `mín ${textoQtd(item.minimo, item.unidade)}${tom === 'danger' ? ' · baixo' : ''}` : 'sem mínimo'}
                </small>
              </div>
              <div className="p4-rotulo">Histórico</div>
              {dados.historico.length === 0
                ? <div className="p4-vazio"><b>Nenhum movimento</b><span>Ainda não houve entrada nem saída deste item nesta loja.</span></div>
                : (
                  <div className="p4-lista">
                    {dados.historico.map((m) => (
                      <div key={m.id} className="mov-linha">
                        <span className="mov-texto">
                          <b>{m.rotulo}</b>
                          {/* A referência encolhe com reticências; a data fica sempre inteira. */}
                          <small>{m.referencia && <span className="mov-ref">{m.referencia}</span>}<span className="mov-quando">{m.referencia ? '\u00a0·\u00a0' : ''}{quando(m.quando)}</span></small>
                        </span>
                        <span className="mov-valores">
                          <span className={'mov-qtd ' + (m.qtd < 0 ? 'neg' : 'pos')}>{textoMovimento(m.qtd, item.unidade)}</span>
                          <small>saldo {textoQtd(m.saldo, item.unidade)}</small>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              {dados.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
