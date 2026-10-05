// Venda rápida — tela 11 do v4 (s11): busca de produto → carrinho → pagamento → venda registrada.
// Mexe em VALOR e ESTOQUE (regra mestre Tier 0). O app não calcula preço, desconto nem imposto: o total do
// carrinho é só prévia, e a tela de conclusão mostra o total que o ERP gravou. Contra venda duplicada, o botão
// trava enquanto envia e cada tentativa leva uma Idempotency-Key que só muda quando o carrinho ou o método mudam.
// Fora de propósito: câmera e leitor de código de barras (ADR 0383); "Imprimir" e "Enviar no WhatsApp" do
// recibo (não estão no contrato); escolher cliente (a venda sai no consumidor final do ERP); Boleto (fora da v1, decisão [W] em 2026-10-02).
// Contrato fechado com a sessão ERP da tela 11 (ver api.ts); o ERP recalcula preço e total e recusa (422) se divergir.
import { useEffect, useRef, useState } from 'react';
import { api, camposDoErro, type VendaCriada } from '../api';
import { useVoltar } from '../voltar';
import { reais } from './Pedidos';
import {
  assinatura, corpoVenda, errosPorItem, METODOS, mudarQtd, novaChave, podeSomar, previa, subtotal, temPreco, unidades,
  type ItemCarrinho, type MetodoPagamento, type ProdutoVenda,
} from '../venda';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
const statusDe = (e: unknown) => (e as { status?: number } | null)?.status ?? 0;
const codigoDe = (e: unknown) => (e as { codigo?: string } | null)?.codigo ?? '';
const itensTxt = (n: number) => n + (n === 1 ? ' item' : ' itens');
const quando = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
};
const voltarSvg = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;

