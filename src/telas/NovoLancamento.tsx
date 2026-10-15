// Novo lançamento do Financeiro (tela 06, "+ Novo"). Nasce em aberto; baixar fica na tela 15 (Pagamentos).
// Regras, validação e corpo em ../lancamento-regras. Cliente/fornecedor vem da mesma rota da tela Pessoas.
import { useEffect, useRef, useState } from 'react';
import { api, camposDoErro, type PessoaResumo } from '../api';
import { FORMAS_PADRAO, lerValor } from '../financeiro-filtros';
import { contaAnalitica, corpoLancamento, formVazio, FREQUENCIAS, MAX_PARCELAS, planosDoTipo, previaParcelas, proximaRecorrencia, REPETICOES,
  validarLancamento, type FormLancamento, type TipoLancamento } from '../lancamento-regras';
import { novaChave } from '../venda';
import { useVoltar } from '../voltar';
import { Cabecalho } from './NovaOs';

const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const br = (iso: string) => iso.split('-').reverse().join('/');
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const recuo = (codigo: string) => '   '.repeat(codigo.split('.').length - 1);

export function NovoLancamento({ tipoInicial, contas, formas, planos, aoVoltar, aoCriar, avisar }: {
  tipoInicial: TipoLancamento;
  contas: Array<{ id: number; nome: string; detalhe: string | null }>;
  formas?: string[];
  planos: Array<{ codigo: string; nome: string; tipo?: 'receita' | 'despesa' }>;
  aoVoltar: () => void;
  aoCriar: (tipo: TipoLancamento, recorrente: boolean) => void;
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
      const lado = f.tipo === 'receber' ? 'a receber' : 'a pagar';
      avisar?.(f.repeticao === 'parcelado' ? `${corpo.parcelas} parcelas ${lado} lançadas.`
        : f.repeticao === 'recorrente' ? `Conta ${lado} lançada. A recorrência está na aba Recorrências.` : `Conta ${lado} lançada.`, 'ok');
      aoCriar(f.tipo, f.repeticao === 'recorrente');
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

  const total = lerValor(f.valor);
  const nParcelas = Number(f.parcelas);
  const previa = f.repeticao === 'parcelado' && total !== null && total > 0 && /^\d{4}-\d{2}-\d{2}$/.test(f.vencimento)
    && Number.isInteger(nParcelas) && nParcelas >= 2 && nParcelas <= MAX_PARCELAS ? previaParcelas(total, f.vencimento, nParcelas) : null;
  const dia = Number(f.dia_geracao);
  const proxima = f.repeticao === 'recorrente' && /^\d{4}-\d{2}-\d{2}$/.test(f.vencimento) && Number.isInteger(dia) && dia >= 1 && dia <= 28
    ? proximaRecorrencia(f.vencimento, f.frequencia, dia, f.termino || null, hojeLocal()) : undefined;
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
              <label htmlFor="nl-valor">{f.repeticao === 'parcelado' ? 'Valor total (R$)' : f.repeticao === 'recorrente' ? 'Valor de cada (R$)' : 'Valor (R$)'}</label>
              <input id="nl-valor" inputMode="decimal" value={f.valor} onChange={(e) => mudar('valor', e.target.value)} placeholder="0,00" {...inv('valor')} />
            </div>
            <div className="p4-campo">
              <label htmlFor="nl-venc">{f.repeticao === 'unico' ? 'Vencimento' : '1º vencimento'}</label>
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
            <label id="nl-l-rep">Repetição</label>
            <div className="np-seg tres" role="radiogroup" aria-labelledby="nl-l-rep">
              {REPETICOES.map((r) => (
                <button key={r.id} role="radio" aria-checked={f.repeticao === r.id} className={f.repeticao === r.id ? 'on' : ''} onClick={() => mudar('repeticao', r.id)}>{r.label}</button>
              ))}
            </div>
          </div>
          {f.repeticao === 'parcelado' && (
            <div className="nl-rep">
              <div className="p4-campo">
                <label htmlFor="nl-parcelas">Número de parcelas</label>
                <input id="nl-parcelas" inputMode="numeric" value={f.parcelas} onChange={(e) => mudar('parcelas', e.target.value.replace(/\D/g, ''))} {...inv('parcelas')} />
                {erro('parcelas')}
              </div>
              {previa ? (
                <ol className="nl-previa" aria-label="Parcelas">
                  {previa.slice(0, 6).map((p) => <li key={p.numero}><span>{p.numero}/{previa.length}</span><span>{br(p.vencimento)}</span><b>{reais(p.valor)}</b></li>)}
                  {previa.length > 6 && <li className="mais"><span>…</span><span>última {br(previa[previa.length - 1].vencimento)}</span><b>{reais(previa[previa.length - 1].valor)}</b></li>}
                </ol>
              ) : <span className="np-ajuda">Informe o valor total e o 1º vencimento para ver as parcelas.</span>}
              <span className="np-ajuda">Uma parcela por mês a partir do 1º vencimento. Centavos que sobram vão para a 1ª.</span>
            </div>
          )}
          {f.repeticao === 'recorrente' && (
            <div className="nl-rep">
              <div className="p4-campo">
                <label id="nl-l-freq">Frequência</label>
                <div className="pd-chips ff-quebra" role="radiogroup" aria-labelledby="nl-l-freq">
                  {FREQUENCIAS.map((x) => (
                    <button key={x.id} role="radio" aria-checked={f.frequencia === x.id} className={'pd-chip' + (f.frequencia === x.id ? ' on' : '')}
                      onClick={() => mudar('frequencia', x.id)}>{x.label}</button>
                  ))}
                </div>
              </div>
              <div className="ff-duas">
                <div className="p4-campo">
                  <label htmlFor="nl-dia">Renova no dia</label>
                  <input id="nl-dia" inputMode="numeric" value={f.dia_geracao} onChange={(e) => mudar('dia_geracao', e.target.value.replace(/\D/g, ''))} {...inv('dia_geracao')} />
                </div>
                <div className="p4-campo">
                  <label htmlFor="nl-fim">Termina em</label>
                  <input id="nl-fim" type="date" value={f.termino} min={f.vencimento || undefined} onChange={(e) => mudar('termino', e.target.value)} {...inv('termino')} />
                </div>
              </div>
              {erro('dia_geracao')}{erro('termino')}
              <span className="np-ajuda">Renova no dia: quando o ERP cria o lançamento do próximo ciclo (1 a 28). Termina em vazio = até interromper.</span>
              {proxima && <p className="nl-proxima">Este lançamento entra agora. O próximo será criado em <b>{br(proxima.geracao)}</b>, vencendo <b>{br(proxima.vencimento)}</b>.</p>}
              {proxima === null && <p className="nl-proxima">O contrato termina antes do próximo ciclo: só este lançamento será criado.</p>}
            </div>
          )}

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
          {salvando ? 'Lançando…' : f.repeticao === 'parcelado' && previa ? `Lançar ${previa.length} parcelas`
            : f.repeticao === 'recorrente' ? 'Lançar recorrente' : f.tipo === 'receber' ? 'Lançar a receber' : 'Lançar a pagar'}
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
