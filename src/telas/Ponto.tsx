// Ponto — desenho v4 (mobile/ref/design-v4, telas 36 Bater ponto · 37 Meu espelho · 38 Justificar).
// Sem "REP-P" nem citação da Portaria na tela: ressalva legal (ERP #8417, D9) — não anunciar REP-P
// antes do registro no INPI e do certificado ICP-Brasil. O v4 mostra o selo; aqui ele sai de propósito.
// Sem câmera, sem biometria (ADR 0383). Regras do servidor (MobileMarcacaoService) repetidas só
// para não mandar o que vai voltar 422: GPS > 500 m e relógio > 30 s travam o botão.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { api, drift, ErroApi, type Espelho, type EscalaHoje, type Intercorrencia, type MarcacaoCriada,
  type MarcacaoHoje, type Me, type Saldo, type TipoMarcacao } from '../api';
import { LIMITES, MOTIVOS, TIPOS, agoraIsoLocal, aplicarLimites, fmtMin, hojeIso, motivoBloqueio, rotuloTipo, type Gps } from '../ponto-regras';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
type Aba = 'bater' | 'espelho' | 'justificar';

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataLonga = (d: Date) => `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()} · ${DIAS[d.getDay()]}`;
const semColaborador = (e: unknown) => e instanceof ErroApi && e.codigo === 'sem_colaborador';

