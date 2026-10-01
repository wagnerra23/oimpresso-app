// Ponto — as três telas do REP-P do bolso, do protótipo ponto-mobile.jsx:
// Bater ponto · Meu espelho · Justificar. Sem câmera, sem biometria (ADR 0383).
import { useCallback, useEffect, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { api, drift, ErroApi, type Espelho, type MarcacaoHoje, type TipoMarcacao } from '../api';
import { LIMITES, MOTIVOS, TIPOS, agoraIsoLocal, fmtMin, hojeIso, rotuloTipo } from '../ponto-regras';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;
type Gps =
  | { estado: 'buscando' }
  | { estado: 'negado' }
  | { estado: 'erro'; msg: string }
  | { estado: 'ok'; lat: number; lng: number; accuracy: number };

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function Ponto({ avisar, telaInicial = 'bater' }: { avisar: Aviso; telaInicial?: 'bater' | 'espelho' | 'justificar' }) {
  const [tela, setTela] = useState(telaInicial);
  useEffect(() => setTela(telaInicial), [telaInicial]);
  const titulo = tela === 'bater' ? 'Ponto' : tela === 'espelho' ? 'Meu espelho' : 'Justificar';
  return (
    <>
      <div className="oi-head">
        <div className="oi-head-row">
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div className="oi-head-eyebrow">REP-P · celular</div>
            <div className="oi-head-title">{titulo}</div>
          </div>
        </div>
      </div>
      <div className="app-seg" role="tablist" aria-label="Telas do ponto">
        {(['bater', 'espelho', 'justificar'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tela === t} className={tela === t ? 'on' : ''} onClick={() => setTela(t)}>
            {t === 'bater' ? 'Bater ponto' : t === 'espelho' ? 'Meu espelho' : 'Justificar'}
          </button>
        ))}
      </div>
      <div className="oi-scroll">
        {tela === 'bater' ? <BaterPonto avisar={avisar} /> : tela === 'espelho' ? <MeuEspelho /> : <Justificar avisar={avisar} />}
      </div>
    </>
  );
}

