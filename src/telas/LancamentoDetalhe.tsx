// Detalhe do lançamento do Financeiro (tocar no cartão da tela 06). Mostra tudo do lançamento e o histórico, e traz as
// ações da situação dele (regras em ../lancamento-regras → acoesDoLancamento):
//   em aberto → Receber/Pagar, Alterar, Excluir · liquidado → Retornar a receber/pagar e Recibo · excluído → Reativar.
// Receber/Pagar aceita valor menor (parcial): o restante vira um lançamento novo, com o vencimento que a tela pergunta.
// Baixa e estorno mexem em valor (regra mestre): levam Idempotency-Key e confirmam na própria tela antes de enviar.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, camposDoErro, type LancamentoDetalhe as Detalhe } from '../api';
import { FORMAS_PADRAO } from '../financeiro-filtros';
import { acoesDoLancamento, corpoBaixa, formBaixa, formDoLancamento, restanteDaBaixa, rotuloAcao, validarBaixa,
  type AcaoLancamento, type FormBaixa } from '../lancamento-regras';
import { novaChave } from '../venda';
import { useVoltar } from '../voltar';
import { Cabecalho } from './NovaOs';
import { NovoLancamento } from './NovoLancamento';
import { reais } from './Pedidos';
import { Recibo } from './Recibo';

