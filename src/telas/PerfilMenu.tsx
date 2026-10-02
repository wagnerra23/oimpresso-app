// Meu menu — desenho v4 (tela 30 "Editar perfil de menu"), D16 Onda E. Até 3 módulos entre Início e Mais, na ordem
// em que o usuário toca. Decisão [W] 2026-10-02: a escolha fica guardada NO ERP (PUT /api/app/perfil-menu) e volta em
// /api/app/inicio como `barra`, já cruzada com `areas` — o app nunca põe na barra módulo que o usuário não pode usar.
// Rota: contrato §12 (ERP #8592). "Restaurar" manda `[]`, que apaga a escolha e volta ao padrão do ERP (o app não
// conhece o padrão: o ERP completa com as áreas de cada um). Mora em Mais; colaborador (só Ponto) não vê esta tela.
import { useRef, useState, type ReactNode } from 'react';
import { ErroApi, camposDoErro, type Area } from '../api';
import { Ic } from '../icones';
import { MAX_BARRA } from '../navegacao';
import { MODULOS } from './Mais';

type Aviso = (texto: string, tom?: 'ok' | 'warn' | 'erro') => void;

/** Toque num módulo: tira se já está; senão põe no fim, se ainda couber. `cheia` = não coube. */
export function alternar(sel: Area[], id: Area): { sel: Area[]; cheia: boolean } {
  if (sel.includes(id)) return { sel: sel.filter((x) => x !== id), cheia: false };
  if (sel.length >= MAX_BARRA) return { sel, cheia: true };
  return { sel: [...sel, id], cheia: false };
}
export const mesmaOrdem = (a: Area[], b: Area[]) => a.length === b.length && a.every((x, i) => x === b[i]);

interface Props {
  /** Módulos que o usuário pode usar (com tela no app), na ordem de Mais. */
  disponiveis: Area[];
  /** Barra que vale agora (escolha salva ou padrão). */
  atual: Area[];
  /** Grava a escolha; `[]` = voltar ao padrão do ERP. */
  aoSalvar: (modulos: Area[]) => Promise<void>;
  avisar: Aviso; online: boolean; voltar?: ReactNode;
}

export function PerfilMenu({ disponiveis, atual, aoSalvar, avisar, online, voltar }: Props) {
  const [sel, setSelEstado] = useState<Area[]>(atual);
  // Toques seguidos antes do próximo render precisam partir da seleção mais recente, não da do último render.
  const selRef = useRef<Area[]>(atual);
  const setSel = (v: Area[]) => { selRef.current = v; setSelEstado(v); };
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const info = (id: Area) => MODULOS.find((m) => m.id === id);
  const mudou = !mesmaOrdem(sel, atual);

  const tocar = (id: Area) => {
    const r = alternar(selRef.current, id);
    if (r.cheia) { avisar(`Máximo de ${MAX_BARRA} módulos: Início e Mais são fixos.`, 'warn'); return; }
    setSel(r.sel); setErro(null);
  };
  const gravar = async (modulos: Area[], ok: string) => {
    setSalvando(true); setErro(null);
    try { await aoSalvar(modulos); avisar(ok); }
    catch (e) {
      const campo = camposDoErro(e).modulos as unknown;
      const doCampo = Array.isArray(campo) ? String(campo[0] ?? '') : campo ? String(campo) : '';
      setErro(doCampo || (e instanceof ErroApi && e.codigo === 'sem_permissao' ? 'Seu usuário não pode mudar o menu.' : e instanceof Error ? e.message : 'Não foi possível salvar.'));
    } finally { setSalvando(false); }
  };
  const salvar = () => {
    if (sel.length === 0) { setErro('Escolha pelo menos 1 módulo, ou toque em Restaurar para voltar ao padrão.'); return; }
    gravar(sel, 'Menu salvo. A barra já mudou.');
  };

  const previa: Array<{ id: string; label: string; Icone: (p: { tamanho?: number }) => ReactNode }> = [
    { id: 'inicio', label: 'Início', Icone: Ic.inicio },
    ...sel.map((id) => ({ id, label: info(id)?.label ?? id, Icone: info(id)?.Icone ?? Ic.mais })),
    { id: 'mais', label: 'Mais', Icone: Ic.mais },
  ];

  return (
    <>
      <div className="pd-head">
        <div className="p4-head-row" style={{ gap: 4 }}>
          {voltar}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="p4-rotulo">{sel.length}/{MAX_BARRA} módulos na barra</div>
            <div className="pd-titulo">Meu menu</div>
          </div>
          <button className="pm-restaurar" disabled={salvando || !online} onClick={() => gravar([], 'Menu padrão da empresa restaurado.')}>Restaurar</button>
        </div>
      </div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="p4-rotulo">Prévia da barra</div>
          <div className="pm-previa" style={{ gridTemplateColumns: `repeat(${previa.length}, minmax(0, 1fr))` }} aria-label="Prévia da barra de navegação">
            {previa.map(({ id, label, Icone }, i) => (
              <span key={id} className={'pm-aba' + (i === 0 ? ' on' : '')}><Icone tamanho={20} /><small>{label}</small></span>
            ))}
          </div>
          <p className="p4-legal">Início e Mais são fixos. Toque nos módulos na ordem em que quer vê-los; o número mostra a posição. O que ficar fora da barra continua em Mais. Restaurar volta ao menu padrão da empresa.</p>
          <div className="p4-rotulo">Módulos</div>
          <div className="pm-lista" role="group" aria-label="Módulos da barra">
            {disponiveis.map((id) => {
              const m = info(id);
              if (!m) return null;
              const pos = sel.indexOf(id);
              return (
                <button key={id} className={'pm-mod' + (pos >= 0 ? ' on' : '')} aria-pressed={pos >= 0} onClick={() => tocar(id)}>
                  <span className="ms-ico"><m.Icone tamanho={18} /></span>
                  <span className="pm-texto"><b>{m.label}</b><small>{m.desc}</small></span>
                  <span className="pm-pos" aria-label={pos >= 0 ? `posição ${pos + 1}` : undefined}>{pos >= 0 ? pos + 1 : ''}</span>
                </button>
              );
            })}
          </div>
          {erro && <p className="app-erro" role="alert">{erro}</p>}
        </div>
      </div>
      <div className="pm-rodape">
        {!online && <p className="p4-legal" role="status">Sem conexão. Salvar o menu precisa de internet.</p>}
        <button className="oi-btn primary block" style={{ minHeight: 48 }} disabled={!mudou || salvando || !online} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar e aplicar'}
        </button>
      </div>
    </>
  );
}