// ═════════════ Bater ponto ═════════════
function BaterPonto({ avisar }: { avisar: Aviso }) {
  const [agora, setAgora] = useState(new Date());
  const [gps, setGps] = useState<Gps>({ estado: 'buscando' });
  const [hoje, setHoje] = useState<MarcacaoHoje[] | null>(null);
  const [erroHoje, setErroHoje] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoMarcacao>('ENTRADA');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 1000); return () => clearInterval(t); }, []);

  const carregarHoje = useCallback(async () => {
    try {
      const r = await api.marcacoesHoje();
      setHoje(r.marcacoes);
      setErroHoje(null);
      setTipo(TIPOS[Math.min(r.marcacoes.length, 3)].id);
    } catch (e) {
      setErroHoje(e instanceof Error ? e.message : 'Não foi possível carregar.');
    }
  }, []);
  useEffect(() => { carregarHoje(); }, [carregarHoje]);

  const lerGps = useCallback(async () => {
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
      const msg = e instanceof Error ? e.message : String(e);
      setGps(/denied|permission/i.test(msg) ? { estado: 'negado' } : { estado: 'erro', msg: 'Não foi possível obter a localização. Ative o GPS e tente de novo.' });
    }
  }, []);
  useEffect(() => { lerGps(); }, [lerGps]);

  const d = drift();
  const bloqueio =
    gps.estado === 'negado' ? 'Sem permissão de localização. Libere em Ajustes › Apps › oimpresso › Localização.'
    : gps.estado === 'erro' ? gps.msg
    : gps.estado === 'buscando' ? 'Buscando sinal de GPS…'
    : gps.accuracy > LIMITES.accuracy_max ? 'Sinal de GPS fraco — aproxime-se de área aberta.'
    : d !== null && Math.abs(d) > LIMITES.drift_max ? `Relógio do aparelho fora de sincronia (${d}s) — ative a hora automática.`
    : null;

  const marcar = async () => {
    if (gps.estado !== 'ok' || bloqueio) return;
    setEnviando(true);
    try {
      const { identifier } = await Device.getId();
      const r = await api.marcar({ tipo, lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy,
        device_uuid: identifier, timestamp_device: agoraIsoLocal() });
      const m = r.marcacao;
      avisar(`Marcação registrada · NSR ${m.nsr} · hash ${m.hash_trunc.slice(0, 8)}` + (m.revisar ? ' · fora da área, vai para revisão do RH' : ''), m.revisar ? 'warn' : 'ok');
      await carregarHoje();
    } catch (e) {
      avisar(e instanceof ErroApi || e instanceof Error ? e.message : 'Falha ao registrar.', 'erro');
    } finally {
      setEnviando(false);
    }
  };

  const hhmmss = agora.toTimeString().slice(0, 8);
  const dataLonga = `${agora.getDate()} de ${MESES[agora.getMonth()]} de ${agora.getFullYear()} · ${DIAS[agora.getDay()]}`;
  const ponto = gps.estado === 'ok' ? (gps.accuracy > LIMITES.accuracy_max ? 'bad' : 'ok') : gps.estado === 'buscando' ? 'warn' : 'bad';

  return (
    <div className="ptm-screen">
      <div className="ptm-hero">
        <span className="ptm-hero-l">agora</span>
        <b className="ptm-clock">{hhmmss}</b>
        <span className="ptm-hero-l">{dataLonga}</span>
      </div>

      <button className="ptm-gps" onClick={lerGps} style={{ font: 'inherit', color: 'inherit', textAlign: 'left', width: '100%' }} aria-label="Atualizar localização">
        <span className={'ptm-dot ' + ponto} />
        <div>
          <b>{gps.estado === 'ok' ? `GPS ±${gps.accuracy}m` : gps.estado === 'buscando' ? 'Buscando GPS…' : 'GPS indisponível'}</b>
          <small>{gps.estado === 'ok' ? 'Toque para atualizar. A área da empresa é conferida pelo servidor.' : 'Toque para tentar de novo.'}</small>
        </div>
      </button>

      <div className="ptm-tipos" role="radiogroup" aria-label="Tipo de marcação">
        {TIPOS.map((t) => (
          <button key={t.id} role="radio" aria-checked={tipo === t.id} className={'ptm-tipo' + (tipo === t.id ? ' on' : '')} onClick={() => setTipo(t.id)}>
            <b>{t.label}</b><small>{t.hint}</small>
          </button>
        ))}
      </div>

      <button className="ptm-cta" disabled={!!bloqueio || enviando} onClick={marcar}>
        {enviando ? 'Registrando…' : `Bater ponto — ${rotuloTipo(tipo)}`}
      </button>
      {bloqueio && <p className="ptm-bloqueio">{bloqueio}</p>}

      <div className="ptm-hoje">
        <span className="ptm-h">Hoje</span>
        {erroHoje && <p className="app-erro">{erroHoje}</p>}
        {hoje && hoje.length === 0 && <p className="ptm-vazio">Nenhuma marcação registrada hoje.</p>}
        {hoje?.map((m) => (
          <div className="ptm-linha" key={m.id}>
            <b>{m.hora}</b>
            <span>{rotuloTipo(m.tipo)}</span>
            <small>NSR {m.nsr}{m.revisar ? ' · fora da área' : ''}</small>
          </div>
        ))}
      </div>
      <p className="ptm-legal">Marcação imutável (Portaria MTP 671/2021). Correção só por justificativa.</p>
    </div>
  );
}

// ═════════════ Meu espelho ═════════════
function MeuEspelho() {
  const agora = new Date();
  const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  const [dados, setDados] = useState<Espelho | null>(null);
  const [erro, setErro] = useState<{ indisponivel: boolean; msg: string } | null>(null);

  useEffect(() => {
    api.espelho(mes).then(setDados).catch((e) => {
      setErro({ indisponivel: e instanceof ErroApi && e.status === 404, msg: e instanceof Error ? e.message : 'Falha ao carregar.' });
    });
  }, [mes]);

  if (erro?.indisponivel) {
    return (
      <div className="ptm-screen">
        <div className="oi-empty"><b>Espelho ainda não disponível no app</b>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>Consulte o espelho do mês no oimpresso pelo computador. Em breve aparece aqui.</p></div>
      </div>
    );
  }
  if (erro) return <div className="ptm-screen"><p className="app-erro">{erro.msg}</p></div>;
  if (!dados) return <div className="ptm-screen"><p className="ptm-vazio">Carregando…</p></div>;

  const t = dados.totais;
  return (
    <div className="ptm-screen">
      {t && (
        <div className="ptm-tot">
          <div><small>Trabalhado</small><b>{fmtMin(t.trabalhado)}</b></div>
          <div><small>Hora extra</small><b>{fmtMin(t.he_diurna + t.he_noturna)}</b></div>
          <div><small>Faltas</small><b>{fmtMin(t.falta)}</b></div>
          <div><small>Atrasos</small><b>{fmtMin(t.atraso)}</b></div>
        </div>
      )}
      <span className="ptm-h">{MESES[agora.getMonth()][0].toUpperCase() + MESES[agora.getMonth()].slice(1)}/{agora.getFullYear()} · dia a dia</span>
      {dados.linhas.every((l) => !l.marcacoes.length && !l.trabalhado) && (
        <p className="ptm-vazio">Nenhum dia apurado ainda neste mês. As marcações de hoje aparecem aqui depois da apuração.</p>
      )}
      {dados.linhas.filter((l) => !l.is_weekend || l.marcacoes.length).slice().reverse().map((l) => (
        <div className={'ptm-dia' + (l.divergencia ? ' diverg' : '')} key={l.data}>
          <span className="ptm-dia-d"><b>{String(l.dia).padStart(2, '0')}</b><small>{l.dow}</small></span>
          <span className="ptm-dia-h">
            {l.marcacoes.length ? l.marcacoes.map((m, i) => <i key={i}>{m.hora}</i>) : <i className="off">sem marcação</i>}
          </span>
          <span className="ptm-dia-t">{fmtMin(l.trabalhado)}{l.divergencia && <small>conferir</small>}</span>
        </div>
      ))}
      <p className="ptm-legal">Espelho do mês corrente. O oficial sai no fechamento da competência.</p>
    </div>
  );
}

