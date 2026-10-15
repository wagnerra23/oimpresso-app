// P3 · protocolo de entrega (tela 22, visual #p3 do Mobile Propostas). Contrato: memory/requisitos/AppMobile/api/
// tela-22-entrega.md (ERP #9464). Abre pelo rodapé do Detalhe do pedido quando o GET manda `entrega.pode`.
// Conferência das linhas, quem recebeu, assinatura no quadro (ou "Recebido sem assinatura" com motivo, se a empresa
// permite: `app_entrega_exige_assinatura`), localização (trava só com `app_entrega_exige_localizacao`) e comprovante
// com o protocolo ENT-NNNN. Envio com Idempotency-Key; offline trava, sem fila.
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as PE, type RefObject } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { api, camposDoErro, ErroApi, type EntregaRegistrada, type PedidoDetalheApi } from '../api';
import { useAjustes } from '../ajustes';
import {
  corpoEntrega, faltaNaEntrega, parteDoCampo, podeSemAssinatura, reacaoAoErroEntrega, textoLocal, vaiSemAssinatura,
  type LocalEntrega, type ReacaoEntrega,
} from '../entrega-regras';
import { novaChave } from '../venda';

type Gps = { estado: 'buscando' | 'negado' | 'erro' | 'sem' } | { estado: 'ok'; local: LocalEntrega };
type Parte = ReturnType<typeof parteDoCampo>;
type Ponto = [number, number];

const statusDe = (e: unknown) => (e instanceof ErroApi ? e.status : (e as { status?: number } | null)?.status ?? 0);
const codigoDe = (e: unknown) => (e instanceof ErroApi ? e.codigo : (e as { codigo?: string } | null)?.codigo ?? '');
const hora = (iso: string) => new Date(iso).toTimeString().slice(0, 5);

