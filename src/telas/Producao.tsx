// Produção — desenho v4 (tela 02), dados pelo contrato API-CONTRATO-v1 §5 (ERP #8495).
// Decisão [W] 2026-10-02: Produção usa as ETAPAS DA VENDA, não OPs. As 4 colunas são fixas e o
// contador de cada uma escolhe qual lista aparece embaixo. Só leitura na v1: fora do v4 de propósito
// "Gerar OP", o botão de avançar etapa, "Arte" e "Link" (mover de etapa é ação da FSM, fora da v1).
// A busca filtra no aparelho: a rota não recebe texto e devolve no máximo 50 itens por coluna
// (o `total` traz a contagem real).
import { useEffect, useState } from 'react';
import { api, COLUNAS_PRODUCAO, ErroApi, type ColunaProducao, type FilaProducao } from '../api';
import { useVoltar } from '../voltar';
import { Detalhe, reais } from './Pedidos';

const TINTA: Record<ColunaProducao, string> = {
  quote_approved: 'var(--info)', in_production: 'var(--accent)', on_hold: 'var(--warn)', ready_for_invoice: 'var(--ok)',
};
const dataCurta = (iso: string | null) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—');
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function Producao() {
  const [aberto, setAberto] = useState<number | null>(null);
  useVoltar(aberto !== null, () => setAberto(null));
  // A fila fica montada por baixo do detalhe para não recarregar nem perder a coluna escolhida.
  return (
    <>
      {aberto !== null && <Detalhe id={aberto} aoVoltar={() => setAberto(null)} />}
      <div style={{ display: aberto !== null ? 'none' : 'contents' }}><Fila aoAbrir={setAberto} /></div>
    </>
  );
}

function Fila({ aoAbrir }: { aoAbrir: (id: number) => void }) {
  const [dados, setDados] = useState<FilaProducao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [coluna, setColuna] = useState<ColunaProducao>('in_production');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    api.producao().then(setDados).catch((e) =>
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso à produção.' : e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, []);

  const termo = semAcento(busca.trim());
  const casa = (texto: string | null) => !!texto && semAcento(texto).includes(termo);
  const colunas = COLUNAS_PRODUCAO.map((id) => {
    const c = dados?.colunas.find((x) => x.id === id);
    const itens = (c?.itens ?? []).filter((p) => !termo || casa(p.cliente) || casa(p.resumo) || p.numero.includes(termo));
    return { id, rotulo: c?.rotulo ?? '', itens, total: c?.total ?? 0, recebidos: c?.itens.length ?? 0 };
  });
  const atual = colunas.find((c) => c.id === coluna)!;
  const total = dados?.colunas.reduce((a, c) => a + c.total, 0) ?? 0;
  const atrasados = dados?.colunas.reduce((a, c) => a + c.itens.filter((p) => p.atrasado).length, 0) ?? 0;
  const posicao = (id: ColunaProducao) => COLUNAS_PRODUCAO.indexOf(id);

  return (
    <>
      <div className="pd-head">
        <div className="p4-rotulo">{dados ? `${total} na fila${atrasados ? ` · ${atrasados} ${atrasados === 1 ? 'atrasado' : 'atrasados'}` : ''}` : 'Produção'}</div>
        <div className="pd-titulo">Produção</div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente ou produto" aria-label="Buscar na produção" enterKeyHint="search" />
          </label>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && (
            <>
              <div className="pr-etapas" role="tablist" aria-label="Etapa da produção">
                {colunas.map((c) => (
                  <button key={c.id} role="tab" aria-selected={coluna === c.id} className={'pr-etapa' + (coluna === c.id ? ' on' : '')} onClick={() => setColuna(c.id)}>
                    <b><i style={{ background: TINTA[c.id] }} aria-hidden="true" />{termo ? c.itens.length : c.total}</b>
                    <span>{c.rotulo}</span>
                  </button>
                ))}
              </div>
              {atual.itens.length === 0 && (
                <div className="p4-vazio"><b>{termo ? 'Nada encontrado' : 'Nenhum pedido nesta etapa'}</b>
                  <span>{termo ? 'Tente outro cliente ou produto.' : 'Tudo que estava aqui já avançou.'}</span></div>
              )}
              {atual.itens.map((p) => (
                <button key={p.id} className={'pd-card' + (p.atrasado ? ' atrasado' : '')} style={{ borderLeftColor: p.atrasado ? 'var(--danger)' : TINTA[atual.id] }} onClick={() => aoAbrir(p.id)}>
                  <span className="pd-card-l1">
                    <span className="pd-num">#{p.numero}</span>
                    <span className={'pd-prazo' + (p.atrasado ? ' atrasado' : '')}>{p.atrasado ? `atrasado · ${dataCurta(p.prazo)}` : `prazo ${dataCurta(p.prazo)}`}</span>
                  </span>
                  <span className="pd-card-l2"><b>{p.resumo ?? p.cliente}</b></span>
                  <span className="pd-card-l3"><span>{p.cliente}</span><span className="pd-valor">{reais(p.valor)}</span></span>
                  <span className="pr-pipe" aria-label={`Etapa ${posicao(atual.id) + 1} de 4`}>
                    {COLUNAS_PRODUCAO.map((id) => <i key={id} style={posicao(id) <= posicao(atual.id) ? { background: TINTA[atual.id] } : undefined} />)}
                  </span>
                </button>
              ))}
              {atual.recebidos < atual.total && <p className="p4-legal">Mostrando os {atual.recebidos} de prazo mais próximo, de {atual.total} nesta etapa.</p>}
              <p className="p4-legal">Mudar a etapa de um pedido continua no computador.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
