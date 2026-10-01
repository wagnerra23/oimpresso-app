// Início — painel do dia do colaborador (estrutura do Home do design-v3:
// saudação + card de destaque + KPIs), só com o que a API do ponto entrega.
import { useEffect, useState } from 'react';
import { api, type EscalaHoje, type Kpis, type MarcacaoHoje } from '../api';
import { fmtMin, rotuloTipo, TIPOS } from '../ponto-regras';
import { Ic } from '../icones';

const saudacao = (h: number) => (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
const PREVISTO: Record<string, keyof NonNullable<EscalaHoje['turno']>> = {
  ENTRADA: 'hora_entrada', ALMOCO_INICIO: 'hora_almoco_inicio', ALMOCO_FIM: 'hora_almoco_fim', SAIDA: 'hora_saida',
};

export function Inicio({ irParaPonto }: { irParaPonto: () => void }) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [escala, setEscala] = useState<EscalaHoje | null>(null);
  const [hoje, setHoje] = useState<MarcacaoHoje[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.kpis(), api.escalaHoje(), api.marcacoesHoje()])
      .then(([k, e, h]) => { setKpis(k); setEscala(e); setHoje(h.marcacoes); })
      .catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, []);

  const agora = new Date();
  const dataBruta = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const data = dataBruta.charAt(0).toUpperCase() + dataBruta.slice(1);
  const proxima = hoje && hoje.length < 4 ? TIPOS[hoje.length] : null;
  const horaPrevista = proxima && escala?.turno ? escala.turno[PREVISTO[proxima.id]] : null;

  return (
    <>
      <div className="oi-head">
        <div className="oi-head-row">
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <div className="oi-head-eyebrow">{data}</div>
            <div className="oi-head-title">{saudacao(agora.getHours())}</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        {erro && <div className="oi-section"><p className="app-erro">{erro}</p></div>}

        <div className="oi-section">
          <button onClick={irParaPonto} className="oi-card" style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
            background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)', padding: 16, display: 'flex', flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <span style={{ color: 'var(--accent)' }}><Ic.relogio tamanho={30} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)' }}>
                {proxima ? 'Próxima marcação' : hoje ? 'Jornada de hoje' : 'Carregando…'}
              </span>
              <b style={{ display: 'block', fontSize: 18 }}>
                {proxima ? proxima.label : hoje ? 'Todas registradas' : '—'}
                {horaPrevista ? <span className="oi-mono" style={{ fontWeight: 500, color: 'var(--text-dim)' }}> · prevista {horaPrevista.slice(0, 5)}</span> : null}
              </b>
              {escala?.escala && <span style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)' }}>Escala {escala.escala.nome}</span>}
            </span>
            <span style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}>Bater ›</span>
          </button>
        </div>

        <div className="oi-section">
          <div className="oi-section-h">Hoje</div>
          <div className="oi-kpis" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="oi-kpi"><small>Marcações</small><b className="oi-mono">{kpis ? kpis.marcacoes_hoje : '—'}</b></div>
            <div className="oi-kpi"><small>Justificativas pendentes</small><b className="oi-mono">{kpis ? kpis.intercorrencias_pendentes : '—'}</b></div>
            <div className="oi-kpi"><small>Banco de horas</small><b className="oi-mono">{kpis ? fmtMin(kpis.saldo_minutos) : '—'}</b></div>
          </div>
        </div>

        {hoje && hoje.length > 0 && (
          <div className="oi-section">
            <div className="oi-section-h">Marcações de hoje</div>
            <div className="ptm-hoje">
              {hoje.map((m) => (
                <div className="ptm-linha" key={m.id}><b>{m.hora}</b><span>{rotuloTipo(m.tipo)}</span><small>NSR {m.nsr}</small></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
