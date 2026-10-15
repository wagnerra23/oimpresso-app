// Tela 41 · Atendimento WhatsApp (P5, playbook propostas-app PR 19; visual `Mobile Propostas.dc.html` #p5). Mora em Mais
// e só aparece com a área `atendimento` em `areas`, que o ERP manda com o canal ligado e a permissão do inbox web.
// Rotas /api/app/atendimento (ERP PR 18, contrato tela-41-atendimento.md): lista, conversa, texto livre e atalhos.
// Regras (bloqueio sem consentimento, janela de 24 h, erros) em ../atendimento-regras.ts. Offline trava o envio.
// Fora da v1: áudio, figurinhas, anexo, modelo aprovado e transferir entre filas.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { api, type OrcamentoResumo, type PedidoResumo } from '../api';
import { useAjustes } from '../ajustes';
import { novaChave } from '../venda';
import { horaCurta } from './Assistente';
import {
  ATALHOS, avisoDeConsentimento, bloqueioDoEnvio, manterChave, mensagemDeErro, mostraAtalhos, textoDaMensagem, totalNaoLidas,
  type ConversaAtendimento, type ListaAtendimento, type MensagemAtendimento, type TipoAtalho,
} from '../atendimento-regras';

type Avisar = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
/** O que foi pedido ao ERP e ainda não voltou (ou falhou): a bolha mostra "enviando…" ou "Não enviada". */
type Envio = { local: string; chave: string; texto: string; corpo: { texto: string } | { tipo: TipoAtalho; ref_id: number }; falhou: boolean };

