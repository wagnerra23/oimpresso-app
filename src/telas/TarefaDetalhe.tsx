// Detalhe da tarefa — desenho v4 (tela 28), D16 Onda A. Só ToDo (justificativa do ponto abre o Ponto).
// Mostra responsável, cliente, prazo, origem, checklist e comentários. A única ação é "Concluir tarefa",
// a mesma rota que a lista já usava (§3); marcar item do checklist fica para um PR de escrita próprio.
// Como no protótipo, não conclui com checklist pendente. Rota GET /api/app/tarefas/todo/{id}, contrato
// §3.1 (ERP #8556). Linha ou bloco que vem vazio (cliente, origem, checklist) não aparece. A descrição não
// está no protótipo; entra porque, sem checklist, é o conteúdo principal do ToDo.
import { useEffect, useState } from 'react';
import { api, type TarefaDetalhe } from '../api';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

const prazoTexto = (iso: string | null) => {
  if (!iso) return '—';
  const data = iso.slice(8, 10) + '/' + iso.slice(5, 7);
  return iso.length > 10 ? `${data} ${iso.slice(11, 16)}` : data;
};
const hora = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
};

interface Props { id: string; avisar: Aviso; aoVoltar: () => void; aoConcluir: () => void }

export function TarefaDetalheTela({ id, avisar, aoVoltar, aoConcluir }: Props) {
  const [t, setT] = useState<TarefaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  useEffect(() => { api.tarefa(id).then(setT).catch((e) => setErro(e instanceof Error ? e.message : 'Não foi possível carregar.')); }, [id]);

  const feitos = t?.checklist.filter((c) => c.feito).length ?? 0;
  const concluir = async () => {
    if (!t || t.concluida) return;
    if (t.checklist.some((c) => !c.feito)) { avisar('Complete o checklist antes de concluir.', 'warn'); return; }
    setConcluindo(true);
    try {
      await api.concluirTodo(id);
      avisar('Tarefa concluída.', 'ok');
      aoConcluir();
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível concluir.', 'erro');
    } finally {
      setConcluindo(false);
    }
  };

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para tarefas">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{t?.modulo ?? 'Tarefa'}</div>
          <div className="pd-dtitulo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.titulo ?? '…'}</div>
        </div>
      </div>
      <div className="oi-scroll">
        {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
        {!t && !erro && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {t && (
          <div className="pd-corpo">
            <div className="p4-lista">
              <div className="ps-dado"><span>Responsável</span><b>{t.responsavel ?? '—'}</b></div>
              {t.cliente && <div className="ps-dado"><span>Cliente</span><b>{t.cliente}</b></div>}
              <div className="ps-dado"><span>Prazo</span>
                <b style={{ fontFamily: 'var(--font-mono)', color: t.atrasado ? 'var(--danger)' : undefined }}>{prazoTexto(t.prazo)}{t.atrasado ? ' · atrasada' : ''}</b></div>
              {t.origem && <div className="ps-dado"><span>Origem</span><b style={{ fontFamily: 'var(--font-mono)' }}>{t.origem}</b></div>}
            </div>

            {t.descricao && <p className="td-descricao">{t.descricao}</p>}

            {t.checklist.length > 0 && (
              <>
                <div className="p4-rotulo">Checklist · {feitos}/{t.checklist.length}</div>
                <ul className="p4-lista" aria-label="Checklist" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {t.checklist.map((c, i) => (
                    <li key={i} className={'td-check' + (c.feito ? ' feito' : '')}>
                      <span className="td-marca" aria-hidden="true">{c.feito ? '✓' : ''}</span>
                      <span><span className="sr-only">{c.feito ? 'Feito: ' : 'Pendente: '}</span>{c.texto}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="p4-rotulo">Comentários</div>
            {t.comentarios.length === 0 && <p className="p4-legal">Sem comentários.</p>}
            {t.comentarios.length > 0 && (
              <ol style={{ listStyle: 'none', margin: 0, padding: '2px 2px 0' }} aria-label="Comentários">
                {[...t.comentarios].reverse().map((c, i) => (
                  <li key={i} className="td-linha">
                    <small>{hora(c.quando)}</small>
                    <p><b>{c.autor}</b> {c.texto}</p>
                    {c.detalhe && <em>{c.detalhe}</em>}
                  </li>
                ))}
              </ol>
            )}
            <p className="p4-legal">Marcar itens do checklist e comentar continuam no computador.</p>
          </div>
        )}
      </div>
      {t && (
        <div className="pd-rodape">
          <button className="p4-cta" disabled={concluindo || t.concluida} onClick={concluir}>
            {t.concluida ? 'Concluída ✓' : concluindo ? 'Concluindo…' : 'Concluir tarefa'}
          </button>
        </div>
      )}
    </>
  );
}
