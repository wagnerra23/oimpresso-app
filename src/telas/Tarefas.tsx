// Tarefas — desenho v4 (tela 12), dados pelo contrato API-CONTRATO-v1 §3: ToDo do usuário +
// justificativas do Ponto (D11). Urgente = atrasado. A única escrita é concluir um ToDo do
// próprio usuário; justificativas abrem o Ponto (aprovar é no computador).
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type FiltroTarefas, type GrupoTarefa, type ListaTarefas, type Tarefa } from '../api';
import { useVoltar } from '../voltar';
import { Ic } from '../icones';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

const FILTROS: Array<{ id: FiltroTarefas; label: string }> = [
  { id: 'todas', label: 'Todas' }, { id: 'todo', label: 'ToDo' }, { id: 'ponto', label: 'Ponto' },
];
const GRUPOS: Array<{ id: GrupoTarefa; label: string }> = [
  { id: 'atrasadas', label: 'Atrasadas' }, { id: 'hoje', label: 'Hoje' }, { id: 'amanha', label: 'Amanhã' },
  { id: 'semana', label: 'Esta semana' }, { id: 'depois', label: 'Depois' },
];
const quando = (t: Tarefa) => (t.prazo ? t.prazo.slice(8, 10) + '/' + t.prazo.slice(5, 7) : '');

export function Tarefas({ avisar, abrirPonto }: { avisar: Aviso; abrirPonto: () => void }) {
  const [filtro, setFiltro] = useState<FiltroTarefas>('todas');
  const [dados, setDados] = useState<ListaTarefas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<Tarefa | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  useVoltar(confirmar !== null, () => setConfirmar(null));

  const carregar = useCallback(async (f: FiltroTarefas) => {
    setErro(null);
    try { setDados(await api.tarefas(f)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso a tarefas.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { setDados(null); carregar(filtro); }, [filtro, carregar]);

  const tocar = (t: Tarefa) => (t.origem === 'todo' ? setConfirmar(t) : abrirPonto());

  const concluir = async () => {
    if (!confirmar) return;
    setConcluindo(true);
    try {
      await api.concluirTodo(confirmar.id.replace(/^todo:/, ''));
      avisar('Tarefa concluída.', 'ok');
      setConfirmar(null);
      await carregar(filtro);
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível concluir.', 'erro');
    } finally {
      setConcluindo(false);
    }
  };

  const c = dados?.contadores;
  const atrasadas = dados?.itens.filter((t) => t.atrasado).length ?? 0;
  return (
    <>
      <div className="pd-head">
        <div className="p4-rotulo">{c ? `${c.todas} ${c.todas === 1 ? 'pendente' : 'pendentes'}${atrasadas ? ` · ${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : ''}` : 'Tarefas'}</div>
        <div className="pd-titulo">Tarefas</div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="pd-chips" role="tablist" aria-label="Origem das tarefas">
            {FILTROS.map((f) => (
              <button key={f.id} role="tab" aria-selected={filtro === f.id} className={'pd-chip' + (filtro === f.id ? ' on' : '')} onClick={() => setFiltro(f.id)}>
                {f.label}{c && <span>{c[f.id]}</span>}
              </button>
            ))}
          </div>
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && (
            <div className="p4-vazio"><span className="tf-feito"><Ic.check tamanho={28} /></span><b>Tudo em dia</b><span>Nenhuma pendência no momento.</span></div>
          )}
          {dados && GRUPOS.map((g) => {
            const itens = dados.itens.filter((t) => t.grupo === g.id);
            if (!itens.length) return null;
            return (
              <section key={g.id} className="tf-grupo" aria-label={g.label}>
                <div className={'p4-rotulo' + (g.id === 'atrasadas' ? ' tf-rotulo-atraso' : '')}>{g.label}</div>
                <div className="p4-lista">
                  {itens.map((t) => (
                    <button key={t.id} className={'tf-linha' + (t.atrasado ? ' atrasado' : '')} onClick={() => tocar(t)}>
                      <span className={'tf-ico ' + t.origem}>{t.origem === 'todo' ? <Ic.check tamanho={20} /> : <Ic.relogio tamanho={20} />}</span>
                      <span className="tf-texto"><b>{t.titulo}</b>{t.subtitulo && <small>{t.subtitulo}</small>}</span>
                      <span className="tf-meta">
                        <span className="tf-origem">{t.origem === 'todo' ? 'TODO' : 'PNT'}</span>
                        <span className={'tf-quando' + (t.atrasado ? ' atrasado' : '')}>{quando(t)}</span>
                      </span>
                      <span className="tf-chev" aria-hidden="true">›</span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
          <p className="p4-legal">ToDo concluído aqui some da lista. Justificativas do ponto se aprovam no computador.</p>
        </div>
      </div>

      {confirmar && (
        <div className="tf-folha-fundo" onClick={() => !concluindo && setConfirmar(null)}>
          <div className="tf-folha" role="dialog" aria-modal="true" aria-labelledby="tf-folha-t" onClick={(e) => e.stopPropagation()}>
            <span className="tf-alca" aria-hidden="true" />
            <div className="p4-rotulo">{confirmar.subtitulo ?? 'ToDo'}</div>
            <div id="tf-folha-t" className="tf-folha-titulo">{confirmar.titulo}</div>
            {confirmar.prazo && <div className={'tf-quando' + (confirmar.atrasado ? ' atrasado' : '')}>Prazo {confirmar.prazo.split('-').reverse().join('/')}{confirmar.atrasado ? ' · atrasada' : ''}</div>}
            <button className="p4-cta" disabled={concluindo} onClick={concluir}>{concluindo ? 'Concluindo…' : 'Concluir tarefa'}</button>
            <button className="oi-btn block" style={{ minHeight: 44 }} disabled={concluindo} onClick={() => setConfirmar(null)}>Cancelar</button>
          </div>
        </div>
      )}
    </>
  );
}
