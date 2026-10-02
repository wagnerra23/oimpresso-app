// Navegação do app a partir das áreas que o ERP liberou (contrato §6 `perfil`/`abre_em`/`areas`, D6).
// Barra de baixo (§7.1): Início · Tarefas · Pedidos · Produção · Mais, com Pessoas, Orçamentos, Produtos, Estoque, Ponto e Conta dentro
// de Mais. Colaborador (sem ERP) abre direto no Ponto, que vira aba: Ponto · Mais.
// Arquivo sem dependência do Capacitor, para o teste de unidade rodar em Node.
import type { Area } from './api';
import type { SubMais } from './telas/Mais';

/** Áreas que moram dentro de Mais (nunca na barra), na ordem em que aparecem lá. */
const DENTRO_DE_MAIS = ['pessoas', 'orcamentos', 'produtos', 'estoque', 'financeiro', 'fiscal', 'equipe'] as const;
export type Aba = Exclude<Area, (typeof DENTRO_DE_MAIS)[number]>;
export interface Navegacao {
  /** Abas da barra, na ordem. "mais" sempre por último. */
  abas: Aba[];
  /** Entradas de Mais. "conta" sempre. */
  modulosMais: SubMais[];
  /** Onde o app abre e para onde o voltar do Android leva antes de minimizar. */
  casa: Aba;
  /** Ponto na barra (colaborador) ou dentro de Mais (ERP). */
  pontoNaBarra: boolean;
}

const BARRA: Aba[] = ['inicio', 'tarefas', 'pedidos', 'producao'];

export function montarNavegacao(perfil: 'erp' | 'colaborador', areas: Area[], abreEm: 'inicio' | 'ponto' | 'mais'): Navegacao {
  const pontoNaBarra = perfil === 'colaborador' && areas.includes('ponto');
  const abas: Aba[] = [...BARRA.filter((a) => areas.includes(a)), ...(pontoNaBarra ? (['ponto'] as Aba[]) : []), 'mais'];
  const modulosMais: SubMais[] = [
    ...DENTRO_DE_MAIS.filter((a) => areas.includes(a)),
    ...(areas.includes('ponto') && !pontoNaBarra ? (['ponto'] as SubMais[]) : []),
    'conta',
  ];
  const casa: Aba = abreEm === 'ponto' ? (pontoNaBarra ? 'ponto' : 'mais') : abas.includes(abreEm) ? abreEm : abas[0];
  return { abas, modulosMais, casa, pontoNaBarra };
}

/** Sem resposta do ERP (rota ainda não publicada, por exemplo): mostra tudo, como antes da D6. */
export const NAV_PADRAO = montarNavegacao('erp', ['inicio', 'tarefas', 'pedidos', 'producao', 'pessoas', 'orcamentos', 'produtos', 'estoque', 'financeiro', 'fiscal', 'equipe', 'ponto', 'mais'], 'inicio');