// ═════════════ Justificar ═════════════
function Justificar({ avisar }: { avisar: Aviso }) {
  const vazio = { tipo: '', data: hojeIso(), dia_todo: false, ini: '', fim: '', just: '' };
  const [f, setF] = useState(vazio);
  const [enviando, setEnviando] = useState(false);
  const erro = !f.tipo ? 'Escolha o motivo.'
    : !f.dia_todo && (!f.ini || !f.fim) ? 'Informe o horário (das/às) ou marque Dia todo.'
    : !f.dia_todo && f.fim <= f.ini ? 'O fim precisa ser depois do início.'
    : f.just.trim().length < 10 ? 'Descreva com pelo menos 10 caracteres.' : null;

  const enviar = async () => {
    if (erro) return;
    setEnviando(true);
    try {
      await api.justificar({ tipo: f.tipo, data: f.data, dia_todo: f.dia_todo,
        intervalo_inicio: f.dia_todo ? null : f.ini, intervalo_fim: f.dia_todo ? null : f.fim, justificativa: f.just.trim() });
      avisar('Justificativa enviada — está na fila de aprovação do gestor.', 'ok');
      setF(vazio);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Falha ao enviar.', 'erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="ptm-screen">
      <span className="ptm-h">O que aconteceu</span>
      <div className="ptm-motivos">
        {MOTIVOS.map((m) => (
          <button key={m.value} aria-pressed={f.tipo === m.value} className={'ptm-motivo' + (f.tipo === m.value ? ' on' : '')}
            onClick={() => setF((o) => ({ ...o, tipo: m.value }))}>{m.label}</button>
        ))}
      </div>
      <label className="ptm-lbl" htmlFor="j-dia">Dia</label>
      <input id="j-dia" className="ptm-in" type="date" max={hojeIso()} value={f.data} onChange={(e) => setF((o) => ({ ...o, data: e.target.value }))} />
      <label className="ptm-check"><input type="checkbox" checked={f.dia_todo} onChange={(e) => setF((o) => ({ ...o, dia_todo: e.target.checked }))} />Dia todo</label>
      {!f.dia_todo && (
        <div className="ptm-2col">
          <span><label className="ptm-lbl" htmlFor="j-ini">Das</label><input id="j-ini" className="ptm-in" type="time" value={f.ini} onChange={(e) => setF((o) => ({ ...o, ini: e.target.value }))} /></span>
          <span><label className="ptm-lbl" htmlFor="j-fim">Às</label><input id="j-fim" className="ptm-in" type="time" value={f.fim} onChange={(e) => setF((o) => ({ ...o, fim: e.target.value }))} /></span>
        </div>
      )}
      <label className="ptm-lbl" htmlFor="j-just">Justificativa</label>
      <textarea id="j-just" className="ptm-in ptm-ta" rows={4} maxLength={2000} value={f.just}
        onChange={(e) => setF((o) => ({ ...o, just: e.target.value }))} placeholder="Ex.: obra sem sinal, marquei ao chegar no galpão…" />
      <button className="ptm-cta" disabled={!!erro || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar para aprovação'}</button>
      {erro && <p className="ptm-bloqueio">{erro}</p>}
      <p className="ptm-legal">Vai para o gestor aprovar. A marcação original não muda.</p>
    </div>
  );
}
