// Fiscal — desenho v4 (tela 14), D16 Onda C. Só leitura: documentos fiscais (NF-e, NFC-e, NFS-e) por
// situação, com chave de acesso e motivo de rejeição. Ficam de fora "+ Emitir", "Consultar SEFAZ",
// "Cancelar" e "DANFE" (escrevem ou geram documento — PR próprio). Mora dentro de Mais.
// Rota GET /api/app/fiscal, contrato §10.2 (ERP #8593).
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, ErroApi, type FiltroFiscal, type ListaFiscal, type StatusFiscal } from '../api';
import { reais } from './Pedidos';

const FILTROS: Array<{ id: FiltroFiscal; label: string }> = [
  { id: 'todos', label: 'Todos' }, { id: 'rascunho', label: 'Rascunho' }, { id: 'processando', label: 'Processando' },
  { id: 'autorizado', label: 'Autorizado' }, { id: 'cancelado', label: 'Cancelado' }, { id: 'rejeitado', label: 'Rejeitado' },
];
// Mesmas cores do protótipo: rascunho cinza, processando alerta, autorizado positivo, cancelado apagado, rejeitado erro.
const STATUS: Record<StatusFiscal, { label: string; cor: string }> = {
  rascunho: { label: 'Rascunho', cor: 'var(--text-dim)' },
  processando: { label: 'Processando', cor: 'var(--warn)' },
  autorizado: { label: 'Autorizado', cor: 'var(--ok)' },
  cancelado: { label: 'Cancelado', cor: 'var(--text-dim)' },
  rejeitado: { label: 'Rejeitado', cor: 'var(--danger)' },
};
const TIPO: Record<string, string> = { NFe: 'NF-e', NFCe: 'NFC-e', NFSe: 'NFS-e' };

export function Fiscal({ voltar }: { voltar?: ReactNode }) {
  const [filtro, setFiltro] = useState<FiltroFiscal>('todos');
  const [dados, setDados] = useState<ListaFiscal | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // Troca rápida de filtro: só a resposta do pedido mais recente entra na tela.
  const pedido = useRef(0);
  const carregar = useCallback(async (f: FiltroFiscal) => {
    const n = ++pedido.current;
    setDados(null); setErro(null);
    try { const r = await api.fiscal(f); if (n === pedido.current) setDados(r); }
    catch (e) {
      if (n !== pedido.current) return;
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso ao Fiscal.' : e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, []);
  useEffect(() => { carregar(filtro); }, [filtro, carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.fiscal(filtro, dados.pagina + 1);
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
            <div className="p4-rotulo">{c ? `${c.todos} ${c.todos === 1 ? 'documento' : 'documentos'} · ${c.rejeitado} ${c.rejeitado === 1 ? 'rejeitado' : 'rejeitados'}` : 'Notas fiscais'}</div>
            <div className="pd-titulo">Fiscal</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="pd-chips" role="tablist" aria-label="Situação do documento">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && <div className="p4-vazio"><b>Nenhum documento aqui</b><span>Troque o filtro para ver outras notas.</span></div>}
          {dados?.itens.map((d) => {
            const s = STATUS[d.status];
            const nome = `${TIPO[d.tipo] ?? d.tipo} ${d.numero ? '#' + d.numero : '— sem número'}`;
            return (
              <article key={d.tipo + ':' + d.id} className="oc-card" aria-label={nome}>
                <div className="oc-l1">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{nome}</b>
                    {d.referencia && <small>{d.referencia}</small>}
                  </div>
                  <span className="oc-status" style={{ color: s.cor, borderColor: s.cor }}><i style={{ background: s.cor }} aria-hidden="true" />{s.label}</span>
                </div>
                <div className="oc-l2"><span className="oc-valor">{reais(d.valor)}</span></div>
                {d.chave && <div className="fs-chave" aria-label="Chave de acesso">{d.chave}</div>}
                {d.erro && <div className="fs-erro" role="note">{d.erro}</div>}
              </article>
            );
          })}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Emitir, consultar a SEFAZ, cancelar e abrir o DANFE continuam no computador.</p>}
        </div>
      </div>
    </>
  );
}
