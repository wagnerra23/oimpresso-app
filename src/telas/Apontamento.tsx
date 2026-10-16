// Apontamento por QR — P8, tela 02 (Mobile Propostas.dc.html#p8; Mobile Producao.dc.html A2/A3/A8). Abre pela
// Produção ("Apontar"). Lê o QR da etiqueta (câmera nativa) ou o número digitado; mostra a OS e a etapa (posto e
// responsável) que o ERP devolveu; Iniciar, Pausar com motivo, Retomar, Concluir e Corrigir horário. Grava no PCP
// (ADR 0431, contrato #9447).
// - Sem internet o toque NÃO trava: vai para a fila do celular com a hora do toque e é enviado quando a rede volta,
//   sem duplicar (decisão [W] 2026-10-15, só o apontamento). Ler uma etiqueta nova ainda precisa de internet.
// - O cronômetro é só exibição: parte do `iniciado_em` do ERP (ou da hora do toque, enquanto está no celular).
// - Pausa (A4): folha com os motivos do posto, guardados no celular para pausar sem internet. No ERP pausar encerra o
//   apontamento; "Retomar" inicia de novo a mesma etapa. A etapa pausada fica listada até o retomar.
// - `app_apontamento_exige_qr`: some "Digitar número" e o iniciar manda o código lido; o ERP confere de novo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { apontamentoApi, drift, type ApontamentoAberto, type Encerramento, type EtiquetaProducao } from '../api';
import { useAjustes } from '../ajustes';
import { useVoltar } from '../voltar';
import {
  codigoDoQr, duracao, erroJustificativa, horaDe, horaNoDia, mensagemDoErro, numeroDigitado, relogio, segundosDecorridos,
  type MotivoPausa,
} from '../apontamento-regras';
import { momentoIso, pausadasDe, relogioErrado, rodando, type ItemFila, type Pausada, type Rodando } from '../apontamento-fila-regras';
import {
  apontar, descartarItem, enviarFila, esquecerPausada, useFila, type DadosPausa, type NovoItem, type ResultadoEnvio,
} from '../apontamento-fila';
import { guardarMotivos, motivosDe, type Motivos } from '../apontamento-motivos';
import '../styles/apontamento.css';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
type Lido = { etiqueta: EtiquetaProducao; codigoQr: string | null };
const voltarSvg = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'] as const;
const ACAO: Record<ItemFila['acao'], string> = { iniciar: 'Início', pausar: 'Pausa', concluir:'Conclusão', corrigir: 'Correção de horário' };

