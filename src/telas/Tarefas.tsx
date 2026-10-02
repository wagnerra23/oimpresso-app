// Tarefas — desenho v4 (tela 12), dados pelo contrato API-CONTRATO-v1 §3: ToDo do usuário +
// justificativas do Ponto (D11). Urgente = atrasado. A única escrita é concluir um ToDo do
// próprio usuário; justificativas abrem o Ponto (aprovar é no computador). ToDo abre o detalhe (tela 28).
import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi, type FiltroTarefas, type GrupoTarefa, type ListaTarefas, type Tarefa } from '../api';
import { useVoltar } from '../voltar';
import { Ic } from '../icones';
import { TarefaDetalheTela } from './TarefaDetalhe';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

const FILTROS: Array<{ id: FiltroTarefas; label: string }> = [
  { id: 'todas', label: 'Todas' }, { id: 'todo', label: 'ToDo' }, { id: 'ponto', label: 'Ponto' },
];
const GRUPOS: Array<{ id: GrupoTarefa; label: string }> = [
  { id: 'atrasadas', label: 'Atrasadas' }, { id: 'hoje', label: 'Hoje' }, { id: 'amanha', label: 'Amanhã' },
  { id: 'semana', label: 'Esta semana' }, { id: 'depois', label: 'Depois' },
];
const quando = (t: Tarefa) => (t.prazo ? t.prazo.slice(8, 10) + '/' + t.prazo.slice(5, 7) : '');

/** id da tarefa ("todo:<n>") que chega de uma notificação e deve abrir direto no detalhe. */
export const idDoTodo = (id: number | string | null): string | null => {
  const m = /^todo:(\d+)$/.exec(String(id ?? ''));
  return m ? m[1] : null;
};

interface Props {
  avisar: Aviso; abrirPonto: () => void;
  /** Tarefa a abrir assim que a tela monta (vinda do sino); a App limpa depois de entregue. */
  abrir?: string | null; aoAbrir?: () => void;
}

export function Tarefas({ avisar, abrirPonto, abrir, aoAbrir }: Props) {
  const [filtro, setFiltro] = useState<FiltroTarefas>('todas');
  const [dados, setDados] = useState<ListaTarefas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  useVoltar(aberta !== null, () => setAberta(null));
  useEffect(() => { if (abrir) { setAberta(abrir); aoAbrir?.(); } }, [abrir, aoAbrir]);

  const carregar = useCallback(async (f: FiltroTarefas) => {
    setErro(null);
    try { setDados(await api.tarefas(f)); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso a tarefas.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { setDados(null); carregar(filtro); }, [filtro, carregar]);

  const tocar = (t: Tarefa) => (t.origem === 'todo' ? setAberta(t.id.replace(/^todo:/, '')) : abrirPonto());

  if (aberta !== null) {
    return <TarefaDetalheTela id={aberta} avisar={avisar} aoVoltar={() => setAberta(null)}
      aoConcluir={() => { setAberta(null); carregar(filtro); }} />;
  }

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

    </>
  );
}
