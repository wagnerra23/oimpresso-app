// Início — desenho v4 (tela 01), dados pelo contrato API-CONTRATO-v1 §6 (ERP #8495) + o atalho do
// ponto (API do ponto). Cada bloco do painel que vem null (sem permissão) some, sem quebrar a tela.
// Fora do v4 de propósito: "Trocar" empresa (sem seletor de empresa — D2), os atalhos (Novo pedido,
// Venda rápida, Cobrar PIX, Conciliar — v2 ou computador) e o sino de notificações.
import { useEffect, useState } from 'react';
import { api, type EscalaHoje, type MarcacaoHoje, type PainelInicio } from '../api';
import { TIPOS } from '../ponto-regras';
import { Ic } from '../icones';
import { reais } from './Pedidos';
import { Notificacoes } from './Notificacoes';
import { useVoltar } from '../voltar';
import type { DestinoNotificacao } from '../api';

const saudacao = (h: number) => (h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite');
const PREVISTO: Record<string, keyof NonNullable<EscalaHoje['turno']>> = {
  ENTRADA: 'hora_entrada', ALMOCO_INICIO: 'hora_almoco_inicio', ALMOCO_FIM: 'hora_almoco_fim', SAIDA: 'hora_saida',
};
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const pct = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

interface Props {
  irParaPonto: () => void; irParaPedidos: () => void; irParaTarefas: () => void;
  /** Abre a área de destino de uma notificação (tela 16). */
  abrirDestino: (tipo: DestinoNotificacao, id: number | string | null) => void;
}

export function Inicio({ irParaPonto, irParaPedidos, irParaTarefas, abrirDestino }: Props) {
  const [painel, setPainel] = useState<PainelInicio | null>(null);
  const [notif, setNotif] = useState(false);
  useVoltar(notif, () => setNotif(false));
  const [erro, setErro] = useState<string | null>(null);
  // Ponto: só aparece para quem é colaborador (as rotas do ponto respondem erro para os demais).
  const [ponto, setPonto] = useState<{ escala: EscalaHoje; hoje: MarcacaoHoje[] } | null>(null);

  useEffect(() => {
    api.inicio().then(setPainel).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'));
    Promise.all([api.escalaHoje(), api.marcacoesHoje()]).then(([escala, h]) => setPonto({ escala, hoje: h.marcacoes })).catch(() => setPonto(null));
  }, []);

  const agora = new Date();
  const data = agora.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  const proxima = ponto && ponto.hoje.length < 4 ? TIPOS[ponto.hoje.length] : null;
  const horaPrevista = proxima && ponto?.escala.turno ? ponto.escala.turno[PREVISTO[proxima.id]] : null;

  const fat = painel?.faturado_hoje;
  const meta = painel?.meta_dia;
  const k = painel?.kpis;
  const temKpi = !!k && (k.pedidos_ativos !== null || k.pedidos_atrasados !== null || k.estoque_baixo !== null);

  if (notif) return <Notificacoes aoVoltar={() => setNotif(false)} abrirDestino={(tipo, id) => { setNotif(false); abrirDestino(tipo, id); }} />;

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">Início · Hoje, {data}</div>
            <div className="pd-titulo">{saudacao(agora.getHours())}{painel?.usuario ? `, ${painel.usuario}` : ''}</div>
          </div>
          <button className="nt-sino" onClick={() => setNotif(true)}
            aria-label={painel?.nao_lidas ? `Notificações, ${painel.nao_lidas} não lidas` : 'Notificações'}>
            <Ic.sino tamanho={22} />{!!painel?.nao_lidas && <i aria-hidden="true" />}
          </button>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {painel?.empresa && (
            <div className="in-empresa"><span className="pd-avatar" aria-hidden="true">{iniciais(painel.empresa)}</span><b>{painel.empresa}</b></div>
          )}

          {ponto && (
            <button onClick={irParaPonto} className="oi-card" style={{ width: '100%', textAlign: 'left', font: 'inherit', color: 'inherit',
              background: 'var(--accent-soft)', border: '1px solid color-mix(in oklch, var(--accent) 25%, transparent)', padding: 14, display: 'flex', flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <span style={{ color: 'var(--accent-text)' }}><Ic.relogio tamanho={26} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-dim)' }}>{proxima ? 'Próxima marcação' : 'Jornada de hoje'}</span>
                <b style={{ display: 'block', fontSize: 16 }}>{proxima ? proxima.label : 'Todas registradas'}</b>
                {horaPrevista && <span className="oi-mono" style={{ display: 'block', fontSize: 12.5, color: 'var(--text-dim)' }}>prevista {horaPrevista.slice(0, 5)}</span>}
              </span>
              <span style={{ color: 'var(--accent-text)', fontWeight: 600, fontSize: 14 }}>Bater ›</span>
            </button>
          )}

          {erro && <div className="p4-vazio"><b>Não foi possível carregar o painel</b><span>{erro}</span></div>}
          {!painel && !erro && <p className="p4-legal">Carregando…</p>}

          {fat && (
            <div className="in-hero">
              <span>Faturamento hoje</span>
              <b>{reais(fat.valor)}</b>
              {fat.variacao_pct !== null && (
                <small>{fat.variacao_pct >= 0 ? '+' : ''}{pct(fat.variacao_pct)}% em relação a ontem ({reais(fat.ontem)})</small>
              )}
              {meta && meta.valor > 0 && (
                <>
                  <div className="in-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round((fat.valor / meta.valor) * 100))} aria-label="Meta do dia">
                    <i style={{ width: `${Math.min(100, (fat.valor / meta.valor) * 100)}%` }} />
                  </div>
                  <small>{Math.round((fat.valor / meta.valor) * 100)}% da meta do dia de {reais(meta.valor)} (estimada pela meta do mês)</small>
                </>
              )}
            </div>
          )}

          {temKpi && (
            <div className="in-kpis">
              {k!.pedidos_ativos !== null && (
                <button className="in-kpi" onClick={irParaPedidos}><span>Pedidos</span><b>{k!.pedidos_ativos}</b><small>ativos</small></button>
              )}
              {k!.pedidos_atrasados !== null && (
                <button className="in-kpi" onClick={irParaPedidos}><span>Atrasados</span><b className={k!.pedidos_atrasados > 0 ? 'atraso' : ''}>{k!.pedidos_atrasados}</b><small>pedidos</small></button>
              )}
              {k!.estoque_baixo !== null && (
                <div className="in-kpi"><span>Estoque</span><b>{k!.estoque_baixo}</b><small>itens baixos</small></div>
              )}
            </div>
          )}

          {painel?.financeiro && (
            <>
              <div className="p4-rotulo">Financeiro</div>
              <div className="in-fin">
                <div className="in-kpi"><span>A receber</span><b style={{ fontSize: 16 }}>{reais(painel.financeiro.a_receber)}</b></div>
                <div className="in-kpi"><span>A pagar</span><b style={{ fontSize: 16 }}>{reais(painel.financeiro.a_pagar)}</b></div>
              </div>
            </>
          )}

          {painel && painel.proximas_tarefas.length > 0 && (
            <>
              <div className="in-secao-h"><span className="p4-rotulo">Próximas tarefas</span><button className="in-ver" onClick={irParaTarefas}>Ver todas</button></div>
              <div className="p4-lista">
                {painel.proximas_tarefas.map((t) => (
                  <button key={t.id} className={'tf-linha' + (t.atrasado ? ' atrasado' : '')} onClick={irParaTarefas}>
                    <span className="tf-texto"><b>{t.titulo}</b>{t.subtitulo && <small>{t.subtitulo}</small>}</span>
                    <span className={'tf-quando' + (t.atrasado ? ' atrasado' : '')}>{t.prazo ? t.prazo.slice(8, 10) + '/' + t.prazo.slice(5, 7) : ''}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
