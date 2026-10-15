// Novo lançamento do Financeiro (tela 06, "+ Novo"). Nasce em aberto; baixar fica na tela 15 (Pagamentos).
// Regras, validação e corpo em ../lancamento-regras. Cliente/fornecedor vem da mesma rota da tela Pessoas.
import { useEffect, useRef, useState } from 'react';
import { api, camposDoErro, type PessoaResumo } from '../api';
import { FORMAS_PADRAO } from '../financeiro-filtros';
import { contaAnalitica, corpoLancamento, formVazio, planosDoTipo, validarLancamento, type FormLancamento, type TipoLancamento } from '../lancamento-regras';
import { novaChave } from '../venda';
import { useVoltar } from '../voltar';
import { Cabecalho } from './NovaOs';

const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const recuo = (codigo: string) => '   '.repeat(codigo.split('.').length - 1);

export function NovoLancamento({ tipoInicial, contas, formas, planos, aoVoltar, aoCriar, avisar }: {
  tipoInicial: TipoLancamento;
  contas: Array<{ id: number; nome: string; detalhe: string | null }>;
  formas?: string[];
  planos: Array<{ codigo: string; nome: string; tipo?: 'receita' | 'despesa' }>;
  aoVoltar: () => void;
  aoCriar: (tipo: TipoLancamento) => void;
  avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
}) {
  const [f, setF] = useState<FormLancamento>(() => formVazio(tipoInicial, hojeLocal()));
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const chave = useRef<{ sig: string; valor: string } | null>(null);
  useVoltar(buscando, () => setBuscando(false));

  const doTipo = planosDoTipo(planos, f.tipo);
  const mudar = <K extends keyof FormLancamento>(k: K, v: FormLancamento[K]) => {
    setF((x) => {
      const n = { ...x, [k]: v };
      // Competência acompanha a emissão até o usuário mexer nela.
      if (k === 'emissao' && x.competencia === x.emissao.slice(0, 7) && typeof v === 'string') n.competencia = v.slice(0, 7);
      // Trocar o lado limpa o que não serve mais: a conta do plano e a pessoa (cliente x fornecedor).
      if (k === 'tipo' && v !== x.tipo) { n.plano = ''; n.parte = null; }
      return n;
    });
    setErros((e) => { const c = { ...e }; delete c[k]; return c; });
  };

  const salvar = async () => {
    const e = validarLancamento(f, doTipo);
    setErros(e);
    if (Object.keys(e).length) return;
    const corpo = corpoLancamento(f);
    const sig = JSON.stringify(corpo);
    if (chave.current?.sig !== sig) chave.current = { sig, valor: novaChave() };
    setSalvando(true);
    try {
      await api.criarLancamento(corpo, chave.current.valor);
      chave.current = null;
      avisar?.(f.tipo === 'receber' ? 'Conta a receber lançada.' : 'Conta a pagar lançada.', 'ok');
      aoCriar(f.tipo);
    } catch (x) {
      const st = (x as { status?: number } | null)?.status ?? 0;
      // Rede, 5xx e 409 (o mesmo lançamento ainda processando) mantêm a chave: o reenvio não duplica.
      if (st >= 400 && st < 500 && st !== 409) chave.current = null;
      const campos = camposDoErro(x);
      if (Object.keys(campos).length) setErros(campos);
      avisar?.(x instanceof Error ? x.message : 'Não foi possível lançar.', 'erro');
    } finally { setSalvando(false); }
  };

  if (buscando) {
    return <BuscaParte tipo={f.tipo} aoVoltar={() => setBuscando(false)} aoEscolher={(p) => { mudar('parte', p); setBuscando(false); }} />;
  }

  const erro = (k: string) => erros[k] && <span id={'nl-e-' + k} className="np-erro">{erros[k]}</span>;
  const inv = (k: string) => ({ 'aria-invalid': !!erros[k], 'aria-describedby': erros[k] ? 'nl-e-' + k : undefined });
  return (
    <>
      <Cabecalho titulo="Novo lançamento" rotulo="Financeiro" aoVoltar={aoVoltar} />
      <div className="oi-scroll">
        <div className="pd-corpo np-form">
          <div className="np-seg" role="radiogroup" aria-label="Tipo do lançamento">
            {(['receber', 'pagar'] as const).map((t) => (
              <button key={t} role="radio" aria-checked={f.tipo === t} className={f.tipo === t ? 'on' : ''} onClick={() => mudar('tipo', t)}>
                {t === 'receber' ? 'A receber' : 'A pagar'}
              </button>
            ))}
          </div>

          <div className="p4-campo">
            <label htmlFor="nl-descricao">Descrição</label>
            <input id="nl-descricao" value={f.descricao} onChange={(e) => mudar('descricao', e.target.value)} maxLength={120}
              placeholder={f.tipo === 'receber' ? 'Ex.: Pedido #0048 · banner' : 'Ex.: Lona 440 g · 2 rolos'} {...inv('descricao')} />
            {erro('descricao')}
          </div>
          <div className="p4-campo">
            <label id="nl-l-parte">{f.tipo === 'receber' ? 'Cliente' : 'Fornecedor'}</label>
            <div className="nl-parte">
              <button className="oi-btn" aria-labelledby="nl-l-parte" onClick={() => setBuscando(true)}>
                {f.parte ? f.parte.nome : `Escolher ${f.tipo === 'receber' ? 'cliente' : 'fornecedor'}`}
              </button>
              {f.parte && <button className="p4-link" onClick={() => mudar('parte', null)}>Tirar</button>}
            </div>
            <span className="np-ajuda">Opcional. Sem pessoa, o lançamento fica só com a descrição.</span>
          </div>
          <div className="ff-duas">
            <div className="p4-campo">
              <label htmlFor="nl-valor">Valor (R$)</label>
              <input id="nl-valor" inputMode="decimal" value={f.valor} onChange={(e) => mudar('valor', e.target.value)} placeholder="0,00" {...inv('valor')} />
            </div>
            <div className="p4-campo">
              <label htmlFor="nl-venc">Vencimento</label>
              <input id="nl-venc" type="date" value={f.vencimento} min={f.emissao || undefined} onChange={(e) => mudar('vencimento', e.target.value)} {...inv('vencimento')} />
            </div>
          </div>
          {erro('valor')}{erro('vencimento')}
          <div className="ff-duas">
            <div className="p4-campo">
              <label htmlFor="nl-emissao">Emissão</label>
              <input id="nl-emissao" type="date" value={f.emissao} onChange={(e) => mudar('emissao', e.target.value)} {...inv('emissao')} />
            </div>
            <div className="p4-campo">
              <label htmlFor="nl-comp">Competência</label>
              <input id="nl-comp" type="month" value={f.competencia} onChange={(e) => mudar('competencia', e.target.value)} {...inv('competencia')} />
            </div>
          </div>
          {erro('emissao')}{erro('competencia')}

          <div className="p4-campo">
            <label htmlFor="nl-plano">Plano de contas</label>
            <select id="nl-plano" className="np-select" value={f.plano} onChange={(e) => mudar('plano', e.target.value)} {...inv('plano')}>
              <option value="">Escolha a conta</option>
              {doTipo.map((p) => (
                <option key={p.codigo} value={p.codigo} disabled={!contaAnalitica(p.codigo, doTipo)}>{recuo(p.codigo)}{p.codigo} · {p.nome}</option>
              ))}
            </select>
            {erro('plano')}
          </div>
          <div className="p4-campo">
            <label id="nl-l-forma">Forma de pagamento</label>
            <div className="pd-chips ff-quebra" role="radiogroup" aria-labelledby="nl-l-forma">
              {(formas?.length ? formas : FORMAS_PADRAO).map((x) => (
                <button key={x} role="radio" aria-checked={f.forma === x} className={'pd-chip' + (f.forma === x ? ' on' : '')}
                  onClick={() => mudar('forma', f.forma === x ? '' : x)}>{x}</button>
              ))}
            </div>
          </div>
          {contas.length > 0 && (
            <div className="p4-campo">
              <label htmlFor="nl-conta">Conta bancária</label>
              <select id="nl-conta" className="np-select" value={f.conta_id ?? ''} onChange={(e) => mudar('conta_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Sem conta definida</option>
                {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.detalhe ? ` · ${c.detalhe}` : ''}</option>)}
              </select>
            </div>
          )}
          <div className="ff-duas">
            <div className="p4-campo">
              <label htmlFor="nl-doc">Nº do documento</label>
              <input id="nl-doc" value={f.documento} onChange={(e) => mudar('documento', e.target.value)} placeholder="Opcional" />
            </div>
            <div className="p4-campo">
              <label htmlFor="nl-nf">Nº da nota fiscal</label>
              <input id="nl-nf" inputMode="numeric" value={f.nf} onChange={(e) => mudar('nf', e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <div className="p4-campo">
            <label htmlFor="nl-obs">Observação</label>
            <textarea id="nl-obs" className="nl-obs" rows={3} value={f.observacao} onChange={(e) => mudar('observacao', e.target.value)} placeholder="Opcional" />
          </div>
          <p className="p4-legal">O lançamento entra em aberto. Para dar baixa, use Pagamentos ou o oimpresso no computador.</p>
        </div>
      </div>
      <div className="np-rodape">
        <button className="oi-btn" style={{ minHeight: 44 }} disabled={salvando} onClick={aoVoltar}>Cancelar</button>
        <button className="oi-btn primary" style={{ minHeight: 44 }} disabled={salvando} onClick={salvar}>
          {salvando ? 'Lançando…' : f.tipo === 'receber' ? 'Lançar a receber' : 'Lançar a pagar'}
        </button>
      </div>
    </>
  );
}

/** Cliente (a receber) ou fornecedor (a pagar), pela mesma rota da tela Pessoas. */
function BuscaParte({ tipo, aoEscolher, aoVoltar }: { tipo: TipoLancamento; aoEscolher: (p: { id: number; nome: string }) => void; aoVoltar: () => void }) {
  const [texto, setTexto] = useState('');
  const [itens, setItens] = useState<PessoaResumo[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const quem = tipo === 'receber' ? 'cliente' : 'fornecedor';
  useEffect(() => {
    const t = setTimeout(() => {
      setErro(null);
      api.pessoas(tipo === 'receber' ? 'clientes' : 'fornecedores', 1, texto.trim()).then((r) => setItens(r.itens))
        .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível buscar.'));
    }, 350);
    return () => clearTimeout(t);
  }, [texto, tipo]);
  return (
    <>
      <Cabecalho titulo={`Escolher ${quem}`} rotulo="Novo lançamento" aoVoltar={aoVoltar} />
      <div className="oi-scroll">
        <div className="pd-corpo">
          <label className="ps-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={`Nome do ${quem}`} aria-label={`Buscar ${quem}`} enterKeyHint="search" autoFocus />
          </label>
          {erro && <div className="p4-vazio"><b>Não foi possível buscar</b><span>{erro}</span></div>}
          {!itens && !erro && <p className="p4-legal">Carregando…</p>}
          {itens && itens.length === 0 && <div className="p4-vazio"><b>Ninguém encontrado</b><span>Cadastro novo se faz em Mais → Pessoas.</span></div>}
          {itens && itens.length > 0 && (
            <div className="p4-lista">
              {itens.map((p) => (
                <button key={p.id} className="nos-linha" onClick={() => aoEscolher({ id: p.id, nome: p.nome })}>
                  <span className="os-texto"><b>{p.nome}</b>{p.tipo && <small>{p.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}</small>}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
