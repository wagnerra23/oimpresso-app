// Apontamento por QR — P8, tela 02 (Mobile Propostas.dc.html#p8). Abre pela Produção ("Apontar").
// Lê o QR da etiqueta (câmera nativa) ou o número digitado; mostra o pedido e a etapa que o ERP devolveu;
// Iniciar / Finalizar / Cancelar. Sem pausa: a API só inicia, finaliza ou cancela (US-COMVIS-004).
// O cronômetro é só exibição e parte do `iniciado_em` do servidor. Sem internet a escrita trava, sem fila
// (regra 8): o envio inteiro passa por src/apontamento-envio.ts.
// `app_apontamento_exige_qr` (ajuste da empresa, padrão false): com true, some "Digitar número" e o iniciar
// manda o código lido; o ERP confere de novo.
import { useEffect, useRef, useState } from 'react';
import { apontamentoApi, drift, type ApontamentoAberto, type EtiquetaProducao } from '../api';
import { useAjustes } from '../ajustes';
import { useVoltar } from '../voltar';
import {
  codigoDoQr, duracao, erroMotivo, m2Digitado, mensagemDoErro, motivoBloqueio, numeroDigitado, relogio, segundosDecorridos,
} from '../apontamento-regras';
import { apontamentoDoConflito, cancelarApontamento, finalizarApontamento, iniciarApontamento } from '../apontamento-envio';
import '../styles/apontamento.css';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
type Lido = { etiqueta: EtiquetaProducao; codigoQr: string | null };
const codigoDe = (e: unknown) => (e as { codigo?: string } | null)?.codigo ?? '';
const voltarSvg = <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>;
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'] as const;