/** Dados de um cartão "rodando": do ERP ou do toque ainda no celular. */
function dadosDe(r: Rodando<ApontamentoAberto>) {
  const s = r.servidor, i = r.item;
  return {
    programacao: s?.etapa?.programacao_id ?? i?.programacao_id ?? 0,
    numero: s?.pedido?.numero ?? i?.pedido.numero ?? '',
    resumo: s?.pedido?.resumo ?? i?.pedido.resumo ?? null,
    cliente: s?.pedido?.cliente ?? i?.pedido.cliente ?? null,
    etapa: s?.etapa?.posto?.nome ?? i?.etapa ?? '',
    posto: s?.etapa?.posto?.id ?? i?.posto_id ?? 0,
    maquina: s ? (s.tipo ?? s.etapa?.posto?.tipo) === 'maquina' : !!i?.maquina,
    codigo: i?.codigo,
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
  const [pausando, setPausando] = useState<Rodando<ApontamentoAberto> | null>(null);
  const travado = useRef(false);

  const lista = rodando(servidor, fila, dono);
  const atual = aberto === null ? null : lista.find((r) => dadosDe(r).programacao === aberto) ?? null;
  const pausadas = pausadasDe(fila, dono, lista.map((r) => dadosDe(r).programacao));
  const folha = corrigindo !== null || pausando !== null;

  useVoltar(folha, () => { if (!ocupado) { setCorrigindo(null); setPausando(null); } });
  useVoltar(!folha && (lido !== null || aberto !== null), () => { setLido(null); setAberto(null); });

  // Com rede, deixa no celular os motivos de pausa dos postos que estão rodando (para pausar se a internet cair).
  const postos = lista.map((r) => dadosDe(r).posto).join(',');
  useEffect(() => {
    if (online && postos) guardarMotivos(postos.split(',').map(Number));
  }, [online, postos]);

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
  const tocar = (novo: NovoItem, ok: (r: ResultadoEnvio) => string, pausa?: DadosPausa) => uma(async () => {
    const relogioMal = relogioErrado(drift());
    if (relogioMal) { avisar(relogioMal, 'erro'); return; }
    let r: ResultadoEnvio;
    try { r = await apontar(novo, online, pausa); } catch { avisar('Não foi possível guardar o apontamento no celular.', 'erro'); return; }
    if (r.parou?.tipo === 'recusado') avisar(r.parou.mensagem, 'erro');
    else if (!online || r.parou) avisar('Sem internet: ficou guardado no celular e vai para o ERP quando a conexão voltar.', 'warn');
    else avisar(ok(r), 'ok');
    if (online) await recarregar();
  });

  const iniciar = () => {
    if (!lido) return;
    const { etiqueta, codigoQr } = lido;
    const programacao = etiqueta.etapa.programacao_id;
    const retomando = pausadas.some((p) => p.programacao_id === programacao);
    void tocar({
      acao: 'iniciar', momento: momentoIso(new Date()), programacao_id: programacao, ...(soQr && codigoQr ? { codigo: codigoQr } : {}),
      pedido: etiqueta.pedido, etapa: etiqueta.etapa.posto?.nome ?? 'Etapa',
      ...(etiqueta.etapa.posto ? { posto_id: etiqueta.etapa.posto.id, maquina: etiqueta.etapa.posto.tipo === 'maquina' } : {}),
    }, () => `${retomando ? 'Retomado' : 'Iniciado'} · ${etiqueta.pedido.numero ?? ''}`).then(() => { setLido(null); setAberto(programacao); });
  };

  /** Pausar encerra o apontamento no ERP; a etapa fica em "Pausadas" até o Retomar. */
  const pausar = (r: Rodando<ApontamentoAberto>, motivo: MotivoPausa) => {
    const d = dadosDe(r);
    const pedido = { id: 0, numero: d.numero, resumo: d.resumo, cliente: d.cliente };
    const dados: DadosPausa = { programacao_id: d.programacao, pedido, etapa: d.etapa, maquina: d.maquina,
      ...(d.posto ? { posto_id: d.posto } : {}), ...(d.codigo ? { codigo: d.codigo } : {}) };
    void tocar({ acao: 'pausar', alvo: r.alvo, momento: momentoIso(new Date()), motivo_id: motivo.id, motivo: motivo.nome, pedido, etapa: d.etapa },
      () => `Pausado · ${motivo.nome.toLowerCase()} · ${d.numero}`, dados).then(() => { setPausando(null); setAberto(null); });
  };

  /** Retomar = iniciar de novo a mesma etapa. Empresa que exige QR e pausa sem o código lido: lê a etiqueta. */
  const retomar = (p: Pausada) => {
    if (soQr && !p.codigo) { void ler(); return; }
    void tocar({
      acao: 'iniciar', momento: momentoIso(new Date()), programacao_id: p.programacao_id, ...(soQr && p.codigo ? { codigo: p.codigo } : {}),
      pedido: p.pedido, etapa: p.etapa, ...(p.posto_id ? { posto_id: p.posto_id } : {}), maquina: p.maquina,
    }, () => `Retomado · ${p.pedido.numero ?? ''}`).then(() => setAberto(p.programacao_id));
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
              {pausadas.length > 0 && <PausadasLista pausadas={pausadas} ocupado={ocupado} soQr={soQr} aoRetomar={retomar} />}
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
                  {ocupado ? 'Iniciando…' : pausadas.some((p) => p.programacao_id === etapaLida.programacao_id) ? 'Retomar' : 'Iniciar'}
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
                  <button className="ap-btn" onClick={() => setPausando(atual)} disabled={ocupado}>Pausar</button>
                  <button className="ap-btn primario" onClick={() => concluir(atual)} disabled={ocupado} aria-busy={ocupado}>{ocupado ? 'Concluindo…' : 'Concluir etapa'}</button>
                </div>
                <button className="ap-link" onClick={() => setCorrigindo(atual)} disabled={ocupado}>Corrigir horário</button>
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

      {pausando && <FolhaPausar alvo={pausando} online={online} ocupado={ocupado} aoFechar={() => setPausando(null)} aoConfirmar={(m) => pausar(pausando, m)} />}
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
          <div className="ap-fila-l2">{i.etapa}{i.acao === 'pausar' && i.motivo ? ` · ${i.motivo}` : ''}</div>
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

/** Etapas pausadas neste celular, à espera do Retomar (A3 "Pausado · motivo"). */
function PausadasLista({ pausadas, ocupado, soQr, aoRetomar }: { pausadas: Pausada[]; ocupado: boolean; soQr: boolean; aoRetomar: (p: Pausada) => void }) {
  const [confirmar, setConfirmar] = useState<number | null>(null);
  return (
    <div className="ap-rodando">
      <div className="p4-rotulo">Pausadas</div>
      {pausadas.map((p) => (
        <div key={p.programacao_id} className="ap-pausada">
          <div className="ap-job-l1"><span>{p.pedido.numero}</span><b>{p.etapa}{p.maquina ? ' · máquina' : ''}</b></div>
          <div className="ap-pausada-m">Pausado às {horaDe(p.momento)} · {p.motivo.toLowerCase()}</div>
          <div className="ap-pausada-acoes">
            <button className="ap-btn primario" onClick={() => aoRetomar(p)} disabled={ocupado}>{soQr && !p.codigo ? 'Ler QR e retomar' : 'Retomar'}</button>
            <button className="ap-link" disabled={ocupado}
              onClick={() => (confirmar === p.programacao_id ? void esquecerPausada(p.programacao_id) : setConfirmar(p.programacao_id))}>
              {confirmar === p.programacao_id ? 'Toque de novo para tirar' : 'Tirar da lista'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A4 · "Por que parou?": um toque no motivo do posto, sem digitar. A lista vem do ERP ou da guardada no celular. */
function FolhaPausar({ alvo, online, ocupado, aoFechar, aoConfirmar }: {
  alvo: Rodando<ApontamentoAberto>; online: boolean; ocupado: boolean; aoFechar: () => void; aoConfirmar: (m: MotivoPausa) => void;
}) {
  const d = dadosDe(alvo);
  const [lista, setLista] = useState<Motivos | null>(null);
  const [erro, setErro] = useState('');
  const [escolhido, setEscolhido] = useState<MotivoPausa | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!d.posto) { setErro('Não deu para saber o posto desta etapa. Abra de novo com internet.'); return; }
    motivosDe(d.posto, online).then(
      (m) => { if (vivo) { setLista(m); setErro(''); } },
      (e) => { if (vivo) setErro((e as { codigo?: string }).codigo === 'rede' ? 'Sem internet e sem a lista de motivos deste posto no celular. Pause quando a conexão voltar.' : mensagemDoErro(e)); },
    );
    return () => { vivo = false; };
  }, [d.posto, online]);
  return (
    <div className="vr-folha" role="dialog" aria-modal="true" aria-label="Pausar etapa">
      <div className="vr-veu" onClick={() => { if (!ocupado) aoFechar(); }} />
      <div className="vr-painel">
        <span className="vr-alca" aria-hidden="true" />
        <div className="vr-folha-cab"><span>Por que parou?</span><button onClick={aoFechar} disabled={ocupado}>Fechar</button></div>
        <p className="np-ajuda" style={{ marginTop: 0 }}>{d.numero} · {d.etapa}. O cronômetro para agora; o motivo mostra ao PCP onde a etapa perde tempo.</p>
        {!lista && !erro && <p className="p4-legal">Carregando os motivos…</p>}
        {erro && <span className="np-erro" role="alert">{erro}</span>}
        {lista && lista.motivos.length === 0 && <span className="np-erro" role="alert">Este posto não tem motivos de pausa cadastrados. Peça ao PCP para cadastrar.</span>}
        {lista && lista.motivos.length > 0 && (
          <div className="ap-motivos" role="radiogroup" aria-label="Motivo da pausa">
            {lista.motivos.map((m) => (
              <button key={m.id} role="radio" aria-checked={escolhido?.id === m.id} className={escolhido?.id === m.id ? 'on' : ''}
                onClick={() => setEscolhido(m)} disabled={ocupado}>{m.nome}</button>
            ))}
          </div>
        )}
        {lista?.guardadaEm && <p className="p4-legal">Lista guardada no celular em {new Date(lista.guardadaEm).toLocaleDateString('pt-BR')} às {horaDe(lista.guardadaEm)}.</p>}
        <button className="p4-cta" onClick={() => { if (escolhido) aoConfirmar(escolhido); }} disabled={ocupado || !escolhido} aria-busy={ocupado}>
          {ocupado ? 'Pausando…' : escolhido ? `Pausar · ${escolhido.nome.toLowerCase()}` : 'Escolha o motivo'}
        </button>
        {!online && <p className="p4-legal" style={{ textAlign: 'center' }}>Sem internet: a pausa fica guardada no celular com a hora de agora.</p>}
      </div>
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
