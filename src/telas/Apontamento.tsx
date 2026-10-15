// Apontamento por QR — P8, tela 02 (Mobile Propostas.dc.html#p8; Mobile Producao.dc.html A2/A3/A8). Abre pela
// Produção ("Apontar"). Lê o QR da etiqueta (câmera nativa) ou o número digitado; mostra a OS e a etapa (posto e
// responsável) que o ERP devolveu; Iniciar, Concluir e Corrigir horário. Grava no PCP (ADR 0431, contrato #9447).
// - Sem internet o toque NÃO trava: vai para a fila do celular com a hora do toque e é enviado quando a rede volta,
//   sem duplicar (decisão [W] 2026-10-15, só o apontamento). Ler uma etiqueta nova ainda precisa de internet.
// - O cronômetro é só exibição: parte do `iniciado_em` do ERP (ou da hora do toque, enquanto está no celular).
// - Pausa fica fora: o contrato pede `motivo_id` do posto e não há rota com a lista de motivos.
// - `app_apontamento_exige_qr`: some "Digitar número" e o iniciar manda o código lido; o ERP confere de novo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apontamentoApi, drift, type ApontamentoAberto, type Encerramento, type EtiquetaProducao } from '../api';
import { useAjustes } from '../ajustes';
import { useVoltar } from '../voltar';
import {
  codigoDoQr, duracao, erroJustificativa, horaDe, horaNoDia, mensagemDoErro, numeroDigitado, relogio, segundosDecorridos,
} from '../apontamento-regras';
import { momentoIso, relogioErrado, rodando, type ItemFila, type Rodando } from '../apontamento-fila-regras';
import { apontar, descartarItem, enviarFila, useFila, type NovoItem, type ResultadoEnvio } from '../apontamento-fila';
import '../styles/apontamento.css';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
type Lido = { etiqueta: EtiquetaProducao; codigoQr: string | null };
const voltarSvg = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'] as const;
const ACAO: Record<ItemFila['acao'], string> = { iniciar: 'Início', concluir: 'Conclusão', corrigir: 'Correção de horário' };

/** Dados de um cartão "rodando": do ERP ou do toque ainda no celular. */
function dadosDe(r: Rodando<ApontamentoAberto>) {
  const s = r.servidor, i = r.item;
  return {
    programacao: s?.etapa?.programacao_id ?? i?.programacao_id ?? 0,
    numero: s?.pedido?.numero ?? i?.pedido.numero ?? '',
    resumo: s?.pedido?.resumo ?? i?.pedido.resumo ?? null,
    cliente: s?.pedido?.cliente ?? i?.pedido.cliente ?? null,
    etapa: s?.etapa?.posto?.nome ?? i?.etapa ?? '',
    maquina: (s?.tipo ?? s?.etapa?.posto?.tipo) === 'maquina',
    // Do ERP: hora gravada (corrige o desvio do relógio). Do celular: a hora do toque, no relógio do próprio aparelho.
    iniciadoEm: s?.iniciado_em ?? i?.momento ?? '',
    noCelular: !s,
  };
}