const br = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const mes = (iso: string | null | undefined) => (iso ? `${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '—');
const hojeLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

export function LancamentoDetalhe({ id, contas, formas, planos, aoVoltar, aoAbrir, avisar }: {
  id: number;
  contas: Array<{ id: number; nome: string; detalhe: string | null }>;
  formas?: string[];
  planos: Array<{ codigo: string; nome: string; tipo?: 'receita' | 'despesa' }>;
  aoVoltar: () => void;
  /** Abre outro lançamento (o restante de um parcial, ou de onde ele veio). */
  aoAbrir?: (id: number) => void;
  avisar?: Aviso;
}) {
  const [l, setL] = useState<Detalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [acao, setAcao] = useState<AcaoLancamento | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [alterando, setAlterando] = useState(false);
  const [vendoRecibo, setVendoRecibo] = useState(false);
  const [baixa, setBaixa] = useState<FormBaixa>(() => formBaixa({ valor: 0 }, hojeLocal()));
  const [errosBaixa, setErrosBaixa] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState('');
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const chave = useRef<{ sig: string; valor: string } | null>(null);
  useVoltar(alterando, () => setAlterando(false));
  useVoltar(vendoRecibo, () => setVendoRecibo(false));
  useVoltar(acao !== null, () => setAcao(null));

  const carregar = useCallback(() => {
    api.lancamento(id).then((x) => { setL(x); setErro(null); }).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [id]);
  useEffect(() => { carregar(); }, [carregar]);

  const mudarBaixa = <K extends keyof FormBaixa>(k: K, v: FormBaixa[K]) => {
    setBaixa((b) => ({ ...b, [k]: v }));
    setErrosBaixa((e) => { const c = { ...e }; delete c[k]; return c; });
  };

  const abrir = (a: AcaoLancamento) => {
    if (!l) return;
    setErroAcao(null);
    if (a === 'alterar') { setAlterando(true); return; }
    if (a === 'baixar') { setBaixa(formBaixa(l, hojeLocal())); setErrosBaixa({}); }
    if (a === 'excluir') setMotivo('');
    setAcao(a);
  };

  const confirmar = async () => {
    if (!l || !acao) return;
    setErroAcao(null);
    const tipo = l.tipo;
    try {
      let novo: Detalhe;
      if (acao === 'baixar') {
        const e = validarBaixa(baixa, l.valor, hojeLocal());
        setErrosBaixa(e);
        if (Object.keys(e).length) return;
        const corpo = corpoBaixa(baixa, l.valor);
        const sig = 'baixar' + JSON.stringify(corpo);
        if (chave.current?.sig !== sig) chave.current = { sig, valor: novaChave() };
        setEnviando(true);
        novo = await api.baixarLancamento(l.id, corpo, chave.current.valor);
        const feito = tipo === 'receber' ? 'Recebido' : 'Pago';
        avisar?.(corpo.vencimento_restante
          ? `${feito} ${reais(corpo.valor_pago)}. Restante de ${reais(Math.round(l.valor * 100 - corpo.valor_pago * 100) / 100)} lançado para ${br(corpo.vencimento_restante)}.`
          : `${feito} em ${br(corpo.pago_em)}.`, 'ok');
      } else if (acao === 'estornar') {
        const sig = 'estornar' + l.pago_em;
        if (chave.current?.sig !== sig) chave.current = { sig, valor: novaChave() };
        setEnviando(true);
        novo = await api.estornarLancamento(l.id, chave.current.valor);
        avisar?.(tipo === 'receber' ? 'Voltou para a receber.' : 'Voltou para a pagar.', 'ok');
      } else if (acao === 'excluir') {
        setEnviando(true);
        novo = await api.excluirLancamento(l.id, motivo.trim() || null);
        avisar?.('Lançamento excluído. Dá para reativar depois.', 'ok');
      } else {
        setEnviando(true);
        novo = await api.reativarLancamento(l.id);
        avisar?.('Lançamento reativado.', 'ok');
      }
      chave.current = null;
      setL(novo);
      setAcao(null);
    } catch (e) {
      const st = (e as { status?: number } | null)?.status ?? 0;
      // Rede e 5xx mantêm a chave: o reenvio não baixa nem estorna duas vezes.
      if (st >= 400 && st < 500) chave.current = null;
      const c = camposDoErro(e);
      if (acao === 'baixar' && Object.keys(c).length) setErrosBaixa(c);
      else setErroAcao(Object.values(c)[0] ?? (e instanceof Error ? e.message : 'Não foi possível concluir.'));
      if (st === 409) carregar();
    } finally { setEnviando(false); }
  };

  if (alterando && l) {
    return <NovoLancamento tipoInicial={l.tipo} contas={contas} formas={formas} planos={planos} avisar={avisar}
      editar={{ id: l.id, inicial: formDoLancamento({ ...l, vencimento: l.vencimento }, hojeLocal()) }}
      aoVoltar={() => setAlterando(false)} aoCriar={() => undefined}
      aoSalvar={(x) => { setL(x); setAlterando(false); }} />;
  }
  if (vendoRecibo && l) return <Recibo id={l.id} aoVoltar={() => setVendoRecibo(false)} avisar={avisar} />;

  const recebe = l?.tipo === 'receber';
  const acoes = l ? acoesDoLancamento(l) : [];
  const resto = l && acao === 'baixar' ? restanteDaBaixa(l.valor, baixa.valor) : null;
  const status = !l ? null : l.excluido ? { rotulo: 'Excluído', cor: 'var(--text-mute)' }
    : l.status === 'liquidado' ? { rotulo: recebe ? 'Recebido' : 'Pago', cor: 'var(--ok)' }
    : l.status === 'vencido' ? { rotulo: 'Vencido', cor: 'var(--danger)' } : { rotulo: 'Em aberto', cor: 'var(--text-dim)' };
  const linhas: Array<[string, string | null | undefined]> = l ? [
    [recebe ? 'Cliente' : 'Fornecedor', l.parte],
    ['Vencimento', br(l.vencimento)],
    [recebe ? 'Recebido em' : 'Pago em', l.pago_em ? br(l.pago_em) : null],
    ['Emissão', br(l.emissao)],
    ['Competência', mes(l.competencia)],
    ['Data da venda', l.venda_em ? br(l.venda_em) : null],
    ['Forma de pagamento', l.forma_pagamento],
    ['Conta bancária', l.conta_nome],
    ['Plano de contas', l.plano_codigo ? `${l.plano_codigo} · ${l.plano_nome ?? ''}` : null],
    ['Nº do documento', l.documento],
    ['Nº da nota fiscal', l.nf_numero],
    ['Nosso número', l.nosso_numero],
    ['Nº do contrato', l.contrato],
    ['Parcela', l.parcela],
  ] : [];
  const erroB = (k: string) => errosBaixa[k] && <span className="np-erro">{errosBaixa[k]}</span>;

  return (
    <>
      <Cabecalho titulo={l?.descricao ?? 'Lançamento'} rotulo={l ? `${recebe ? 'Conta a receber' : 'Conta a pagar'} · #${l.id}` : 'Financeiro'} aoVoltar={aoVoltar} />
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!l && !erro && <p className="p4-legal">Carregando…</p>}
          {l && status && (
            <>
              <section className={'ld-topo' + (l.excluido ? ' excluido' : '')} aria-label="Valor e situação">
                <span className={'ld-valor ' + (recebe ? 'pos' : 'neg')}>{recebe ? '+ ' : '− '}{reais(l.valor)}</span>
                <span className="ld-status" style={{ color: status.cor, borderColor: status.cor }}><i style={{ background: status.cor }} aria-hidden="true" />{status.rotulo}</span>
                {l.excluido && <p className="ld-nota">Excluído{l.motivo_exclusao ? `: ${l.motivo_exclusao}` : ''}. Não entra no saldo nem nos totais.</p>}
                {!l.excluido && l.status === 'liquidado' && <p className="ld-nota">{recebe ? 'Recebido' : 'Pago'} em {br(l.pago_em)}{l.conta_nome ? ` · ${l.conta_nome}` : ''}.</p>}
                {!l.excluido && l.status !== 'liquidado' && <p className="ld-nota">{l.status === 'vencido' ? 'Venceu' : 'Vence'} em {br(l.vencimento)}.</p>}
              </section>

              {(l.restante || l.origem_id) && (
                <div className="ld-vinculo">
                  {l.restante && (
                    <button className="ld-link" onClick={() => aoAbrir?.(l.restante!.id)}>
                      <span>Pagamento parcial. Restante de <b>{reais(l.restante.valor)}</b> no lançamento #{l.restante.id}, vencendo {br(l.restante.vencimento)}.</span>
                      <i aria-hidden="true">›</i>
                    </button>
                  )}
                  {l.origem_id && (
                    <button className="ld-link" onClick={() => aoAbrir?.(l.origem_id!)}>
                      <span>Restante do pagamento parcial do lançamento #{l.origem_id}.</span>
                      <i aria-hidden="true">›</i>
                    </button>
                  )}
                </div>
              )}

              <dl className="ld-dados">
                {linhas.filter(([, v]) => v).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
              {l.observacao && <div className="ld-obs"><div className="p4-rotulo">Observação</div><p>{l.observacao}</p></div>}

              <div className="p4-rotulo">Histórico</div>
              <ol className="ld-hist">
                {l.historico.map((h, i) => <li key={i}><small>{br(h.quando)}</small><span>{h.texto}</span></li>)}
              </ol>
            </>
          )}
        </div>
      </div>

      {l && acao === null && (
        <div className="ld-rodape">
          {acoes.includes('baixar') && <button className="oi-btn primary ld-principal" onClick={() => abrir('baixar')}>{rotuloAcao('baixar', l.tipo)}</button>}
          {acoes.includes('reativar') && <button className="oi-btn primary ld-principal" onClick={() => abrir('reativar')}>{rotuloAcao('reativar', l.tipo)}</button>}
          {acoes.includes('estornar') && (
            <div className="ld-secundarias">
              <button className="oi-btn primary" onClick={() => setVendoRecibo(true)}>Recibo</button>
              <button className="oi-btn" onClick={() => abrir('estornar')}>{rotuloAcao('estornar', l.tipo)}</button>
            </div>
          )}
          {(acoes.includes('alterar') || acoes.includes('excluir')) && (
            <div className="ld-secundarias">
              {acoes.includes('alterar') && <button className="oi-btn" onClick={() => abrir('alterar')}>Alterar</button>}
              {acoes.includes('excluir') && <button className="oi-btn ld-perigo" onClick={() => abrir('excluir')}>Excluir</button>}
            </div>
          )}
          {l.status === 'liquidado' && !l.excluido && <span className="ld-dica">Para alterar ou excluir, {recebe ? 'retorne a receber' : 'retorne a pagar'} primeiro.</span>}
        </div>
      )}

      {l && acao !== null && (
        <div className="ld-rodape ld-acao" role="group" aria-label={rotuloAcao(acao, l.tipo)}>
          {acao === 'baixar' && (
            <>
              <b className="ld-acao-t">{recebe ? 'Receber' : 'Pagar'} · lançamento de {reais(l.valor)}</b>
              <div className="ff-duas">
                <div className="p4-campo">
                  <label htmlFor="ld-valor">{recebe ? 'Valor recebido (R$)' : 'Valor pago (R$)'}</label>
                  <input id="ld-valor" inputMode="decimal" value={baixa.valor} onChange={(e) => mudarBaixa('valor', e.target.value)} aria-invalid={!!errosBaixa.valor} />
                </div>
                <div className="p4-campo">
                  <label htmlFor="ld-data">{recebe ? 'Recebido em' : 'Pago em'}</label>
                  <input id="ld-data" type="date" value={baixa.pago_em} max={hojeLocal()} onChange={(e) => mudarBaixa('pago_em', e.target.value)} aria-invalid={!!errosBaixa.pago_em} />
                </div>
              </div>
              {erroB('valor')}{erroB('pago_em')}
              {resto !== null && (
                <div className="ld-restante">
                  <span>Pagamento parcial. O restante de <b>{reais(resto)}</b> vira um novo lançamento {recebe ? 'a receber' : 'a pagar'}.</span>
                  <div className="p4-campo">
                    <label htmlFor="ld-venc-resto">Vencimento do restante</label>
                    <input id="ld-venc-resto" type="date" value={baixa.vencimento_restante} min={baixa.pago_em || undefined}
                      onChange={(e) => mudarBaixa('vencimento_restante', e.target.value)} aria-invalid={!!errosBaixa.vencimento_restante} />
                  </div>
                  {erroB('vencimento_restante')}
                </div>
              )}
              <div className="ff-duas">
                <div className="p4-campo">
                  <label htmlFor="ld-conta">Conta</label>
                  <select id="ld-conta" className="np-select" value={baixa.conta_id ?? ''} onChange={(e) => mudarBaixa('conta_id', e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Sem conta</option>
                    {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="p4-campo">
                  <label htmlFor="ld-forma">Forma</label>
                  <select id="ld-forma" className="np-select" value={baixa.forma} onChange={(e) => mudarBaixa('forma', e.target.value)}>
                    <option value="">Não informada</option>
                    {(formas?.length ? formas : FORMAS_PADRAO).map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                </div>
              </div>
              <span className="ld-dica">Juros, multa e desconto continuam no computador.</span>
            </>
          )}
          {acao === 'estornar' && (
            <p className="ld-acao-p">{recebe ? 'Retornar a receber' : 'Retornar a pagar'}? A baixa de {br(l.pago_em)} será desfeita e o lançamento volta a ficar em aberto.
              {l.restante ? ` O restante (#${l.restante.id}) volta para este lançamento, que fica de novo com o valor cheio.` : ''}</p>
          )}
          {acao === 'reativar' && <p className="ld-acao-p">Reativar este lançamento? Ele volta para a lista e para os totais, {l.status === 'liquidado' ? (recebe ? 'como recebido' : 'como pago') : 'em aberto'}.</p>}
          {acao === 'excluir' && (
            <>
              <p className="ld-acao-p">Excluir este lançamento? Ele sai da lista e dos totais, mas continua no histórico e dá para reativar.</p>
              <div className="p4-campo">
                <label htmlFor="ld-motivo">Motivo (opcional)</label>
                <input id="ld-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={120} placeholder="Ex.: lançado em duplicidade" />
              </div>
            </>
          )}
          {erroAcao && <span className="np-erro" role="alert">{erroAcao}</span>}
          <div className="ld-secundarias">
            <button className="oi-btn" disabled={enviando} onClick={() => setAcao(null)}>Voltar</button>
            <button className={'oi-btn ' + (acao === 'excluir' ? 'ld-perigo-sim' : 'primary')} disabled={enviando} onClick={confirmar}>
              {enviando ? 'Enviando…' : acao === 'baixar' ? `Confirmar ${resto !== null ? 'parcial' : recebe ? 'recebimento' : 'pagamento'}`
                : acao === 'excluir' ? 'Excluir' : rotuloAcao(acao, l.tipo)}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