export function Ponto({ avisar, online, voltar }: { avisar: Aviso; online: boolean; voltar?: ReactNode }) {
  const [aba, setAba] = useState<Aba>('bater');
  const [diaJustificar, setDiaJustificar] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [me, setMe] = useState<Me | null>(null);

  // GET /ponto/api/me: nome e matrícula no cabeçalho e os limites do servidor. Sem a rota (404), segue sem.
  useEffect(() => {
    api.me().then((m) => { setMe(m); aplicarLimites(m.limites); }).catch((e) => { if (semColaborador(e)) setBloqueado(true); });
  }, []);

  const titulo = aba === 'bater' ? 'Ponto' : aba === 'espelho' ? 'Meu espelho' : 'Justificar';
  const justificarDia = (data: string) => { setDiaJustificar(data); setAba('justificar'); };

  return (
    <>
      <div className="p4-head">
        <div className="p4-head-row">
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-titulo">{titulo}</div>
            <div className="p4-sub">{me ? `${me.nome}${me.matricula ? ` · matrícula ${me.matricula}` : ''}` : 'Registro de ponto'}</div>
          </div>
        </div>
        {!bloqueado && (
          <div className="p4-abas" role="tablist" aria-label="Telas do ponto">
            {(['bater', 'espelho', 'justificar'] as const).map((a) => (
              <button key={a} role="tab" aria-selected={aba === a} className={aba === a ? 'on' : ''} onClick={() => setAba(a)}>
                {a === 'bater' ? 'Bater ponto' : a === 'espelho' ? 'Meu espelho' : 'Justificar'}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="oi-scroll">
        {bloqueado ? (
          <div className="p4-vazio">
            <b>Ponto não liberado neste aparelho</b>
            <span>Seu usuário precisa de cadastro de ponto. Peça ao RH em Colaboradores.</span>
          </div>
        ) : aba === 'bater' ? <BaterPonto avisar={avisar} online={online} aoSemCadastro={() => setBloqueado(true)} />
          : aba === 'espelho' ? <MeuEspelho aoJustificar={justificarDia} />
          : <Justificar avisar={avisar} diaInicial={diaJustificar} />}
      </div>
    </>
  );
}

// ═════════════ 36 · Bater ponto ═════════════
function BaterPonto({ avisar, online, aoSemCadastro }: { avisar: Aviso; online: boolean; aoSemCadastro: () => void }) {
  const [agora, setAgora] = useState(new Date());
  const [gps, setGps] = useState<Gps>({ estado: 'buscando' });
  const [hoje, setHoje] = useState<MarcacaoHoje[] | null>(null);
  const [erroHoje, setErroHoje] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoMarcacao>('ENTRADA');
  const [enviando, setEnviando] = useState(false);
  const [recibo, setRecibo] = useState<(MarcacaoCriada & { hora: string; local: string }) | null>(null);

  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);

  const carregarHoje = useCallback(async () => {
    try {
      const r = await api.marcacoesHoje();
      setHoje(r.marcacoes);
      setErroHoje(null);
      setTipo(TIPOS[Math.min(r.marcacoes.length, 3)].id);
    } catch (e) {
      if (semColaborador(e)) { aoSemCadastro(); return; }
      setErroHoje(e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, [aoSemCadastro]);
  useEffect(() => { carregarHoje(); }, [carregarHoje]);

  const localizar = useCallback(async () => {
    setGps({ estado: 'buscando' });
    try {
      const p = await Geolocation.checkPermissions();
      if (p.location !== 'granted') {
        const r = await Geolocation.requestPermissions({ permissions: ['location'] });
        if (r.location !== 'granted') { setGps({ estado: 'negado' }); return; }
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      setGps({ estado: 'ok', lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) });
    } catch (e) {
      setGps(/denied|permission/i.test(String((e as Error)?.message ?? e)) ? { estado: 'negado' } : { estado: 'erro' });
    }
  }, []);
  useEffect(() => { localizar(); }, [localizar]);

  const bloqueio = motivoBloqueio(online, gps, drift());

  const marcar = async () => {
    if (gps.estado !== 'ok' || bloqueio) return;
    setEnviando(true);
    try {
      const { identifier } = await Device.getId();
      const r = await api.marcar({ tipo, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, device_uuid: identifier, timestamp_device: agoraIsoLocal() });
      const m = r.marcacao;
      setRecibo({ ...m, hora: new Date(m.momento).toTimeString().slice(0, 5), local: `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)} · ±${gps.accuracy} m` });
      avisar(m.revisar ? 'Marcação registrada — fora da área, vai para revisão do RH.' : 'Marcação registrada.', m.revisar ? 'warn' : 'ok');
      await carregarHoje();
    } catch (e) {
      if (semColaborador(e)) { aoSemCadastro(); return; }
      avisar(e instanceof Error ? e.message : 'Não foi possível registrar a marcação.', 'erro');
    } finally {
      setEnviando(false);
    }
  };

  const ponto = gps.estado === 'ok' ? (gps.accuracy > LIMITES.accuracy_max ? 'warn' : 'ok') : gps.estado === 'buscando' ? '' : 'bad';
  const proxima = hoje ? hoje.length : -1;

  return (
    <div className="p4-corpo">
      <div className="p4-relogio">
        <small>agora</small>
        <b>{agora.toTimeString().slice(0, 8)}</b>
        <small>{dataLonga(agora)}</small>
      </div>

      <div className={'p4-gps' + (ponto === 'warn' || ponto === 'bad' ? ' ruim' : '')}>
        <span className={'p4-ponto ' + ponto} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-gps-t">{gps.estado === 'ok' ? `GPS ±${gps.accuracy} m` : gps.estado === 'buscando' ? 'Buscando GPS…' : 'GPS indisponível'}</div>
          <div className="p4-gps-s">A área da empresa é conferida pelo servidor.</div>
        </div>
        <button className="p4-link" onClick={localizar}>Atualizar local</button>
      </div>

      <div className="p4-rotulo">Tipo de marcação</div>
      <div className="p4-tipos" role="radiogroup" aria-label="Tipo de marcação">
        {TIPOS.map((t) => (
          <button key={t.id} role="radio" aria-checked={tipo === t.id} className={'p4-tipo' + (tipo === t.id ? ' on' : '')} onClick={() => setTipo(t.id)}>
            <b>{t.label}</b><small>{t.hint}</small>
          </button>
        ))}
      </div>

      <button className="p4-cta" disabled={!!bloqueio || enviando} onClick={marcar}>
        {enviando ? 'Registrando…' : `Bater ponto — ${rotuloTipo(tipo)}`}
      </button>
      {bloqueio && <p className="p4-aviso">{bloqueio}</p>}

      {recibo && (
        <div className="p4-recibo" aria-live="polite">
          <div className="p4-recibo-topo">
            <span className="p4-rotulo">Comprovante de marcação</span>
            <span className={'p4-recibo-estado' + (recibo.revisar ? ' warn' : '')}>{recibo.revisar ? 'Em revisão · fora da área' : 'Registrada'}</span>
          </div>
          <div className="p4-recibo-hora"><b>{recibo.hora}</b><span>{rotuloTipo(recibo.tipo)}</span></div>
          <dl className="p4-recibo-dl">
            <dt>NSR</dt><dd>{recibo.nsr}</dd>
            <dt>Hash</dt><dd>{recibo.hash_trunc}</dd>
            <dt>Local</dt><dd style={{ fontFamily: 'var(--font-sans)' }}>{recibo.local}</dd>
          </dl>
        </div>
      )}

      <div className="p4-rotulo">Jornada de hoje</div>
      {erroHoje && <p className="app-erro">{erroHoje}</p>}
      <div className="p4-slots">
        {TIPOS.map((t, i) => {
          const m = hoje?.[i];
          const prox = !m && i === proxima;
          return (
            <div key={t.id} className={'p4-slot' + (m ? '' : prox ? ' prox' : ' vazio')}>
              <span>{t.label}</span>
              <b>{m?.hora ?? '—:—'}</b>
              <small className={m?.revisar ? 'warn' : prox ? 'prox' : ''}>{m ? (m.revisar ? 'fora da área' : `NSR ${m.nsr}`) : prox ? 'próxima' : ''}</small>
            </div>
          );
        })}
      </div>
      <p className="p4-legal">Marcação imutável: correção só por justificativa, que o gestor aprova. Sem selfie nem biometria.</p>
    </div>
  );
}

// ═════════════ 37 · Meu espelho ═════════════
const ESTADO_JUST: Record<string, { label: string; tom: string }> = {
  RASCUNHO: { label: 'Rascunho', tom: '' }, PENDENTE: { label: 'Pendente', tom: 'warn' }, APROVADA: { label: 'Aprovada', tom: 'ok' },
  APLICADA: { label: 'Aplicada', tom: 'ok' }, REJEITADA: { label: 'Rejeitada', tom: 'danger' }, CANCELADA: { label: 'Cancelada', tom: '' },
};
const rotuloMotivo = (v: string) => MOTIVOS.find((m) => m.value === v)?.label ?? v;

function MeuEspelho({ aoJustificar }: { aoJustificar: (data: string) => void }) {
  const agora = new Date();
  const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const [espelho, setEspelho] = useState<Espelho | 'sem-rota' | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [escala, setEscala] = useState<EscalaHoje | null>(null);
  const [justs, setJusts] = useState<Intercorrencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.espelho(mes).then(setEspelho).catch((e) => {
      if (e instanceof ErroApi && e.status === 404) setEspelho('sem-rota');
      else setErro(e instanceof Error ? e.message : 'Não foi possível carregar.');
    });
    Promise.all([api.saldo(), api.escalaHoje(), api.intercorrencias()])
      .then(([s, e, i]) => { setSaldo(s); setEscala(e); setJusts(i.intercorrencias); })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, [mes]);

  if (erro) return <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>;
  if (!espelho) return <div className="p4-corpo"><p className="p4-legal">Carregando…</p></div>;

  const nomeMes = `${MESES[agora.getMonth()][0].toUpperCase()}${MESES[agora.getMonth()].slice(1)} de ${agora.getFullYear()}`;
  const t = espelho !== 'sem-rota' ? espelho.totais : null;
  const dias = espelho !== 'sem-rota' ? espelho.linhas.filter((l) => !l.is_weekend || l.marcacoes.length).slice().reverse() : [];
  const turno = escala?.turno;

  return (
    <div className="p4-corpo">
      <div className="p4-kpis">
        <div className="p4-kpi"><span>Banco de horas</span>
          <b style={{ color: saldo && saldo.saldo_minutos < 0 ? 'var(--danger)' : saldo && saldo.saldo_minutos > 0 ? 'var(--ok)' : undefined }}>{saldo ? fmtMin(saldo.saldo_minutos) : '—'}</b></div>
        {t ? (<>
          <div className="p4-kpi"><span>Trabalhado</span><b>{fmtMin(t.trabalhado)}</b></div>
          <div className="p4-kpi"><span>Hora extra</span><b>{fmtMin(t.he_diurna + t.he_noturna)}</b></div>
          <div className="p4-kpi"><span>Faltas e atrasos</span><b>{fmtMin(t.falta + t.atraso)}</b></div>
        </>) : (
          <div className="p4-kpi"><span>Justificativas pendentes</span><b>{justs ? justs.filter((j) => j.estado === 'PENDENTE').length : '—'}</b></div>
        )}
      </div>

      {espelho !== 'sem-rota' && (<>
        <div className="p4-rotulo">{nomeMes} · dia a dia</div>
        {dias.length === 0 ? <p className="p4-legal">Nenhum dia apurado ainda neste mês.</p> : (
          <div className="p4-lista">
            {dias.map((l) => (
              <button key={l.data} className={'p4-dia' + (l.divergencia ? ' diverg' : '')} disabled={!l.divergencia}
                onClick={() => l.divergencia && aoJustificar(l.data)} aria-label={l.divergencia ? `Dia ${l.dia}: conferir, toque para justificar` : undefined}>
                <span className="p4-dia-d"><b>{String(l.dia).padStart(2, '0')}</b><small>{l.dow}</small></span>
                <span className={'p4-dia-m' + (l.marcacoes.length ? '' : ' off')}>{l.marcacoes.length ? l.marcacoes.map((m, i) => <span key={i}>{m.hora}</span>) : 'sem marcação'}</span>
                <span className="p4-dia-t">{fmtMin(l.trabalhado)}{l.divergencia && <small>conferir</small>}</span>
              </button>
            ))}
          </div>
        )}
      </>)}

      <div className="p4-rotulo">{escala?.escala ? `Escala de hoje · ${escala.escala.nome}` : 'Escala de hoje'}</div>
      {turno ? (
        <div className="p4-slots">
          {([['Entrada', turno.hora_entrada], ['Almoço', turno.hora_almoco_inicio], ['Retorno', turno.hora_almoco_fim], ['Saída', turno.hora_saida]] as const).map(([r, h]) => (
            <div key={r} className="p4-slot" style={{ minHeight: 56 }}><span>{r}</span><b>{h ? h.slice(0, 5) : '—'}</b></div>
          ))}
        </div>
      ) : <p className="p4-legal">Sem turno hoje.</p>}

      <div className="p4-rotulo">Minhas justificativas</div>
      {!justs || justs.length === 0 ? <p className="p4-legal">Nenhuma justificativa enviada.</p> : (
        <div className="p4-lista">
          {justs.slice(0, 10).map((j) => {
            const st = ESTADO_JUST[j.estado] ?? { label: j.estado, tom: '' };
            return (
              <div className="p4-just" key={j.id}>
                <div>
                  <b>{j.codigo ?? rotuloMotivo(j.tipo)}</b>
                  <span>{j.data ? j.data.split('-').reverse().join('/') : '—'} · {j.dia_todo ? 'dia todo' : `${j.intervalo_inicio?.slice(0, 5) ?? ''}–${j.intervalo_fim?.slice(0, 5) ?? ''}`}</span>
                </div>
                <span className={'p4-pill ' + st.tom}>{st.label}</span>
              </div>
            );
          })}
        </div>
      )}
      <p className="p4-legal">
        {espelho === 'sem-rota' ? 'O dia a dia do mês ainda não chega ao app. ' : 'Toque num dia a conferir para justificar. '}
        Espelho do mês corrente. O oficial sai no fechamento da competência.
      </p>
    </div>
  );
}

// ═════════════ 38 · Justificar ═════════════
function Justificar({ avisar, diaInicial }: { avisar: Aviso; diaInicial: string | null }) {
  const vazio = { tipo: '', data: diaInicial ?? hojeIso(), dia_todo: false, ini: '', fim: '', just: '' };
  const [f, setF] = useState(vazio);
  const [enviando, setEnviando] = useState(false);
  const [motivos, setMotivos] = useState(MOTIVOS);
  useEffect(() => { if (diaInicial) setF((o) => ({ ...o, data: diaInicial })); }, [diaInicial]);
  // Motivos vêm do ERP (GET /ponto/api/intercorrencias/tipos); a lista fixa é só fallback.
  useEffect(() => { api.tipos().then((t) => { if (Array.isArray(t) && t.length) setMotivos(t); }).catch(() => {}); }, []);

  const erro = !f.tipo ? 'Escolha o motivo.'
    : !f.dia_todo && (!f.ini || !f.fim) ? 'Informe o horário (das/às) ou marque Dia todo — o gestor decide pela janela.'
    : !f.dia_todo && f.fim <= f.ini ? 'O fim precisa ser depois do início.'
    : f.just.trim().length < 10 ? 'Descreva com pelo menos 10 caracteres.' : null;

  const enviar = async () => {
    if (erro) return;
    setEnviando(true);
    try {
      await api.justificar({ tipo: f.tipo, data: f.data, dia_todo: f.dia_todo,
        intervalo_inicio: f.dia_todo ? null : f.ini, intervalo_fim: f.dia_todo ? null : f.fim, justificativa: f.just.trim() });
      avisar('Justificativa enviada — está na fila do gestor como pendente.', 'ok');
      setF({ ...vazio, data: hojeIso() });
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível enviar a justificativa.', 'erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="p4-corpo">
      <div className="p4-rotulo">O que aconteceu</div>
      <div className="p4-motivos">
        {motivos.map((m) => (
          <button key={m.value} aria-pressed={f.tipo === m.value} className={'p4-motivo' + (f.tipo === m.value ? ' on' : '')}
            onClick={() => setF((o) => ({ ...o, tipo: m.value }))}>{m.label}</button>
        ))}
      </div>

      <div className="p4-rotulo">Quando</div>
      <div className="p4-cartao">
        <div className="p4-campo">
          <label htmlFor="j-dia">Dia</label>
          <input id="j-dia" type="date" max={hojeIso()} value={f.data} onChange={(e) => setF((o) => ({ ...o, data: e.target.value }))} />
        </div>
        <label className="p4-check"><input type="checkbox" checked={f.dia_todo} onChange={(e) => setF((o) => ({ ...o, dia_todo: e.target.checked }))} />Dia todo</label>
        {!f.dia_todo && (
          <div className="p4-2col">
            <div className="p4-campo"><label htmlFor="j-ini">Das</label><input id="j-ini" type="time" value={f.ini} onChange={(e) => setF((o) => ({ ...o, ini: e.target.value }))} /></div>
            <div className="p4-campo"><label htmlFor="j-fim">Às</label><input id="j-fim" type="time" value={f.fim} onChange={(e) => setF((o) => ({ ...o, fim: e.target.value }))} /></div>
          </div>
        )}
      </div>

      <div className="p4-rotulo">Justificativa</div>
      <textarea className="p4-texto" rows={4} maxLength={2000} value={f.just} aria-label="Justificativa"
        onChange={(e) => setF((o) => ({ ...o, just: e.target.value }))} placeholder="Ex.: esqueci de marcar a volta do almoço, estava na obra." />
      {erro && <p className="p4-aviso">{erro}</p>}
      <button className="p4-cta" disabled={!!erro || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar para aprovação'}</button>
      <p className="p4-legal">Vai para a fila do gestor como pendente. A marcação original não muda.</p>
    </div>
  );
}