export function Apontamento({ aoVoltar, avisar, online }: { aoVoltar: () => void; avisar: Aviso; online: boolean }) {
  const ajustes = useAjustes();
  const soQr = ajustes.app_apontamento_exige_qr;
  const { itens, dono, fila } = useFila();
  const [servidor, setServidor] = useState<ApontamentoAberto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [lido, setLido] = useState<Lido | null>(null);
  const [aberto, setAberto] = useState<number | null>(null);
  const [modo, setModo] = useState<'qr' | 'numero'>('qr');
  const [digitado, setDigitado] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [corrigindo, setCorrigindo] = useState<Rodando<ApontamentoAberto> | null>(null);
  const travado = useRef(false);

  const lista = rodando(servidor, fila, dono);
  const atual = aberto === null ? null : lista.find((r) => dadosDe(r).programacao === aberto) ?? null;

  useVoltar(corrigindo !== null, () => { if (!ocupado) setCorrigindo(null); });
  useVoltar(corrigindo === null && (lido !== null || aberto !== null), () => { setLido(null); setAberto(null); });

  const recarregar = useCallback(async () => {
    try {
      const r = await apontamentoApi.emAndamento();
      setServidor([...(r.pessoa ? [r.pessoa] : []), ...r.maquinas]);
    } catch { /* sem rede: fica o que já se sabia + a fila */ }
    setCarregando(false);
  }, []);

  // Ao abrir e quando a rede volta: manda o que estava guardado e busca o que está rodando no ERP.
  useEffect(() => {
    if (!online) { setCarregando(false); return; }
    void enviarFila().then(recarregar);
  }, [online, recarregar]);

  const modoAtual = soQr ? 'qr' : modo;

  /** Uma ação por vez: dois toques no mesmo quadro não passam pelo `ocupado` (só muda no próximo render). */
  const uma = async (fazer: () => Promise<void>) => {
    if (travado.current) return;
    travado.current = true; setOcupado(true);
    try { await fazer(); } finally { travado.current = false; setOcupado(false); }
  };

  const resolver = (codigo: string, codigoQr: string | null) => uma(async () => {
    setErro('');
    try {
      const etiqueta = await apontamentoApi.etiqueta(codigo);
      setLido({ etiqueta, codigoQr }); setDigitado('');
      const ja = lista.find((r) => dadosDe(r).programacao === etiqueta.etapa.programacao_id);
      if (ja) { setAberto(etiqueta.etapa.programacao_id); setLido(null); }
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  });

  const ler = async () => {
    if (travado.current) return;
    setErro('');
    let texto: string | null;
    // Sob demanda: o plugin traz o html5-qrcode (web) e não precisa pesar na abertura do app.
    try { texto = await (await import('../apontamento-leitor')).lerQr(); } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível abrir o leitor.'); return; }
    if (texto === null) return;
    const codigo = codigoDoQr(texto);
    if (!codigo) { setErro('Este QR não é de uma etiqueta de produção do oimpresso.'); return; }
    await resolver(codigo, codigo);
  };

  const tecla = (t: (typeof TECLAS)[number]) => {
    setErro('');
    if (t === '⌫') { setDigitado((d) => d.slice(0, -1)); return; }
    if (t === 'OK') {
      const n = numeroDigitado(digitado);
      if (!n) { setErro(digitado ? 'Número inválido.' : 'Digite o número do pedido.'); return; }
      void resolver(n, null);
      return;
    }
    setDigitado((d) => (d.length < 10 ? d + t : d));
  };

  /** Guarda o toque e tenta enviar. Diz ao operador onde ele ficou. */
  const tocar = (novo: NovoItem, ok: (r: ResultadoEnvio) => string) => uma(async () => {
    const relogioMal = relogioErrado(drift());
    if (relogioMal) { avisar(relogioMal, 'erro'); return; }
    let r: ResultadoEnvio;
    try { r = await apontar(novo, online); } catch { avisar('Não foi possível guardar o apontamento no celular.', 'erro'); return; }
    if (r.parou?.tipo === 'recusado') avisar(r.parou.mensagem, 'erro');
    else if (!online || r.parou) avisar('Sem internet: ficou guardado no celular e vai para o ERP quando a conexão voltar.', 'warn');
    else avisar(ok(r), 'ok');
    if (online) await recarregar();
  });

  const iniciar = () => {
    if (!lido) return;
    const { etiqueta, codigoQr } = lido;
    const programacao = etiqueta.etapa.programacao_id;
    void tocar({
      acao: 'iniciar', momento: momentoIso(new Date()), programacao_id: programacao, ...(soQr && codigoQr ? { codigo: codigoQr } : {}),
      pedido: etiqueta.pedido, etapa: etiqueta.etapa.posto?.nome ?? 'Etapa',
    }, () => `Iniciado · ${etiqueta.pedido.numero ?? ''}`).then(() => { setLido(null); setAberto(programacao); });
  };

  const concluir = (r: Rodando<ApontamentoAberto>) => {
    const d = dadosDe(r);
    void tocar({ acao: 'concluir', alvo: r.alvo, momento: momentoIso(new Date()), pedido: { id: 0, numero: d.numero, resumo: d.resumo, cliente: d.cliente }, etapa: d.etapa },
      (res) => {
        const fim = res.enviados.find((x) => x.item.acao === 'concluir')?.resposta as Encerramento | undefined;
        return `Etapa concluída${fim?.minutos != null ? ` · ${duracao(fim.minutos)}` : ''} em ${d.numero}`;
      }).then(() => setAberto(null));
  };

  const corrigir = (r: Rodando<ApontamentoAberto>, horaCerta: Date, justificativa: string) => {
    const d = dadosDe(r);
    void tocar({ acao: 'corrigir', alvo: r.alvo, momento: momentoIso(new Date()), hora_certa: momentoIso(horaCerta), justificativa: justificativa.trim(),
      pedido: { id: 0, numero: d.numero, resumo: d.resumo, cliente: d.cliente }, etapa: d.etapa },
    () => 'Pedido de correção enviado ao gestor.').then(() => setCorrigindo(null));
  };

  const etapaLida = lido?.etiqueta.etapa;

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para produção" disabled={ocupado}>{voltarSvg}</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">Produção · apontar</div>
          <div className="pd-dtitulo">Apontar etapa</div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo ap-corpo">
          {carregando && <p className="p4-legal">Carregando…</p>}

          {!carregando && !atual && !lido && (
            <>
              {lista.length > 0 && (
                <div className="ap-rodando">
                  <div className="p4-rotulo">Rodando agora</div>
                  {lista.map((r) => {
                    const d = dadosDe(r);
                    return (
                      <button key={r.chave} className="ap-rodando-item" onClick={() => setAberto(d.programacao)}>
                        <span className="ap-job-l1"><span>{d.numero}</span><b>{d.etapa}{d.maquina ? ' · máquina' : ''}</b></span>
                        <Cronometro iniciadoEm={d.iniciadoEm} corrigeRelogio={!d.noCelular} pequeno />
                      </button>
                    );
                  })}
                </div>
              )}
              {!soQr && (
                <div className="np-seg" role="tablist" aria-label="Como identificar o pedido">
                  <button role="tab" aria-selected={modoAtual === 'qr'} className={modoAtual === 'qr' ? 'on' : ''} onClick={() => { setModo('qr'); setErro(''); }}>Ler QR</button>
                  <button role="tab" aria-selected={modoAtual === 'numero'} className={modoAtual === 'numero' ? 'on' : ''} onClick={() => { setModo('numero'); setErro(''); }}>Digitar número</button>
                </div>
              )}
              {modoAtual === 'qr' ? (
                <>
                  <button className="ap-visor" onClick={ler} disabled={ocupado} aria-label="Abrir a câmera para ler o QR da etiqueta">
                    <span className="ap-mira" aria-hidden="true"><i /><i /><i /><i /><b /></span>
                    <span className="ap-visor-t">{ocupado ? 'Buscando o pedido…' : 'Toque para abrir a câmera e aponte para o QR da etiqueta do pedido'}</span>
                  </button>
                  {erro && <span className="np-erro" role="alert">{erro}</span>}
                  <p className="p4-legal">{soQr ? 'Sua empresa aponta só pelo QR da etiqueta.' : 'Etiqueta ilegível? Use "Digitar número".'}</p>
                </>
              ) : (
                <>
                  <div className="ap-digitado">
                    <span>número do pedido na etiqueta</span>
                    <b aria-live="polite">{digitado || '····'}</b>
                    <em role="alert">{erro}</em>
                  </div>
                  <div className="ap-teclado">
                    {TECLAS.map((t) => (
                      <button key={t} className={t === 'OK' ? 'ok' : ''} onClick={() => tecla(t)} disabled={ocupado}
                        aria-label={t === '⌫' ? 'Apagar' : t === 'OK' ? 'Buscar pedido' : undefined}>{t}</button>
                    ))}
                  </div>
                </>
              )}
              {!online && <p className="pd-rodape-nota">Sem conexão: ler uma etiqueta nova precisa de internet. O que você já iniciou dá para concluir.</p>}
            </>
          )}

          {!carregando && !atual && lido && etapaLida && (
            <>
              <div className="ap-job">
                <div className="ap-job-l1"><span>{lido.etiqueta.pedido.numero}</span><b>{etapaLida.posto?.nome ?? 'Etapa'}</b></div>
                <div className="ap-job-d">{lido.etiqueta.pedido.resumo ?? 'OS sem itens de orçamento'}</div>
                {lido.etiqueta.pedido.cliente && <div className="ap-job-c">{lido.etiqueta.pedido.cliente}</div>}
                {etapaLida.responsavel && <div className="ap-job-c">Responsável: {etapaLida.responsavel.nome}</div>}
              </div>
              <div className="ap-crono" role="timer" aria-label="Tempo apontado">
                <span>{lido.etiqueta.pode_apontar ? 'pronto para iniciar' : 'não dá para apontar'}</span>
                <b>{relogio(0)}</b>
              </div>
              {!lido.etiqueta.pode_apontar && (
                <p className="np-erro" role="alert">
                  {etapaLida.status === 'concluida' ? 'Esta etapa já foi concluída.'
                    : `Esta etapa está em ${etapaLida.posto?.nome ?? 'outro posto'}${etapaLida.responsavel ? `, com ${etapaLida.responsavel.nome}` : ''}. Nada é apontado.`}
                </p>
              )}
              <div className="ap-acoes">
                <button className="ap-btn primario" onClick={iniciar} disabled={ocupado || !lido.etiqueta.pode_apontar} aria-busy={ocupado}>
                  {ocupado ? 'Iniciando…' : 'Iniciar'}
                </button>
                <button className="ap-btn" onClick={() => setLido(null)} disabled={ocupado}>Outro pedido</button>
              </div>
            </>
          )}

          {!carregando && atual && (() => {
            const d = dadosDe(atual);
            return (
              <>
                <div className="ap-job">
                  <div className="ap-job-l1"><span>{d.numero}</span><b>{d.etapa}{d.maquina ? ' · máquina' : ''}</b></div>
                  <div className="ap-job-d">{d.resumo ?? 'OS sem itens de orçamento'}</div>
                  {d.cliente && <div className="ap-job-c">{d.cliente}</div>}
                </div>
                <Cronometro iniciadoEm={d.iniciadoEm} corrigeRelogio={!d.noCelular} />
                {d.noCelular && <p className="np-ajuda" style={{ textAlign: 'center' }}>Início guardado no celular. Vai para o ERP quando a internet voltar.</p>}
                <div className="ap-acoes">
                  <button className="ap-btn primario" onClick={() => concluir(atual)} disabled={ocupado} aria-busy={ocupado}>{ocupado ? 'Concluindo…' : 'Concluir etapa'}</button>
                  <button className="ap-btn" onClick={() => setCorrigindo(atual)} disabled={ocupado}>Corrigir horário</button>
                </div>
                <button className="ap-link" onClick={() => setAberto(null)} disabled={ocupado}>
                  {d.maquina ? 'Deixar a máquina rodando e apontar outro' : 'Apontar outro pedido'}
                </button>
                <p className="p4-legal">O tempo que vale é o do ERP. Errou o horário? Peça a correção: o gestor confere e o registro original fica.</p>
              </>
            );
          })()}

          {itens.length > 0 && <Pendentes itens={itens} online={online} />}
        </div>
      </div>

      {corrigindo && <FolhaCorrigir alvo={corrigindo} ocupado={ocupado} aoFechar={() => setCorrigindo(null)} aoConfirmar={(h, j) => corrigir(corrigindo, h, j)} />}
    </>
  );
}

