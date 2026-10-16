// Aba Recorrências do Financeiro (contratos e contas fixas). Mostra quando o ERP cria o próximo lançamento e quando
// ele vence; "Interromper" para de gerar daqui pra frente (os lançamentos já criados continuam e se baixam normal).
// Rotas GET /api/app/financeiro/recorrencias e POST .../{id}/interromper (formato proposto ao ERP).
import { useEffect, useState } from 'react';
import { api, ErroApi, NOVA_RECORRENCIA, type Recorrencia } from '../api';
import { FREQUENCIAS } from '../lancamento-regras';
import { reais } from './Pedidos';

type Filtro = 'ativa' | 'interrompida' | 'todas';
const FILTROS: Array<{ id: Filtro; label: string }> = [{ id: 'ativa', label: 'Ativas' }, { id: 'interrompida', label: 'Interrompidas' }, { id: 'todas', label: 'Todas' }];
const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '—');

export function Recorrencias({ avisar }: { avisar?: (texto: string, tom?: 'ok' | 'warn' | 'erro') => void }) {
  const [itens, setItens] = useState<Recorrencia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('ativa');
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [parando, setParando] = useState<number | null>(null);

  useEffect(() => {
    api.recorrencias().then((r) => setItens(r.itens)).catch((e) =>
      setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso ao Financeiro.' : e instanceof Error ? e.message : 'Não foi possível carregar.'));
  }, []);

  const interromper = async (r: Recorrencia) => {
    setParando(r.id);
    try {
      const nova = await api.interromperRecorrencia(r.id);
      setItens((x) => x?.map((i) => (i.id === r.id ? nova : i)) ?? null);
      setConfirmando(null);
      avisar?.('Recorrência interrompida. Os lançamentos já criados continuam.', 'ok');
    } catch (e) { avisar?.(e instanceof Error ? e.message : 'Não foi possível interromper.', 'erro'); }
    finally { setParando(null); }
  };

  const conta = (f: Filtro) => itens?.filter((r) => f === 'todas' || r.status === f).length ?? 0;
  const lista = itens?.filter((r) => filtro === 'todas' || r.status === filtro) ?? [];
  return (
    <>
      {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
      {!itens && !erro && <p className="p4-legal">Carregando…</p>}
      {itens && (
        <div className="pd-chips" role="tablist" aria-label="Situação da recorrência">
          {FILTROS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
              {f.label}<span>{conta(f.id)}</span>
            </button>
          ))}
        </div>
      )}
      {itens && lista.length === 0 && (
        <div className="p4-vazio"><b>Nenhuma recorrência aqui</b><span>{NOVA_RECORRENCIA ? 'Crie em + Novo, escolhendo "Recorrente" em Repetição.' : 'Contratos e contas fixas cadastrados no computador aparecem aqui.'}</span></div>
      )}
      {lista.map((r) => {
        const freq = FREQUENCIAS.find((f) => f.id === r.frequencia)?.label ?? r.frequencia;
        const ativa = r.status === 'ativa';
        return (
          <article key={r.id} className={'rc-card' + (ativa ? '' : ' parada')} aria-label={r.descricao}>
            <div className="rc-l1">
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{r.descricao}</b>
                <small>{[r.parte, r.plano_nome].filter(Boolean).join(' · ') || (r.tipo === 'receber' ? 'A receber' : 'A pagar')}</small>
              </div>
              <span className={'rc-valor ' + (r.tipo === 'receber' ? 'pos' : 'neg')}>{r.tipo === 'receber' ? '+ ' : '− '}{reais(r.valor)}</span>
            </div>
            <dl className="rc-dados">
              <div><dt>Frequência</dt><dd>{freq} · vence dia {r.dia_vencimento}</dd></div>
              <div><dt>Renova no dia</dt><dd>{r.dia_geracao}</dd></div>
              {ativa ? (
                <>
                  <div><dt>Próxima criação</dt><dd>{r.proxima_geracao ? br(r.proxima_geracao) : 'contrato no fim'}</dd></div>
                  <div><dt>Próximo vencimento</dt><dd>{br(r.proximo_vencimento)}</dd></div>
                </>
              ) : (
                <div><dt>Interrompida em</dt><dd>{br(r.interrompida_em)}</dd></div>
              )}
              <div><dt>Contrato{r.contrato ? ` ${r.contrato}` : ''}</dt><dd>{br(r.inicio)} a {r.termino ? br(r.termino) : 'sem término'}</dd></div>
              <div><dt>Já criados</dt><dd>{r.gerados} {r.gerados === 1 ? 'lançamento' : 'lançamentos'}</dd></div>
            </dl>
            {ativa && confirmando !== r.id && (
              <button className="oi-btn rc-parar" onClick={() => setConfirmando(r.id)}>Interromper</button>
            )}
            {ativa && confirmando === r.id && (
              <div className="rc-confirma" role="group" aria-label="Confirmar interrupção">
                <p>Parar de criar lançamentos desta recorrência? Os {r.gerados} já criados continuam em aberto ou pagos como estão.</p>
                <div>
                  <button className="oi-btn" disabled={parando === r.id} onClick={() => setConfirmando(null)}>Manter</button>
                  <button className="oi-btn rc-parar-sim" disabled={parando === r.id} onClick={() => interromper(r)}>{parando === r.id ? 'Interrompendo…' : 'Interromper'}</button>
                </div>
              </div>
            )}
          </article>
        );
      })}
      {itens && <p className="p4-legal">O ERP cria cada lançamento no dia de renovação, antes do vencimento. Interromper não apaga o que já foi criado.</p>}
    </>
  );
}