export function VendaRapida({ aoVoltar, avisar, online }: { aoVoltar: () => void; avisar: Aviso; online: boolean }) {
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [sheet, setSheet] = useState<'busca' | 'pag' | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento>('pix');
  const [enviando, setEnviando] = useState(false);
  const [feita, setFeita] = useState<VendaCriada | null>(null);
  const [erroItem, setErroItem] = useState<Record<number, string>>({});
  // Trava síncrona: dois toques no mesmo quadro não passam pelo `enviando` (que só muda no próximo render).
  const travado = useRef(false);
  const chave = useRef<{ sig: string; valor: string } | null>(null);

  useVoltar(sheet !== null, () => { if (!enviando) setSheet(null); });

  const total = previa(itens);
  const qtd = unidades(itens);
  const mudar = (p: ProdutoVenda, d: number) => {
    setItens((c) => mudarQtd(c, p, d));
    setErroItem((e) => { const n = { ...e }; delete n[p.id]; return n; });
  };

  const confirmar = async () => {
    if (travado.current || !itens.length) return;
    if (!online) { avisar('Sem conexão. A venda precisa de internet.', 'warn'); return; }
    travado.current = true; setEnviando(true);
    const sig = assinatura(itens, metodo);
    if (chave.current?.sig !== sig) chave.current = { sig, valor: novaChave() };
    try {
      const v = await api.criarVenda(corpoVenda(itens, metodo), chave.current.valor);
      chave.current = null;
      setFeita(v); setSheet(null); setItens([]); setErroItem({});
    } catch (e) {
      const st = statusDe(e), cod = codigoDe(e);
      // Rede, 5xx e 409 (a mesma venda ainda processando) mantêm a chave: o reenvio não cria uma 2ª venda.
      if (st >= 400 && st < 500 && st !== 409) chave.current = null;
      const campos = camposDoErro(e);
      if (st === 409 || cod === 'em_andamento') {
        avisar('Esta venda ainda está sendo registrada. Aguarde um instante e toque em Confirmar de novo.', 'warn');
      } else if (cod === 'idempotencia_conflito') {
        avisar('O carrinho mudou durante o envio. Confira e toque em Confirmar de novo.', 'warn');
      } else if (cod === 'sem_local') {
        avisar('Seu usuário não tem local de venda liberado no ERP.', 'erro');
      } else if (st === 422 && Object.keys(campos).length) {
        const porItem = errosPorItem(campos, itens);
        setErroItem(porItem);
        setSheet(null);
        avisar(Object.values(campos)[0], 'erro');
      } else if (st === 403 || cod === 'sem_permissao') {
        avisar('Seu usuário não pode registrar vendas.', 'erro');
      } else if (st === 0 || st >= 500) {
        avisar('Não foi possível confirmar a venda. Toque em Confirmar de novo: ela não será registrada duas vezes.', 'erro');
      } else {
        avisar(e instanceof Error ? e.message : 'Não foi possível registrar a venda.', 'erro');
      }
    } finally { travado.current = false; setEnviando(false); }
  };

  const nova = () => { setFeita(null); setMetodo('pix'); };

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para pedidos" disabled={enviando}>{voltarSvg}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{feita || !itens.length ? 'PDV móvel' : `${itensTxt(qtd)} · ${reais(total / 100)}`}</div>
          <div className="pd-dtitulo">{feita ? 'Venda concluída' : 'Venda rápida'}</div>
        </div>
        {!feita && itens.length > 0 && <button className="vr-limpar" onClick={() => { setItens([]); setErroItem({}); }} disabled={enviando}>Limpar</button>}
      </div>

      {feita ? (
        <div className="oi-scroll">
          <div className="vr-feita" role="status">
            <div className="vr-ok" aria-hidden="true">✓</div>
            <span className="vr-feita-t">Venda registrada</span>
            <span className="vr-feita-v">{reais(feita.total)}</span>
            <span className="vr-feita-s">{itensTxt(feita.itens.reduce((a, i) => a + i.quantidade, 0))} · {feita.metodo}</span>
            <div className="vr-recibo">Recibo #{feita.numero.replace(/^#/, '')}{quando(feita.data) && ` · ${quando(feita.data)}`}</div>
            <button className="p4-cta" onClick={nova}>Nova venda</button>
          </div>
        </div>
      ) : !itens.length ? (
        <>
          <div className="oi-scroll">
            <div className="pd-corpo">
              <div className="p4-vazio"><b>Carrinho vazio</b><span>Busque o produto pelo nome ou pela categoria.</span></div>
            </div>
          </div>
          <div className="pd-rodape"><button className="p4-cta" onClick={() => setSheet('busca')}>Buscar produto</button></div>
        </>
      ) : (
        <>
          <div className="oi-scroll">
            <div className="pd-corpo">
              <div className="p4-rotulo">Carrinho · {itens.length} {itens.length === 1 ? 'produto' : 'produtos'}</div>
              <div className="p4-lista">
                {itens.map((i) => (
                  <div key={i.produto.id} className="vr-item">
                    <div className="vr-item-l">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pd-item-d">{i.produto.nome}</div>
                        <div className="pd-item-m">{reais(i.produto.preco)}</div>
                      </div>
                      <div className="vr-qtd">
                        <button aria-label={`Tirar uma unidade de ${i.produto.nome}`} onClick={() => mudar(i.produto, -1)} disabled={enviando}>−</button>
                        <span aria-live="polite" aria-label={`${i.qtd} unidades`}>{i.qtd}</span>
                        <button className="mais" aria-label={`Somar uma unidade de ${i.produto.nome}`} onClick={() => mudar(i.produto, 1)}
                          disabled={enviando || !podeSomar(itens, i.produto)}>+</button>
                      </div>
                      <span className="vr-sub">{reais(subtotal(i) / 100)}</span>
                    </div>
                    {!podeSomar(itens, i.produto) && !erroItem[i.produto.id] && <span className="np-ajuda">Limite do estoque ({i.produto.estoque}).</span>}
                    {erroItem[i.produto.id] && <span className="np-erro" role="alert">{erroItem[i.produto.id]}</span>}
                  </div>
                ))}
              </div>
              <div className="vr-total"><span>Total</span><b>{reais(total / 100)}</b></div>
              <p className="np-ajuda">Prévia. O valor final é o que o ERP registrar.</p>
              <button className="oi-btn block" style={{ minHeight: 44 }} onClick={() => setSheet('busca')} disabled={enviando}>+ Adicionar mais produtos</button>
            </div>
          </div>
          <div className="pd-rodape">
            <button className="p4-cta" onClick={() => setSheet('pag')} disabled={!online || enviando}>Cobrar {reais(total / 100)}</button>
            {!online && <span className="pd-rodape-nota">Sem conexão. A venda precisa de internet.</span>}
          </div>
        </>
      )}

      {sheet === 'busca' && <Busca itens={itens} aoFechar={() => setSheet(null)} aoEscolher={(p) => { mudar(p, 1); setSheet(null); }} />}
      {sheet === 'pag' && (
        <Folha titulo="Pagamento" aoFechar={() => { if (!enviando) setSheet(null); }} travada={enviando}>
          <div className="vr-cobrar"><span>Total a cobrar</span><b>{reais(total / 100)}</b></div>
          <div className="vr-metodos" role="radiogroup" aria-label="Forma de pagamento">
            {METODOS.map((m) => (
              <button key={m.id} role="radio" aria-checked={metodo === m.id} className={'vr-metodo' + (metodo === m.id ? ' on' : '')}
                onClick={() => setMetodo(m.id)} disabled={enviando}>
                <span style={{ flex: 1, minWidth: 0 }}><b>{m.rotulo}</b><small>{m.desc}</small></span>
                <i aria-hidden="true" />
              </button>
            ))}
          </div>
          <button className="p4-cta" onClick={confirmar} disabled={enviando || !online} aria-busy={enviando}>
            {enviando ? 'Registrando venda…' : 'Confirmar pagamento'}
          </button>
        </Folha>
      )}
    </>
  );
}

