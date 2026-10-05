// Navegação do app a partir das áreas que o ERP liberou (contrato §6 `perfil`/`abre_em`/`areas`, D6).
// Barra de baixo (§7.1): Início · Tarefas · Pedidos · Produção · Mais, com Pessoas, Orçamentos, Produtos, Estoque, Ponto e Conta dentro
// de Mais. Colaborador (sem ERP) abre direto no Ponto, que vira aba: Ponto · Mais.
// Tela 30 (D16 Onda E, decisão [W] 2026-10-02): quem tem o ERP pode escolher até 3 módulos para a barra; a escolha
// fica guardada NO ERP (#8592) e volta em /api/app/inicio como `barra`, sempre preenchida (escolha ∩ areas, ou o padrão
// do ERP). Início e Mais são fixos; o que não está na barra continua em Mais. Sem `barra` (ERP antigo), padrão do §7.1.
// Arquivo sem dependência do Capacitor, para o teste de unidade rodar em Node.
import type { Area } from './api';
import type { SubMais } from './telas/Mais';

/** Áreas que moram dentro de Mais (nunca na barra), na ordem em que aparecem lá. */
const DENTRO_DE_MAIS = ['pessoas', 'orcamentos', 'produtos', 'estoque', 'financeiro', 'fiscal', 'relatorios', 'dashboard', 'assistente', 'equipe', 'oficina', 'ponto_gestor', 'pagamentos'] as const;
/** Qualquer área pode ser aba quando o usuário escolhe (tela 30). */
export type Aba = Area;
/** Módulos com tela no app que podem ir para a barra (tela 30), na ordem em que aparecem em Mais. */
export const MODULOS_BARRA: Area[] = ['tarefas', 'pedidos', 'producao', ...DENTRO_DE_MAIS, 'ponto'];
export const MAX_BARRA = 3;
export interface Navegacao {
  /** Abas da barra, na ordem. "mais" sempre por último. */
  abas: Aba[];
  /** Entradas de Mais. "conta" sempre. */
  modulosMais: SubMais[];
  /** Onde o app abre e para onde o voltar do Android leva antes de minimizar. */
  casa: Aba;
  /** Ponto na barra (colaborador ou escolha da tela 30) ou dentro de Mais. */
  pontoNaBarra: boolean;
  /** Quem tem o ERP pode personalizar a barra (tela 30); colaborador não. */
  personalizavel: boolean;
  /** Módulos entre Início e Mais (o que a tela 30 edita). */
  modulosBarra: Area[];
}

/** Escolha da tela 30 que vale para estas áreas: sem repetidos, só módulos com tela e liberados, no máximo 3. */
export function escolhaValida(barra: readonly string[] | null | undefined, areas: Area[]): Area[] {
  const vistos = new Set<string>();
  return (barra ?? []).filter((a): a is Area => {
    if (vistos.has(a)) return false;
    vistos.add(a);
    return MODULOS_BARRA.includes(a as Area) && areas.includes(a as Area);
  }).slice(0, MAX_BARRA);
}

const BARRA: Aba[] = ['inicio', 'tarefas', 'pedidos', 'producao'];

export function montarNavegacao(perfil: 'erp' | 'colaborador', areas: Area[], abreEm: 'inicio' | 'ponto' | 'mais',
  barra: readonly string[] | null = null): Navegacao {
  const escolha = perfil === 'erp' ? escolhaValida(barra, areas) : [];
  if (escolha.length > 0) {
    const abas: Aba[] = [...(areas.includes('inicio') ? (['inicio'] as Aba[]) : []), ...escolha, 'mais'];
    const modulosMais = [...MODULOS_BARRA.filter((a) => areas.includes(a) && !escolha.includes(a)) as SubMais[], 'conta' as SubMais];
    const casa: Aba = abas.includes(abreEm) ? abreEm : abas[0];
    return { abas, modulosMais, casa, pontoNaBarra: escolha.includes('ponto'), personalizavel: true, modulosBarra: escolha };
  }
  const pontoNaBarra = perfil === 'colaborador' && areas.includes('ponto');
  const abas: Aba[] = [...BARRA.filter((a) => areas.includes(a)), ...(pontoNaBarra ? (['ponto'] as Aba[]) : []), 'mais'];
  const modulosMais: SubMais[] = [
    ...DENTRO_DE_MAIS.filter((a) => areas.includes(a)),
    ...(areas.includes('ponto') && !pontoNaBarra ? (['ponto'] as SubMais[]) : []),
    'conta',
  ];
  const casa: Aba = abreEm === 'ponto' ? (pontoNaBarra ? 'ponto' : 'mais') : abas.includes(abreEm) ? abreEm : abas[0];
  return { abas, modulosMais, casa, pontoNaBarra, personalizavel: perfil === 'erp', modulosBarra: abas.filter((a) => a !== 'inicio' && a !== 'mais') };
}

/** Sem resposta do ERP (rota ainda não publicada, por exemplo): mostra tudo, como antes da D6. */
export const NAV_PADRAO = montarNavegacao('erp', ['inicio', 'tarefas', 'pedidos', 'producao', 'pessoas', 'orcamentos', 'produtos', 'estoque', 'financeiro', 'fiscal', 'relatorios', 'dashboard', 'assistente', 'equipe', 'oficina', 'pagamentos', 'ponto', 'ponto_gestor', 'mais'], 'inicio');