export function Atendimento({ avisar, online, voltar }: { avisar: Avisar; online: boolean; voltar?: ReactNode }) {
  const ajustes = useAjustes();
  const [lista, setLista] = useState<ListaAtendimento | null>(null);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);
  const [lidas, setLidas] = useState<Record<number, true>>({});
  const [msgs, setMsgs] = useState<MensagemAtendimento[] | null>(null);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [texto, setTexto] = useState('');
  const [atalho, setAtalho] = useState<TipoAtalho | null>(null);
  const fim = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => {
    setErroLista(null);
    api.atendimento().then((l) => {
      setLista(l);
      setSel((s) => (s !== null && l.conversas.some((c) => c.id === s) ? s : l.conversas[0]?.id ?? null));
    }).catch((e) => setErroLista(mensagemDeErro(e)));
  }, []);
  useEffect(carregar, [carregar]);

  useEffect(() => {
    if (sel === null) return;
    let vivo = true;
    setMsgs(null); setEnvios([]); setTexto('');
    setLidas((l) => ({ ...l, [sel]: true }));
    api.conversaAtendimento(sel).then((d) => vivo && setMsgs(d.mensagens)).catch((e) => { if (vivo) { setMsgs([]); avisar(mensagemDeErro(e), 'erro'); } });
    return () => { vivo = false; };
  }, [sel, avisar]);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'end' }); }, [msgs, envios]);

  const conversas = (lista?.conversas ?? []).map((c) => (lidas[c.id] ? { ...c, nao_lidas: 0 } : c));
  const conversa: ConversaAtendimento | undefined = conversas.find((c) => c.id === sel);
  const bloqueio = conversa ? bloqueioDoEnvio(conversa, online) : null;
  const aviso = conversa ? avisoDeConsentimento(conversa) : null;
  const ocupado = envios.some((x) => !x.falhou);

  /** Manda (ou reenvia) uma tentativa. A chave fica enquanto o reenvio não pode duplicar a mensagem. */
  const mandar = async (env: Envio) => {
    if (!conversa || bloqueioDoEnvio(conversa, online)) return;
    setEnvios((es) => [...es.filter((x) => x.local !== env.local), { ...env, falhou: false }]);
    try {
      const r = 'tipo' in env.corpo
        ? await api.atalhoAtendimento(conversa.id, env.corpo.tipo, env.corpo.ref_id, env.chave)
        : await api.enviarAtendimento(conversa.id, env.corpo.texto, env.chave);
      setEnvios((es) => es.filter((x) => x.local !== env.local));
      setMsgs((m) => [...(m ?? []), r.mensagem]);
    } catch (e) {
      const x = (e ?? {}) as { status?: number; codigo?: string };
      const chave = manterChave(x.status ?? 0, x.codigo ?? '') ? env.chave : novaChave();
      setEnvios((es) => es.map((y) => (y.local === env.local ? { ...y, chave, falhou: true } : y)));
      avisar(mensagemDeErro(e), 'erro');
    }
  };

  const enviarTexto = () => {
    const t = texto.trim();
    if (!t || bloqueio || ocupado) return;
    setTexto('');
    mandar({ local: novaChave(), chave: novaChave(), texto: t, corpo: { texto: t }, falhou: false });
  };
  const enviarAtalho = (tipo: TipoAtalho, ref_id: number, rotulo: string) => {
    setAtalho(null);
    mandar({ local: novaChave(), chave: novaChave(), texto: rotulo, corpo: { tipo, ref_id }, falhou: false });
  };

  const canalLigado = lista?.canal.ligado ?? true;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{totalNaoLidas(conversas)} não lidas · WhatsApp{lista?.canal.numero ? ` · ${lista.canal.numero}` : ''}</div>
            <div className="pd-titulo">Atendimento</div>
          </div>
        </div>
        {conversas.length > 0 && (
          <div className="pd-chips at-conversas" role="tablist" aria-label="Conversas">
            {conversas.map((c) => (
              <button key={c.id} role="tab" aria-selected={c.id === sel} className={'pd-chip' + (c.id === sel ? ' on' : '')} onClick={() => setSel(c.id)}>
                {c.contato.nome}{c.nao_lidas > 0 && <b className="at-novas" aria-label={`${c.nao_lidas} não lidas`}>{c.nao_lidas}</b>}
              </button>
            ))}
          </div>
        )}
      </div>

      {erroLista && (
        <div className="oi-empty"><b>Não foi possível abrir o atendimento</b><small>{erroLista}</small>
          <button className="oi-btn sm" onClick={carregar}>Tentar de novo</button></div>
      )}
      {!erroLista && !lista && <p className="p4-legal at-carregando">Carregando as conversas…</p>}
      {lista && !canalLigado && (
        <div className="oi-empty"><b>WhatsApp não está ligado</b>
          <small>A empresa ainda não conectou o número no módulo WhatsApp do ERP. Peça ao administrador.</small></div>
      )}
      {lista && canalLigado && conversas.length === 0 && (
        <div className="oi-empty"><b>Nenhuma conversa aberta</b><small>As conversas abertas ou aguardando atendente aparecem aqui.</small></div>
      )}

      {conversa && canalLigado && (
        <>
          <div className="oi-scroll">
            <div className="ch-lista" role="log" aria-live="polite" aria-label={`Conversa com ${conversa.contato.nome}`}>
              <span className="at-vinculo">{conversa.contato.id !== null ? `Vinculado a ${conversa.contato.nome} · WhatsApp` : 'Conversa sem cliente ligado · WhatsApp'}</span>
              {aviso && <div className="at-alerta" role="note"><b>Sem consentimento de WhatsApp</b><span>{aviso}</span></div>}
              {msgs === null && <p className="p4-legal">Carregando a conversa…</p>}
              {msgs?.map((m) => (
                <div key={m.id} className={'ch-msg ' + (m.de === 'cliente' ? 'jana' : 'eu') + (m.de === 'sistema' ? ' at-sistema' : '') + (m.status === 'failed' ? ' falhou' : '')}>
                  <span>{textoDaMensagem(m)}</span>
                  <small>{m.status === 'failed' ? 'Falhou' : m.quando ? horaCurta(m.quando) : ''}</small>
                </div>
              ))}
              {envios.map((x) => (
                x.falhou
                  ? <button key={x.local} className="ch-msg eu falhou at-reenviar" disabled={!!bloqueio || ocupado} onClick={() => mandar(x)}>
                      <span>{x.texto}</span><small>Não enviada · tocar para reenviar</small></button>
                  : <div key={x.local} className="ch-msg eu at-enviando"><span>{x.texto}</span><small>enviando…</small></div>
              ))}
              <div ref={fim} />
            </div>
          </div>
          <div className="ch-rodape">
            {bloqueio && <p className="ch-aviso at-bloqueio" role="status">{bloqueio}</p>}
            {mostraAtalhos(ajustes.app_atendimento_atalhos, conversa) && (
              <div className="ch-sugestoes" aria-label="Atalhos">
                {ATALHOS.map((a) => <button key={a.tipo} className="pd-chip" disabled={!!bloqueio || ocupado} onClick={() => setAtalho(a.tipo)}>{a.rotulo}</button>)}
              </div>
            )}
            <form className="ch-campo" onSubmit={(e) => { e.preventDefault(); enviarTexto(); }}>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={online ? 'Mensagem' : 'Sem conexão'} aria-label={`Mensagem para ${conversa.contato.nome}`}
                maxLength={4096} enterKeyHint="send" autoComplete="off" disabled={!!bloqueio} />
              <button type="submit" className="ch-enviar" disabled={!!bloqueio || ocupado || !texto.trim()} aria-label="Enviar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
              </button>
            </form>
          </div>
        </>
      )}

      {atalho && conversa && (
        <EscolhaAtalho tipo={atalho} cliente={conversa.contato.nome} fechar={() => setAtalho(null)} escolher={enviarAtalho} />
      )}
    </>
  );
}