export function EntregaPedido({ pedido: p, online, avisar, aoVoltar, aoRegistrada, aoReagir }: {
  pedido: PedidoDetalheApi; online: boolean;
  avisar: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
  aoVoltar: () => void;
  /** 201: o Detalhe passa a mostrar o pedido na etapa nova. */
  aoRegistrada: (r: EntregaRegistrada) => void;
  /** 409 etapa_mudou / 403 / 404: quem decide é o Detalhe. */
  aoReagir: (r: Extract<ReacaoEntrega, 'recarregar' | 'sumir' | 'voltar'>) => void;
}) {
  const ajustes = useAjustes();
  const linhas = p.itens_venda.map((i) => i.linha_id).filter((l): l is number => typeof l === 'number');
  const [conferidos, setConferidos] = useState<number[]>([]);
  const [recebidoPor, setRecebidoPor] = useState('');
  const [semAssinatura, setSemAssinatura] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [assinou, setAssinou] = useState(false);
  const [gps, setGps] = useState<Gps>({ estado: 'buscando' });
  const [erros, setErros] = useState<Partial<Record<Parte, string>>>({});
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState<EntregaRegistrada | null>(null);
  /** Idempotency-Key da tentativa: a mesma enquanto o corpo for o mesmo (rede/5xx repetem sem registrar 2×). */
  const chave = useRef<{ sig: string; valor: string } | null>(null);
  const quadro = useRef<Assinatura>(null);
  const exigeLocal = ajustes.app_entrega_exige_localizacao;

  // Localização: com o ajuste ligado, pede a permissão e trava sem ela; sem o ajuste, só usa se já estiver liberada.
  const localizar = useCallback(async (pedir: boolean) => {
    setGps({ estado: 'buscando' });
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location !== 'granted') {
        if (!pedir) { setGps({ estado: 'sem' }); return; }
        const r = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (r.location !== 'granted') { setGps({ estado: 'negado' }); return; }
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
      setGps({ estado: 'ok', local: { lat: pos.coords.latitude, lng: pos.coords.longitude, precisao_m: pos.coords.accuracy } });
    } catch (e) {
      setGps(!pedir ? { estado: 'sem' } : /denied|permission/i.test(String((e as Error)?.message ?? e)) ? { estado: 'negado' } : { estado: 'erro' });
    }
  }, []);
  useEffect(() => { localizar(exigeLocal); }, [localizar, exigeLocal]);

  const local = gps.estado === 'ok' ? gps.local : null;
  const entrega = { conferidos, recebidoPor, semAssinatura, motivo, assinou, local };
  const falta = faltaNaEntrega(linhas, entrega, ajustes);
  const sem = vaiSemAssinatura(entrega, ajustes);

  const alternar = (l: number) => setConferidos((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));

  const registrar = async () => {
    if (falta || enviando) return;
    if (!online) { avisar('Sem conexão. Registrar a entrega precisa de internet.', 'warn'); return; }
    const png = sem ? null : quadro.current?.png() ?? null;
    const corpo = corpoEntrega(linhas, entrega, ajustes, png, p.etapa.chave);
    const sig = JSON.stringify([p.id, corpo]);
    if (chave.current?.sig !== sig) chave.current = { sig, valor: novaChave() };
    setEnviando(true); setErros({});
    try {
      const r = await api.registrarEntrega(p.id, corpo, chave.current.valor);
      chave.current = null;
      setFeito(r);
      aoRegistrada(r);
      avisar(`Entrega registrada · ${r.protocolo}`);
    } catch (e) {
      const r = reacaoAoErroEntrega(statusDe(e), codigoDe(e));
      if (!r.manterChave) chave.current = null;
      const msg = e instanceof Error && e.message ? e.message : r.mensagem;
      if (r.reacao === 'campos') {
        const porParte: Partial<Record<Parte, string>> = {};
        for (const [campo, m] of Object.entries(camposDoErro(e))) porParte[parteDoCampo(campo)] ??= m;
        setErros(Object.keys(porParte).length ? porParte : { geral: msg });
        avisar(r.mensagem, 'erro');
      } else if (r.reacao === 'recarregar' || r.reacao === 'sumir' || r.reacao === 'voltar') {
        avisar(r.reacao === 'recarregar' ? r.mensagem : msg, r.reacao === 'recarregar' ? 'warn' : 'erro');
        aoReagir(r.reacao);
      } else {
        avisar(r.reacao === 'avisar' ? msg : r.mensagem, r.reacao === 'repetir' ? 'warn' : 'erro');
      }
    } finally { setEnviando(false); }
  };

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para o pedido">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pedido #{p.numero} · {p.cliente.nome}</div>
          <div className="pd-dtitulo">{feito ? 'Entrega registrada' : 'Registrar entrega'}</div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {feito ? (
            <div className="p4-recibo" aria-live="polite">
              <div className="p4-recibo-topo">
                <span className="p4-rotulo">Protocolo de entrega</span>
                <span className="p4-recibo-estado">Registrado</span>
              </div>
              <div className="p4-recibo-hora"><b>{hora(feito.registrado_em)}</b><span>{feito.recebido_por}</span></div>
              <dl className="p4-recibo-dl">
                <dt>Nº</dt><dd>{feito.protocolo}</dd>
                <dt>Itens</dt><dd>{linhas.length} de {linhas.length} conferidos</dd>
                <dt>Assinatura</dt><dd style={{ fontFamily: 'var(--font-sans)' }}>{feito.com_assinatura ? 'Assinado por quem recebeu' : `Sem assinatura · ${motivo.trim()}`}</dd>
                <dt>Local</dt><dd style={{ fontFamily: 'var(--font-sans)' }}>{textoLocal(local)}</dd>
                <dt>Etapa</dt><dd style={{ fontFamily: 'var(--font-sans)' }}>{feito.pedido.etapa.rotulo}</dd>
              </dl>
            </div>
          ) : (
            <>
              <div className="p4-rotulo">Conferir itens</div>
              <div className="p4-lista" role="group" aria-label="Conferir itens">
                {p.itens_venda.map((it, i) => {
                  const l = it.linha_id;
                  const on = l !== undefined && conferidos.includes(l);
                  return (
                    <button key={l ?? `i${i}`} type="button" role="checkbox" aria-checked={on} className={'en-item' + (on ? ' on' : '')}
                      disabled={l === undefined || enviando} onClick={() => l !== undefined && alternar(l)}>
                      <span className="en-box" aria-hidden="true">{on ? '✓' : ''}</span>
                      <span style={{ flex: 1, minWidth: 0 }}><span className="pd-item-d">{it.produto}</span><span className="pd-item-m">{it.quantidade} un</span></span>
                    </button>
                  );
                })}
              </div>
              {erros.itens && <span className="en-erro">{erros.itens}</span>}

              <label className="p4-rotulo" htmlFor="en-nome">Quem recebeu</label>
              <input id="en-nome" className="en-input" value={recebidoPor} maxLength={120} autoComplete="off" disabled={enviando}
                placeholder="Nome de quem recebeu" onChange={(e) => setRecebidoPor(e.target.value)} />
              {erros.recebido && <span className="en-erro">{erros.recebido}</span>}

              {podeSemAssinatura(ajustes) && (
                <button type="button" role="checkbox" aria-checked={semAssinatura} className={'en-sem' + (semAssinatura ? ' on' : '')}
                  disabled={enviando} onClick={() => { setSemAssinatura((x) => !x); setAssinou(false); }}>
                  <span className="en-box" aria-hidden="true">{semAssinatura ? '✓' : ''}</span>Recebido sem assinatura
                </button>
              )}
              {sem ? (
                <input className="en-input" value={motivo} maxLength={200} disabled={enviando} aria-label="Motivo da entrega sem assinatura"
                  placeholder="Por quê? Ex.: deixado com o porteiro" onChange={(e) => setMotivo(e.target.value)} />
              ) : (
                <>
                  <div className="en-ass-topo">
                    <span className="p4-rotulo">Assinatura</span>
                    <button type="button" className="en-limpar" disabled={!assinou || enviando} onClick={() => quadro.current?.limpar()}>Limpar</button>
                  </div>
                  <QuadroAssinatura controle={quadro} aoMudar={setAssinou} travado={enviando} />
                </>
              )}
              {erros.assinatura && <span className="en-erro">{erros.assinatura}</span>}

              <div className="en-local">
                <span className="p4-rotulo">Localização</span>
                <span className="en-local-v">
                  {gps.estado === 'buscando' ? 'Buscando…' : gps.estado === 'ok' ? textoLocal(gps.local)
                    : gps.estado === 'negado' ? 'Permissão negada' : gps.estado === 'erro' ? 'Não foi possível localizar' : 'Não registrada'}
                </span>
                {exigeLocal && (gps.estado === 'negado' || gps.estado === 'erro') && (
                  <button type="button" className="en-limpar" onClick={() => localizar(true)}>Tentar de novo</button>
                )}
              </div>
              {erros.local && <span className="en-erro">{erros.local}</span>}
              {erros.geral && <span className="en-erro">{erros.geral}</span>}
            </>
          )}
        </div>
      </div>
      <div className="pd-rodape">
        {feito ? (
          <button className="p4-cta" onClick={aoVoltar}>Voltar ao pedido</button>
        ) : (
          <>
            {falta && <span className="en-falta">{falta}</span>}
            <button className="p4-cta" disabled={!!falta || !online || enviando} onClick={registrar}>{enviando ? 'Registrando…' : 'Registrar entrega'}</button>
            {!online && <span className="pd-rodape-nota">Sem conexão. Registrar a entrega precisa de internet.</span>}
          </>
        )}
      </div>
    </>
  );
}