/** O que está guardado no celular, na ordem de envio. Recusado pelo ERP: mostra o motivo e deixa descartar. */
function Pendentes({ itens, online }: { itens: ItemFila[]; online: boolean }) {
  const [confirmar, setConfirmar] = useState<string | null>(null);
  return (
    <div className="ap-fila" aria-live="polite">
      <div className="p4-rotulo">Guardado no celular · {itens.length}</div>
      {itens.map((i) => (
        <div key={i.local} className={'ap-fila-item' + (i.estado === 'recusado' ? ' recusado' : '')}>
          <div className="ap-fila-l1"><b>{ACAO[i.acao]} · {i.pedido.numero}</b><span>{horaDe(i.momento)}</span></div>
          <div className="ap-fila-l2">{i.etapa}</div>
          {i.estado === 'recusado' ? (
            <>
              <span className="np-erro">O ERP recusou: {i.erro}</span>
              <button className="ap-link" onClick={() => (confirmar === i.local ? void descartarItem(i.local) : setConfirmar(i.local))}>
                {confirmar === i.local ? 'Toque de novo para descartar' : 'Descartar'}
              </button>
            </>
          ) : <span className="np-ajuda" style={{ marginTop: 0 }}>{online ? 'Enviando…' : 'Aguardando internet'}</span>}
        </div>
      ))}
      {itens.some((i) => i.estado === 'recusado') && <p className="p4-legal">Enquanto houver um recusado, os de trás esperam. Descartar não apaga nada no ERP.</p>}
    </div>
  );
}

