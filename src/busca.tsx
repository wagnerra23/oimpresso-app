// Busca nas listas. Ordens de serviço e Orçamentos filtram no aparelho o que já foi carregado, como a Produção
// (as rotas não recebem texto; "Carregar mais" traz mais itens para dentro da busca). Pedidos manda `q` ao ERP.
import type { ReactElement } from 'react';

/** Minúsculas e sem acento: "Clínica" casa com "clinica". */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Só letras e números (já sem acento): "RLV-2E48" vira "rlv2e48" e "OS-01044" vira "os01044". */
const compacto = (s: string) => s.replace(/[^a-z0-9]/g, '');

/** True se cada palavra buscada aparece em algum dos campos: "clinica 1044" acha a OS-01044 da Clínica Vita.
 *  Palavra com número também casa sem hífen nem barra ("rlv2e48" acha RLV-2E48, "1044" acha OS-01044); palavra só de
 *  letras não, para "cav" não achar "Clínica Vita" juntando as palavras. Texto vazio casa com tudo. */
export function casaBusca(texto: string, campos: Array<string | null | undefined>): boolean {
  const palavras = semAcento(texto).split(/\s+/).filter(Boolean);
  if (!palavras.length) return true;
  const normais = campos.filter((c): c is string => !!c).map(semAcento);
  const compactos = normais.map(compacto);
  return palavras.every((p) => {
    if (normais.some((c) => c.includes(p))) return true;
    const pc = compacto(p);
    return /\d/.test(pc) && compactos.some((c) => c.includes(pc));
  });
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