type Opcao = { id: number; rotulo: string; detalhe: string };

/** Folha do atalho: escolhe o registro do cliente; o texto (valor, etapa, link) quem monta é o ERP. */
function EscolhaAtalho({ tipo, cliente, fechar, escolher }: {
  tipo: TipoAtalho; cliente: string; fechar: () => void; escolher: (tipo: TipoAtalho, ref: number, rotulo: string) => void;
}) {
  const def = ATALHOS.find((a) => a.tipo === tipo)!;
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(tipo === 'link_arte' ? [] : null);
  const [erro, setErro] = useState<string | null>(null);
  const [numero, setNumero] = useState('');

  useEffect(() => {
    if (tipo === 'orcamento') {
      api.orcamentos('todos').then((l) => setOpcoes(l.itens
        .filter((o: OrcamentoResumo) => o.cliente === cliente && o.status !== 'convertido')
        .map((o) => ({ id: o.id, rotulo: o.numero, detalhe: o.titulo ?? `${o.itens} itens` })))).catch((e) => setErro(mensagemDeErro(e)));
    } else if (tipo === 'status_pedido') {
      api.pedidos('ativos', 1, cliente).then((l) => setOpcoes(l.itens
        .filter((p: PedidoResumo) => p.cliente === cliente && p.etapa.grupo !== 'orcamento')
        .map((p) => ({ id: p.id, rotulo: `Pedido #${p.numero}`, detalhe: `${p.etapa.rotulo}${p.resumo ? ` · ${p.resumo}` : ''}` })))).catch((e) => setErro(mensagemDeErro(e)));
    }
  }, [tipo, cliente]);

  const ref = Number(numero);
  return (
    <div className="oi-sheet-backdrop" onClick={fechar}>
      <div className="oi-sheet pg-sheet" role="dialog" aria-modal="true" aria-labelledby="at-atalho-t" onClick={(e) => e.stopPropagation()}>
        <div className="oi-sheet-grip" />
        <div className="oi-sheet-h"><b id="at-atalho-t">{def.escolha}</b><button className="oi-btn close" onClick={fechar}>Fechar</button></div>
        <div className="pg-folha">
          <p className="p4-legal">O ERP monta a mensagem para {cliente} com o valor, a etapa ou o link que ele tem.</p>
          {tipo === 'link_arte' ? (
            <form className="ch-campo" onSubmit={(e) => { e.preventDefault(); if (ref > 0) escolher(tipo, ref, `Link da arte · ordem ${ref}`); }}>
              <input value={numero} onChange={(e) => setNumero(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Nº da ordem de produção"
                aria-label="Número da ordem de produção" autoFocus />
              <button type="submit" className="oi-btn primary" disabled={!(ref > 0)}>Enviar</button>
            </form>
          ) : (
            <>
              {!opcoes && !erro && <p className="p4-legal">Carregando…</p>}
              {erro && <p className="pg-erro" role="alert">{erro}</p>}
              {opcoes && opcoes.length === 0 && <p className="p4-legal">Nada em aberto para este cliente.</p>}
              {opcoes && opcoes.length > 0 && (
                <div className="pg-refs">
                  {opcoes.map((o) => (
                    <button key={o.id} className="pg-ref" onClick={() => escolher(tipo, o.id, `${def.rotulo} · ${o.rotulo}`)}>
                      <span><b>{o.rotulo}</b><small>{o.detalhe}</small></span><span aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