function Cronometro({ iniciadoEm, corrigeRelogio, pequeno = false }: { iniciadoEm: string; corrigeRelogio: boolean; pequeno?: boolean }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const txt = relogio(segundosDecorridos(iniciadoEm, agora, corrigeRelogio ? drift() : null));
  if (pequeno) return <span className="ap-rodando-t" role="timer">{txt}</span>;
  return (
    <div className="ap-crono" role="timer" aria-label="Tempo apontado">
      <span>em andamento · desde {horaDe(iniciadoEm)}</span>
      <b>{txt}</b>
    </div>
  );
}

function FolhaCorrigir({ alvo, ocupado, aoFechar, aoConfirmar }: {
  alvo: Rodando<ApontamentoAberto>; ocupado: boolean; aoFechar: () => void; aoConfirmar: (horaCerta: Date, justificativa: string) => void;
}) {
  const d = dadosDe(alvo);
  const [hora, setHora] = useState(horaDe(d.iniciadoEm));
  const [justificativa, setJustificativa] = useState('');
  const [tocou, setTocou] = useState(false);
  const data = horaNoDia(hora, d.iniciadoEm);
  const erroJ = erroJustificativa(justificativa);
  const erroH = !data ? 'Informe a hora (HH:MM).' : data.getTime() > Date.now() + 5 * 60000 ? 'A hora certa não pode estar no futuro.' : null;
  return (
    <div className="vr-folha" role="dialog" aria-modal="true" aria-label="Corrigir horário">
      <div className="vr-veu" onClick={() => { if (!ocupado) aoFechar(); }} />
      <div className="vr-painel">
        <span className="vr-alca" aria-hidden="true" />
        <div className="vr-folha-cab"><span>Corrigir horário</span><button onClick={aoFechar} disabled={ocupado}>Fechar</button></div>
        <p className="np-ajuda" style={{ marginTop: 0 }}>{d.numero} · {d.etapa}. O gestor confere e aplica; o registro original fica.</p>
        <div className="p4-campo">
          <label htmlFor="ap-hora">Hora certa do início</label>
          <input id="ap-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} disabled={ocupado} />
        </div>
        <div className="p4-campo">
          <label htmlFor="ap-justificativa">Por que está errado</label>
          <textarea id="ap-justificativa" className="ap-motivo" rows={3} maxLength={500} value={justificativa} disabled={ocupado}
            onChange={(e) => setJustificativa(e.target.value)} onBlur={() => setTocou(true)} placeholder="ex.: Comecei às 8h e esqueci de apontar" />
        </div>
        {tocou && (erroH || erroJ) && <span className="np-erro" role="alert">{erroH ?? erroJ}</span>}
        <button className="p4-cta" onClick={() => { setTocou(true); if (!erroH && !erroJ && data) aoConfirmar(data, justificativa); }} disabled={ocupado} aria-busy={ocupado}>
          {ocupado ? 'Enviando…' : 'Pedir correção'}
        </button>
      </div>
    </div>
  );
}
