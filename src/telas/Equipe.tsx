// Equipe — desenho v4 (tela 26), D16 Onda E. Só leitura: nome, função, carga (itens de OS/OP abertos
// atribuídos) e status. Marcação de ponto não aparece aqui (fica no Ponto). Mora dentro de Mais.
// Rota GET /api/app/equipe: contrato §12 (ERP #8588) — ver ListaEquipe em api.ts. O rótulo do status vem pronto do ERP.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api, ErroApi, type ListaEquipe, type TomStatusEquipe } from '../api';

// Mesmas cores do protótipo: ocupado = alerta, livre = positivo; ausente fica apagado.
const COR: Record<TomStatusEquipe, string> = { ocupado: 'var(--warn)', livre: 'var(--ok)', ausente: 'var(--text-mute)' };
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function Equipe({ voltar }: { voltar?: ReactNode }) {
  const [dados, setDados] = useState<ListaEquipe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setDados(null); setErro(null);
    try { setDados(await api.equipe()); }
    catch (e) { setErro(e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não tem acesso à equipe.' : e instanceof Error ? e.message : 'Não foi possível carregar.'); }
  }, []);
  useEffect(() => { carregar(); }, [carregar]);

  const n = dados?.itens.length ?? 0;
  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{dados ? `${n} ${n === 1 ? 'pessoa' : 'pessoas'}` : 'Equipe'}</div>
            <div className="pd-titulo">Equipe</div>
          </div>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          {erro && (
            <div className="p4-vazio">
              <b>Não foi possível carregar</b><span>{erro}</span>
              <button className="oi-btn" style={{ minHeight: 44 }} onClick={carregar}>Tentar de novo</button>
            </div>
          )}
          {!dados && !erro && <p className="p4-legal">Carregando…</p>}
          {dados && n === 0 && <div className="p4-vazio"><b>Ninguém na equipe</b><span>Os usuários da empresa aparecem aqui.</span></div>}
          {dados && n > 0 && (
            <ul className="eq-lista" aria-label="Equipe">
              {dados.itens.map((p) => (
                <li key={p.id} className="eq-linha">
                  <span className="pd-avatar" aria-hidden="true">{iniciais(p.nome)}</span>
                  <div className="eq-quem">
                    <b>{p.nome}</b>
                    {p.funcao && <small>{p.funcao}</small>}
                  </div>
                  <div className="eq-carga">
                    <span className="eq-num">{p.carga ?? '—'}</span>
                    <span className="eq-status" style={{ color: COR[p.status.tom] }}>{p.status.rotulo}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {dados && <p className="p4-legal">Carga = itens de OS abertos atribuídos. Marcação de ponto fica no módulo Ponto.</p>}
        </div>
      </div>
    </>
  );
}