function Folha({ titulo, aoFechar, travada = false, children }: { titulo: string; aoFechar: () => void; travada?: boolean; children: React.ReactNode }) {
  return (
    <div className="vr-folha" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="vr-veu" onClick={aoFechar} />
      <div className="vr-painel">
        <span className="vr-alca" aria-hidden="true" />
        <div className="vr-folha-cab"><span>{titulo}</span><button onClick={aoFechar} disabled={travada}>Fechar</button></div>
        {children}
      </div>
    </div>
  );
}

function Busca({ itens, aoFechar, aoEscolher }: { itens: ItemCarrinho[]; aoFechar: () => void; aoEscolher: (p: ProdutoVenda) => void }) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<ProdutoVenda[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setErro(null);
    const t = window.setTimeout(() => {
      api.produtosVenda(q.trim())
        .then((r) => { if (vivo) setLista(r.itens); })
        .catch((e) => { if (vivo) { setLista([]); setErro(statusDe(e) === 403 || codigoDe(e) === 'sem_permissao' ? 'Seu usuário não pode vender.' : e instanceof Error ? e.message : 'Não foi possível buscar.'); } });
    }, q ? 300 : 0);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [q]);

  return (
    <Folha titulo="Buscar produto" aoFechar={aoFechar}>
      <div className="p4-campo">
        <label htmlFor="vr-q" className="sr-only">Nome ou categoria</label>
        <input id="vr-q" type="search" placeholder="Nome ou categoria" value={q} onChange={(e) => setQ(e.target.value)} autoFocus enterKeyHint="search" />
      </div>
      <div className="vr-catalogo">
        {lista === null && <p className="p4-legal">Carregando…</p>}
        {erro && <p className="np-erro">{erro}</p>}
        {lista && !erro && !lista.length && <p className="p4-legal">Nenhum produto encontrado.</p>}
        {lista?.map((p) => {
          const pode = podeSomar(itens, p);
          return (
            <button key={p.id} className="vr-prod" onClick={() => aoEscolher(p)} disabled={!pode}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{p.nome}</b>
                <small>{temPreco(p)
                  ? [p.categoria, p.estoque === null ? null : p.estoque > 0 ? `${p.estoque} em estoque` : 'sem estoque'].filter(Boolean).join(' · ')
                  : 'Sem preço · corrija o cadastro na web'}</small>
              </span>
              <span className="vr-prod-v">{reais(p.preco)}</span>
            </button>
          );
        })}
      </div>
    </Folha>
  );
}
