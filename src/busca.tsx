// Busca nas listas (Pedidos, Ordens de serviço, Orçamentos): filtra no aparelho o que já foi carregado,
// como a Produção. As rotas não recebem texto; "Carregar mais" traz mais itens para dentro da busca.
import type { ReactElement } from 'react';

/** Minúsculas e sem acento: "Clínica" casa com "clinica". */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Só letras e números: "RLV-2E48" casa com "rlv2e48" e "OS-01044" com "1044". */
const compacto = (s: string) => semAcento(s).replace(/[^a-z0-9]/g, '');

/** True se o texto buscado aparece em algum dos campos. Texto vazio casa com tudo. */
export function casaBusca(texto: string, campos: Array<string | null | undefined>): boolean {
  const termo = semAcento(texto.trim());
  if (!termo) return true;
  const termoCompacto = compacto(termo);
  return campos.some((c) => !!c && (semAcento(c).includes(termo) || (!!termoCompacto && compacto(c).includes(termoCompacto))));
}

/** Campo de busca no padrão das listas v4 (mesmo visual de Pessoas, Produtos e Produção). */
export function CampoBusca({ valor, aoMudar, placeholder, rotulo }: { valor: string; aoMudar: (v: string) => void; placeholder: string; rotulo: string }): ReactElement {
  return (
    <label className="ps-busca">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" value={valor} onChange={(e) => aoMudar(e.target.value)} placeholder={placeholder} aria-label={rotulo} enterKeyHint="search" />
    </label>
  );
}
