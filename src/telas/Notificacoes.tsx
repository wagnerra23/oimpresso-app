// Notificações — desenho v4 (tela 16), D16 Onda A. Abre pelo sino do Início. Só leitura: tocar abre a
// área de origem; marcar como lida (uma ou todas) é escrita e vem num PR próprio. Rota GET
// /api/app/notificacoes, contrato §6.1 (ERP #8557). Sem destino, a linha não navega.
import { useCallback, useEffect, useState } from 'react';
import { api, type DestinoNotificacao, type ListaNotificacoes } from '../api';
import { haQuanto } from '../tempo';

const ORIGENS = ['OS', 'CRM', 'FIN', 'PNT', 'MFG', 'OFI'];

interface Props { aoVoltar: () => void; abrirDestino: (tipo: DestinoNotificacao) => void }

export function Notificacoes({ aoVoltar, abrirDestino }: Props) {
  const [dados, setDados] = useState<ListaNotificacoes | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try { setDados(await api.notificacoes()); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const mais = async () => {
    if (!dados) return;
    setCarregandoMais(true);
    try {
      const prox = await api.notificacoes(dados.pagina + 1);
      setDados({ ...prox, itens: [...dados.itens, ...prox.itens] });
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar.'); }
    finally { setCarregandoMais(false); }
  };

  return (
    <>
      <div className="pd-dhead">
        <button className="pd-voltar" onClick={aoVoltar} aria-label="Voltar para o Início">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="p4-rotulo">{dados ? (dados.nao_lidas ? `${dados.nao_lidas} ${dados.nao_lidas === 1 ? 'não lida' : 'não lidas'}` : 'Tudo lido') : 'Notificações'}</div>
          <div className="pd-dtitulo">Notificações</div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && <div className="p4-vazio"><b>Não foi possível carregar</b><span>{erro}</span></div>}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && dados.itens.length === 0 && <div className="p4-vazio"><b>Nenhuma notificação</b><span>Os avisos do sistema aparecem aqui.</span></div>}
          {dados && dados.itens.length > 0 && (
            <div className="p4-lista">
              {dados.itens.map((n) => {
                const o = n.origem.toUpperCase();
                const conhecida = ORIGENS.includes(o);
                const tipo = n.destino.tipo;
                const conteudo = (
                  <>
                    <span className="nt-origem" style={conhecida ? { background: `var(--origin-${o.toLowerCase()}-bg)`, color: `var(--origin-${o.toLowerCase()}-fg)` }
                      : { background: 'var(--bg-2)', color: 'var(--text-dim)' }}>{o}</span>
                    <span className="nt-texto">
                      <b>{n.titulo}</b>
                      {n.texto && <small>{n.texto}</small>}
                      <span>{haQuanto(n.quando)}</span>
                    </span>
                    <span className="nt-ponto" aria-hidden="true" />
                    {!n.lida && <span className="sr-only">Não lida.</span>}
                  </>
                );
                return tipo
                  ? <button key={n.id} className={'nt-linha' + (n.lida ? '' : ' nova')} onClick={() => abrirDestino(tipo)}>{conteudo}</button>
                  : <div key={n.id} className={'nt-linha' + (n.lida ? '' : ' nova')}>{conteudo}</div>;
              })}
            </div>
          )}
          {dados?.tem_mais && <button className="oi-btn block" style={{ minHeight: 44 }} disabled={carregandoMais} onClick={mais}>{carregandoMais ? 'Carregando…' : 'Carregar mais'}</button>}
          {dados && <p className="p4-legal">Tocar abre a tela de origem. Marcar como lida continua no computador por enquanto.</p>}
        </div>
      </div>
    </>
  );
}
