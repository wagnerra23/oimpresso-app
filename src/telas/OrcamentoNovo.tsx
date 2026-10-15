// P4 · orçamento rápido — "+ Novo" em Orçamentos (tela 04, Mobile Propostas #p4; ERP PR 16).
// REGRA MESTRE (valor): o app NUNCA calcula. Material e medidas vão ao ERP (POST /orcamentos/calcular, 500 ms depois
// da última digitação); enquanto ele não responde a caixa mostra "calculando no ERP…". Área, preço do m² e total são os
// números devolvidos, só formatados. "Salvar" manda em `total_previsto` o total que está na tela; o ERP recalcula e
// recusa (422) se divergir — nada é gravado. Offline trava (sem fila). Um item por orçamento: o app não soma itens.
// Fora deste PR: "Enviar no WhatsApp" (P5), acabamento, instalação, desconto e produto composto (continuam na web).
import { useEffect, useRef, useState } from 'react';
import { api, camposDoErro, type CalculoOrcamento, type MaterialOrcamento, type OrcamentoCriado, type PessoaResumo } from '../api';
import {
  assinaturaCalculo, assinaturaOrcamento, camposDaTela, corpoCalculo, corpoOrcamento, errosMedidas, resumoCalculo, totalMudou,
  type Medidas,
} from '../orcamento-regras';
import { novaChave } from '../venda';
import { useVoltar } from '../voltar';
import { Folha } from './VendaRapida';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
const statusDe = (e: unknown) => (e as { status?: number } | null)?.status ?? 0;
const codigoDe = (e: unknown) => (e as { codigo?: string } | null)?.codigo ?? '';
const voltarSvg = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
/** Espera depois da última digitação antes de perguntar ao ERP (contrato da tela 04). */
export const DEBOUNCE_CALCULO_MS = 500;

type Calc = { sig: string; estado: 'calculando' } | { sig: string; estado: 'ok'; valor: CalculoOrcamento } | { sig: string; estado: 'erro'; msg: string };