export function Apontamento({ aoVoltar, avisar, online }: { aoVoltar: () => void; avisar: Aviso; online: boolean }) {
  const ajustes = useAjustes();
  const soQr = ajustes.app_apontamento_exige_qr;
  const [carregando, setCarregando] = useState(true);
  const [aberto, setAberto] = useState<ApontamentoAberto | null>(null);
  const [lido, setLido] = useState<Lido | null>(null);
  const [modo, setModo] = useState<'qr' | 'numero'>('qr');
  const [digitado, setDigitado] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [folha, setFolha] = useState<'finalizar' | 'cancelar' | null>(null);
  const travado = useRef(false);

  useVoltar(folha !== null, () => { if (!ocupado) setFolha(null); });
  useVoltar(folha === null && lido !== null && aberto === null, () => setLido(null));

  // O apontamento aberto do operador (de outro aparelho, ou de antes de fechar o app) vem primeiro.
  useEffect(() => {
    apontamentoApi.emAndamento()
      .then((r) => setAberto(r.item))
      .catch((e) => setErro(mensagemDoErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  const modoAtual = soQr ? 'qr' : modo;
  const bloqueio = motivoBloqueio(online);

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
    } catch (e) {
      setErro(codigoDe(e) === 'validacao' && soQr ? 'Esta empresa aponta só pelo QR da etiqueta.' : mensagemDoErro(e));
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

  const iniciar = () => uma(async () => {
    if (!lido) return;
    const { etiqueta, codigoQr } = lido;
    try {
      const r = await iniciarApontamento(online, etiqueta.pedido.id, etiqueta.etapa.chave, soQr ? codigoQr : null);
      setAberto({ id: r.id, pedido: etiqueta.pedido, etapa: etiqueta.etapa, iniciado_em: r.iniciado_em });
      setLido(null);
    } catch (e) {
      const anterior = apontamentoDoConflito(e);
      if (anterior) {
        // Já há um aberto: a tela passa a mostrá-lo, para o operador finalizar o anterior antes.
        setAberto(anterior); setLido(null);
        avisar(`Você já está apontando ${anterior.pedido.numero}. Finalize ou cancele antes de iniciar outro.`, 'warn');
      } else if (codigoDe(e) === 'etapa_mudou') {
        avisar(mensagemDoErro(e), 'warn');
        try { setLido({ etiqueta: await apontamentoApi.etiqueta(codigoQr ?? String(etiqueta.pedido.id)), codigoQr }); } catch { setLido(null); }
      } else avisar(mensagemDoErro(e), 'erro');
    }
  });

  const encerrado = (texto: string, tom: 'ok' | 'warn') => { setAberto(null); setFolha(null); avisar(texto, tom); };

  const finalizar = (m2: string | null) => uma(async () => {
    if (!aberto) return;
    try {
      const r = await finalizarApontamento(online, aberto.id, m2);
      encerrado(`Apontamento finalizado · ${duracao(r.minutos)} em ${aberto.pedido.numero}`, 'ok');
    } catch (e) {
      if (codigoDe(e) === 'nao_encontrado' || codigoDe(e) === 'bloqueado') encerrado('Este apontamento já tinha sido encerrado.', 'warn');
      else avisar(mensagemDoErro(e), 'erro');
    }
  });

  const cancelar = (motivo: string) => uma(async () => {
    if (!aberto) return;
    try {
      await cancelarApontamento(online, aberto.id, motivo);
      encerrado('Apontamento cancelado — não conta tempo.', 'warn');
    } catch (e) {
      if (codigoDe(e) === 'nao_encontrado' || codigoDe(e) === 'bloqueado') encerrado('Este apontamento já tinha sido encerrado.', 'warn');
      else avisar(mensagemDoErro(e), 'erro');
    }
  });

  const job = aberto ? { pedido: aberto.pedido, etapa: aberto.etapa } : lido ? lido.etiqueta : null;

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

          {!carregando && !job && (
            <>
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
            </>
          )}

          {!carregando && job && (
            <>
              <div className="ap-job">
                <div className="ap-job-l1"><span>{job.pedido.numero}</span><b>{job.etapa.rotulo}</b></div>
                <div className="ap-job-d">{job.pedido.resumo ?? 'OS sem itens de orçamento'}</div>
                {job.pedido.cliente && <div className="ap-job-c">{job.pedido.cliente}</div>}
              </div>
              {aberto ? <Cronometro iniciadoEm={aberto.iniciado_em} /> : (
                <div className="ap-crono" role="timer" aria-label="Tempo apontado">
                  <span>{lido?.etiqueta.pode_apontar ? 'pronto para iniciar' : 'não dá para apontar'}</span>
                  <b>{relogio(0)}</b>
                </div>
              )}
              {lido && !lido.etiqueta.pode_apontar && (
                <p className="np-erro" role="alert">Este pedido já foi encerrado ou seu usuário não pode apontar nele.</p>
              )}
              <div className="ap-acoes">
                {aberto ? (
                  <>
                    <button className="ap-btn" onClick={() => setFolha('finalizar')} disabled={ocupado || !!bloqueio}>Finalizar</button>
                    <button className="ap-btn" onClick={() => setFolha('cancelar')} disabled={ocupado || !!bloqueio}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <button className="ap-btn primario" onClick={iniciar} disabled={ocupado || !!bloqueio || !lido?.etiqueta.pode_apontar} aria-busy={ocupado}>
                      {ocupado ? 'Iniciando…' : 'Iniciar'}
                    </button>
                    <button className="ap-btn" onClick={() => setLido(null)} disabled={ocupado}>Outro pedido</button>
                  </>
                )}
              </div>
              {bloqueio && <span className="pd-rodape-nota">{bloqueio}</span>}
              <p className="p4-legal">O tempo que vale é o do ERP: o relógio parte da hora em que o servidor registrou o início.</p>
            </>
          )}
        </div>
      </div>

      {folha === 'finalizar' && aberto && <FolhaFinalizar ocupado={ocupado} online={online} aoFechar={() => setFolha(null)} aoConfirmar={finalizar} />}
      {folha === 'cancelar' && aberto && <FolhaCancelar ocupado={ocupado} online={online} aoFechar={() => setFolha(null)} aoConfirmar={cancelar} />}
    </>
  );
}

function Cronometro({ iniciadoEm }: { iniciadoEm: string }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="ap-crono" role="timer" aria-label="Tempo apontado">
      <span>em andamento</span>
      <b>{relogio(segundosDecorridos(iniciadoEm, agora, drift()))}</b>
    </div>
  );
}

function Folha({ titulo, aoFechar, travada, children }: { titulo: string; aoFechar: () => void; travada: boolean; children: React.ReactNode }) {
  return (
    <div className="vr-folha" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="vr-veu" onClick={() => { if (!travada) aoFechar(); }} />
      <div className="vr-painel">
        <span className="vr-alca" aria-hidden="true" />
        <div className="vr-folha-cab"><span>{titulo}</span><button onClick={aoFechar} disabled={travada}>Fechar</button></div>
        {children}
      </div>
    </div>
  );
}

function FolhaFinalizar({ ocupado, online, aoFechar, aoConfirmar }: { ocupado: boolean; online: boolean; aoFechar: () => void; aoConfirmar: (m2: string | null) => void }) {
  const [m2, setM2] = useState('');
  const valor = m2Digitado(m2);
  return (
    <Folha titulo="Finalizar apontamento" aoFechar={aoFechar} travada={ocupado}>
      <div className="p4-campo">
        <label htmlFor="ap-m2">m² produzido (opcional)</label>
        <input id="ap-m2" inputMode="decimal" value={m2} onChange={(e) => setM2(e.target.value)} placeholder="ex.: 4,5" disabled={ocupado} />
      </div>
      {valor === 'invalido' ? <span className="np-erro" role="alert">Use números, com até 3 casas depois da vírgula.</span>
        : <span className="np-ajuda">Com o m² orçado, o ERP calcula a diferença do produzido.</span>}
      <button className="p4-cta" onClick={() => aoConfirmar(valor === 'invalido' ? null : valor)} disabled={ocupado || !online || valor === 'invalido'} aria-busy={ocupado}>
        {ocupado ? 'Finalizando…' : 'Finalizar'}
      </button>
    </Folha>
  );
}

function FolhaCancelar({ ocupado, online, aoFechar, aoConfirmar }: { ocupado: boolean; online: boolean; aoFechar: () => void; aoConfirmar: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  const [tocou, setTocou] = useState(false);
  const erro = erroMotivo(motivo);
  return (
    <Folha titulo="Cancelar apontamento" aoFechar={aoFechar} travada={ocupado}>
      <p className="np-ajuda" style={{ marginTop: 0 }}>Cancelado não conta tempo e fica registrado com o motivo. Nada é apagado.</p>
      <div className="p4-campo">
        <label htmlFor="ap-motivo">Motivo</label>
        <textarea id="ap-motivo" className="ap-motivo" rows={3} maxLength={500} value={motivo} disabled={ocupado}
          onChange={(e) => setMotivo(e.target.value)} onBlur={() => setTocou(true)} placeholder="ex.: Iniciei no pedido errado" />
      </div>
      {tocou && erro && <span className="np-erro" role="alert">{erro}</span>}
      <button className="p4-cta" onClick={() => { setTocou(true); if (!erro) aoConfirmar(motivo); }} disabled={ocupado || !online} aria-busy={ocupado}>
        {ocupado ? 'Cancelando…' : 'Cancelar apontamento'}
      </button>
    </Folha>
  );
}
