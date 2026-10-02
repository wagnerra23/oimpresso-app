// Botão voltar do Android dentro do app. A tela que abre algo empilhado (ex.: detalhe do pedido)
// registra o que o voltar faz; sem nada registrado, o App decide (volta ao Início ou minimiza).
import { useEffect, useRef } from 'react';

const pilha: Array<{ fn: () => void }> = [];

/** Enquanto `ativo`, o voltar chama `fn` (o registro mais recente vence). */
export function useVoltar(ativo: boolean, fn: () => void) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!ativo) return;
    const item = { fn: () => ref.current() };
    pilha.push(item);
    return () => { const i = pilha.indexOf(item); if (i >= 0) pilha.splice(i, 1); };
  }, [ativo]);
}

/** Chamado pelo listener do App. Devolve true se alguma tela tratou o voltar. */
export function tratarVoltar(): boolean {
  const topo = pilha[pilha.length - 1];
  if (!topo) return false;
  topo.fn();
  return true;
}