interface Assinatura { png: () => string | null; limpar: () => void }

/** Quadro de assinatura com o dedo. Desenha na cor do tema; o PNG enviado é tinta escura em fundo branco (600×240). */
function QuadroAssinatura({ controle, aoMudar, travado }: { controle: RefObject<Assinatura | null>; aoMudar: (assinou: boolean) => void; travado: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  /** Traços em coordenadas 0–1, para redesenhar em qualquer tamanho. */
  const tracos = useRef<Ponto[][]>([]);
  const desenhando = useRef(false);

  const desenhar = useCallback(() => {
    const c = canvas.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d'); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    pintar(ctx, tracos.current, w, h, getComputedStyle(c).color, 2.5);
  }, []);
  useEffect(() => {
    desenhar();
    const c = canvas.current;
    const ro = typeof ResizeObserver !== 'undefined' && c ? new ResizeObserver(desenhar) : null;
    if (ro && c) ro.observe(c);
    const tema = window.matchMedia?.('(prefers-color-scheme: dark)');
    tema?.addEventListener?.('change', desenhar);
    return () => { ro?.disconnect(); tema?.removeEventListener?.('change', desenhar); };
  }, [desenhar]);

  const ponto = (e: PE<HTMLCanvasElement>): Ponto => {
    const r = e.currentTarget.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };
  const descer = (e: PE<HTMLCanvasElement>) => {
    if (travado) return;
    desenhando.current = true;
    tracos.current.push([ponto(e)]);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
  };
  const mover = (e: PE<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    const t = tracos.current[tracos.current.length - 1];
    t.push(ponto(e));
    if (t.length === 2) aoMudar(true);
    desenhar();
  };
  const subir = () => { desenhando.current = false; };

  useImperativeHandle(controle, () => ({
    limpar: () => { tracos.current = []; desenhar(); aoMudar(false); },
    png: () => {
      if (!tracos.current.some((t) => t.length > 1)) return null;
      const o = document.createElement('canvas');
      o.width = 600; o.height = 240;
      const ctx = o.getContext('2d'); if (!ctx) return null;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, o.width, o.height);
      pintar(ctx, tracos.current, o.width, o.height, '#111111', 4);
      return o.toDataURL('image/png');
    },
  }), [desenhar, aoMudar]);

  return (
    <div className="en-quadro">
      <canvas ref={canvas} className="en-canvas" role="img"
        aria-label="Área de assinatura. Sem como assinar, marque Recebido sem assinatura."
        onPointerDown={descer} onPointerMove={mover} onPointerUp={subir} onPointerCancel={subir} onPointerLeave={subir} />
      {!tracos.current.some((t) => t.length > 1) && <span className="en-dica">Assine aqui com o dedo</span>}
      <span className="en-linha" aria-hidden="true" />
    </div>
  );
}

function pintar(ctx: CanvasRenderingContext2D, tracos: Ponto[][], w: number, h: number, cor: string, largura: number) {
  ctx.strokeStyle = cor; ctx.lineWidth = largura; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const t of tracos) {
    if (t.length < 2) continue;
    ctx.beginPath();
    ctx.moveTo(t[0][0] * w, t[0][1] * h);
    for (const [x, y] of t.slice(1)) ctx.lineTo(x * w, y * h);
    ctx.stroke();
  }
}