export function OrcamentoNovo({ aoVoltar, aoSalvar, avisar, online }: {
  aoVoltar: () => void; aoSalvar: (o: OrcamentoCriado) => void; avisar: Aviso; online: boolean;
}) {
  const [materiais, setMateriais] = useState<MaterialOrcamento[] | null>(null);
  const [erroMateriais, setErroMateriais] = useState<string | null>(null);
  const [material, setMaterial] = useState<number | null>(null);
  const [m, setM] = useState<Medidas>({ largura: '', altura: '', quantidade: '1' });
  const [cliente, setCliente] = useState<PessoaResumo | null>(null);
  const [escolherCliente, setEscolherCliente] = useState(false);
  const [calc, setCalc] = useState<Calc | null>(null);
  const [errosErp, setErrosErp] = useState<ReturnType<typeof camposDaTela>>({});
  const [salvando, setSalvando] = useState(false);
  const [feito, setFeito] = useState<OrcamentoCriado | null>(null);
  const travado = useRef(false);
  const chave = useRef<{ sig: string; valor: string } | null>(null);
  // Força um novo /calcular com as mesmas medidas (depois do 422 "o total mudou").
  const [recalcular, setRecalcular] = useState(0);

  useVoltar(escolherCliente, () => setEscolherCliente(false));

  useEffect(() => {
    let vivo = true;
    api.materiaisOrcamento()
      .then((r) => { if (vivo) { setMateriais(r.itens); if (r.itens.length === 1) setMaterial(r.itens[0].id); } })
      .catch((e) => {
        if (!vivo) return;
        setMateriais([]);
        setErroMateriais(codigoDe(e) === 'sem_permissao' ? 'Seu usuário não pode fazer orçamentos.'
          : codigoDe(e) === 'sem_configuracao' ? 'Nenhum material ativo no ERP. Cadastre na calculadora da web.'
            : e instanceof Error ? e.message : 'Não foi possível carregar os materiais.');
      });
    return () => { vivo = false; };
  }, []);

  const corpo = corpoCalculo(material, m);
  const sig = corpo ? assinaturaCalculo(corpo) : '';

  // Debounce: cada mudança cancela o pedido anterior; resposta de assinatura antiga é descartada.
  useEffect(() => {
    if (!corpo) { setCalc(null); return; }
    if (!online) { setCalc({ sig, estado: 'erro', msg: 'Sem conexão. O cálculo é feito no ERP.' }); return; }
    let vivo = true;
    setCalc({ sig, estado: 'calculando' });
    const t = window.setTimeout(() => {
      api.calcularOrcamento(corpo)
        .then((valor) => { if (vivo) setCalc({ sig, estado: 'ok', valor }); })
        .catch((e) => {
          if (!vivo) return;
          const campos = camposDoErro(e);
          if (Object.keys(campos).length) setErrosErp(camposDaTela(campos));
          setCalc({ sig, estado: 'erro', msg: codigoDe(e) === 'sem_permissao' ? 'Seu usuário não pode fazer orçamentos.'
            : statusDe(e) === 429 ? 'Muitos cálculos seguidos. Espere um instante.'
              : e instanceof Error ? e.message : 'O ERP não calculou. Tente de novo.' });
        });
    }, DEBOUNCE_CALCULO_MS);
    return () => { vivo = false; window.clearTimeout(t); };
    // `corpo` muda de identidade a cada render; `sig` é o conteúdo dele.
  }, [sig, online, recalcular]);

  const mudar = (k: keyof Medidas, v: string) => {
    setM((x) => ({ ...x, [k]: v }));
    setErrosErp((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const atual = calc && calc.sig === sig ? calc : null;
  const pronto = atual?.estado === 'ok' ? atual.valor : null;
  const resumo = pronto ? resumoCalculo(pronto) : null;
  const errosFormato = errosMedidas(m);
  const erroDe = (k: keyof Medidas) => errosFormato[k] ?? errosErp[k];

  const salvar = async () => {
    if (travado.current || !corpo || !pronto) return;
    if (!online) { avisar('Sem conexão. O orçamento precisa de internet.', 'warn'); return; }
    const envio = corpoOrcamento(cliente?.id ?? null, corpo, pronto);
    if (!envio) { avisar('O ERP devolveu um total fora do formato. Toque em Salvar de novo depois de recalcular.', 'erro'); setRecalcular((x) => x + 1); return; }
    travado.current = true; setSalvando(true);
    const s = assinaturaOrcamento(envio);
    if (chave.current?.sig !== s) chave.current = { sig: s, valor: novaChave() };
    try {
      const o = await api.criarOrcamento(envio, chave.current.valor);
      chave.current = null;
      setFeito(o);
    } catch (e) {
      const st = statusDe(e), cod = codigoDe(e), campos = camposDoErro(e);
      // Rede, 5xx e 409 mantêm a chave: o reenvio não cria um 2º orçamento.
      if (st >= 400 && st < 500 && st !== 409) chave.current = null;
      if (st === 409 || cod === 'em_andamento') {
        avisar('Este orçamento ainda está sendo gravado. Aguarde um instante e toque em Salvar de novo.', 'warn');
      } else if (cod === 'idempotencia_conflito') {
        avisar('O orçamento mudou durante o envio. Confira e toque em Salvar de novo.', 'warn');
      } else if (totalMudou(campos)) {
        avisar('O total mudou no ERP. Confira o valor novo e toque em Salvar de novo.', 'warn');
        setRecalcular((x) => x + 1);
      } else if (st === 422 && Object.keys(campos).length) {
        setErrosErp(camposDaTela(campos));
        avisar(Object.values(campos)[0], 'erro');
      } else if (st === 403 || cod === 'sem_permissao') {
        avisar(e instanceof Error && e.message ? e.message : 'Seu usuário não pode criar orçamentos.', 'erro');
      } else if (st === 0 || st >= 500) {
        avisar('Não foi possível salvar. Toque em Salvar de novo: ele não será gravado duas vezes.', 'erro');
      } else {
        avisar(e instanceof Error ? e.message : 'Não foi possível salvar o orçamento.', 'erro');
      }
    } finally { travado.current = false; setSalvando(false); }
  };

  if (feito) {
    return (
      <>
        <div className="pd-dhead">
          <button className="pd-voltar" onClick={() => aoSalvar(feito)} aria-label="Voltar para orçamentos">{voltarSvg}</button>
          <div style={{ flex: 1, minWidth: 0 }}><div className="p4-rotulo">Rascunho · {feito.numero}</div><div className="pd-dtitulo">Orçamento salvo</div></div>
        </div>
        <div className="oi-scroll">
          <div className="vr-feita" role="status">
            <div className="vr-ok" aria-hidden="true">✓</div>
            <span className="vr-feita-t">{feito.numero}</span>
            <span className="vr-feita-v">{feito.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            <span className="vr-feita-s">Salvo como rascunho{cliente ? ` · ${cliente.nome}` : ''}. Valor gravado pelo ERP.</span>
            <button className="p4-cta" onClick={() => aoSalvar(feito)}>Ver orçamentos</button>
          </div>
        </div>
      </>
    );
  }

  const fonte = !corpo ? 'informe material e medidas'
    : atual?.estado === 'erro' ? atual.msg
      : pronto ? 'valor devolvido pelo ERP' : 'calculando no ERP…';

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para orçamentos" disabled={salvando}>{voltarSvg}</button>
        <div style={{ flex: 1, minWidth: 0 }}><div className="p4-rotulo">Rascunho</div><div className="pd-dtitulo">Novo orçamento</div></div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo np-form">
          <div className="p4-rotulo">Cliente</div>
          <button className="or-cliente" onClick={() => setEscolherCliente(true)} disabled={salvando}>
            <span style={{ flex: 1, minWidth: 0 }}><b>{cliente ? cliente.nome : 'Sem cliente'}</b>{!cliente && <small>Opcional</small>}</span>
            <span className="or-trocar">{cliente ? 'Trocar' : 'Escolher'}</span>
          </button>
          {errosErp.cliente && <span className="np-erro">{errosErp.cliente}</span>}

          <div className="p4-rotulo">Produto</div>
          {materiais === null && <p className="p4-legal">Carregando…</p>}
          {erroMateriais && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erroMateriais}</span></div>}
          {materiais && materiais.length > 0 && (
            <div className="or-mats" role="radiogroup" aria-label="Material">
              {materiais.map((x) => (
                <button key={x.id} role="radio" aria-checked={material === x.id} className={'or-mat' + (material === x.id ? ' on' : '')}
                  onClick={() => { setMaterial(x.id); setErrosErp((e) => { const n = { ...e }; delete n.material; return n; }); }} disabled={salvando}>
                  <span className="or-mat-n">{x.nome}</span>
                  <span className="or-mat-p">{x.preco_m2.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²</span>
                </button>
              ))}
            </div>
          )}
          {errosErp.material && <span className="np-erro">{errosErp.material}</span>}

          <div className="p4-rotulo">Medidas</div>
          <div className="or-medidas">
            {([['largura', 'Largura m', 'decimal'], ['altura', 'Altura m', 'decimal'], ['quantidade', 'Qtd', 'numeric']] as const).map(([k, rot, modo]) => (
              <div key={k} className="p4-campo">
                <label htmlFor={'or-' + k}>{rot}</label>
                <input id={'or-' + k} inputMode={modo} value={m[k]} onChange={(e) => mudar(k, e.target.value)} disabled={salvando}
                  placeholder={k === 'quantidade' ? '1' : '0,00'} aria-invalid={!!erroDe(k)} aria-describedby={erroDe(k) ? 'or-e-' + k : undefined} />
                {erroDe(k) && <span id={'or-e-' + k} className="np-erro">{erroDe(k)}</span>}
              </div>
            ))}
          </div>

          <div className="or-resumo" aria-live="polite" aria-busy={!!corpo && !pronto && atual?.estado !== 'erro'}>
            <div className="or-linha"><span>Área</span><b>{resumo ? resumo.area : '—'}</b></div>
            <div className="or-linha"><span>Preço do m²</span><b>{resumo ? resumo.precoM2 : '—'}</b></div>
            <div className="or-sep" />
            <div className="or-linha or-total"><span>Total</span><b>{resumo ? resumo.total : corpo && atual?.estado !== 'erro' ? '…' : '—'}</b></div>
            <span className={'or-fonte' + (corpo && !pronto ? ' pend' : '')}>{fonte}</span>
          </div>
          <p className="p4-legal">O app manda produto e medidas; o ERP calcula (mesma conta da calculadora da web) e devolve. Acabamento, instalação e desconto continuam no computador.</p>
        </div>
      </div>
      <div className="pd-rodape">
        <button className="p4-cta" onClick={salvar} disabled={!online || !pronto || salvando} aria-busy={salvando}>
          {salvando ? 'Salvando no ERP…' : 'Salvar rascunho'}
        </button>
        {!online && <span className="pd-rodape-nota">Sem conexão. O orçamento precisa de internet.</span>}
      </div>

      {escolherCliente && <BuscaCliente aoFechar={() => setEscolherCliente(false)}
        aoEscolher={(p) => { setCliente(p); setErrosErp((e) => { const n = { ...e }; delete n.cliente; return n; }); setEscolherCliente(false); }} />}
    </>
  );
}

function BuscaCliente({ aoFechar, aoEscolher }: { aoFechar: () => void; aoEscolher: (p: PessoaResumo | null) => void }) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<PessoaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    setErro(null);
    const t = window.setTimeout(() => {
      api.pessoas('clientes', 1, q.trim())
        .then((r) => { if (vivo) setLista(r.itens); })
        .catch((e) => { if (vivo) { setLista([]); setErro(e instanceof Error ? e.message : 'Não foi possível buscar.'); } });
    }, q ? 300 : 0);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [q]);

  return (
    <Folha titulo="Cliente do orçamento" aoFechar={aoFechar}>
      <div className="p4-campo">
        <label htmlFor="or-q" className="sr-only">Nome do cliente</label>
        <input id="or-q" type="search" placeholder="Nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} autoFocus enterKeyHint="search" />
      </div>
      <div className="vr-catalogo">
        <button className="vr-prod" onClick={() => aoEscolher(null)}><span style={{ flex: 1, minWidth: 0 }}><b>Sem cliente</b><small>Escolha depois, na web</small></span></button>
        {lista === null && <p className="p4-legal">Carregando…</p>}
        {erro && <p className="np-erro">{erro}</p>}
        {lista && !erro && !lista.length && <p className="p4-legal">Nenhum cliente encontrado.</p>}
        {lista?.map((p) => (
          <button key={p.id} className="vr-prod" onClick={() => aoEscolher(p)}>
            <span style={{ flex: 1, minWidth: 0 }}><b>{p.nome}</b>{p.tipo && <small>{p.tipo === 'PJ' ? 'Empresa' : 'Pessoa física'}</small>}</span>
          </button>
        ))}
      </div>
    </Folha>
  );
}
