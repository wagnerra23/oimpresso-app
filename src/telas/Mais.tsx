// Mais — hub (v4 tela 10, recortado para a v1): módulos com tela no app + "Abrir no computador".
// Contrato §7/§7.1: Pessoas, Ponto e Conta moram aqui. Fora da v1 de propósito: Venda rápida
// (v2), perfis de menu e troca de empresa (sem seletor de empresa — D2 do mapa).
import type { ReactElement } from 'react';
import { Browser } from '@capacitor/browser';
import { Ic } from '../icones';
import logo from '../assets/oimpresso-logo.png';

export type SubMais = 'pessoas' | 'orcamentos' | 'produtos' | 'estoque' | 'financeiro' | 'fiscal' | 'relatorios' | 'dashboard' | 'equipe' | 'ponto_gestor' | 'ponto' | 'conta';

const MODULOS: Array<{ id: SubMais; label: string; desc: string; Icone: (p: { tamanho?: number }) => ReactElement }> = [
  { id: 'pessoas', label: 'Pessoas', desc: 'Clientes, fornecedores e equipe', Icone: Ic.pessoas },
  { id: 'orcamentos', label: 'Orçamentos', desc: 'Propostas enviadas e aprovadas', Icone: Ic.pedido },
  { id: 'produtos', label: 'Produtos', desc: 'Catálogo, preço e estoque', Icone: Ic.pacote },
  { id: 'estoque', label: 'Estoque', desc: 'Saldo por loja e itens abaixo do mínimo', Icone: Ic.estoque },
  { id: 'financeiro', label: 'Financeiro', desc: 'Saldo, contas a receber e a pagar', Icone: Ic.dinheiro },
  { id: 'fiscal', label: 'Fiscal', desc: 'Notas emitidas e rejeitadas', Icone: Ic.pedido },
  { id: 'relatorios', label: 'Relatórios', desc: 'DRE, vendas, produção e estoque', Icone: Ic.grafico },
  { id: 'dashboard', label: 'Dashboard', desc: 'Faturamento e indicadores de 30 dias', Icone: Ic.grafico },
  { id: 'ponto_gestor', label: 'Validar ponto', desc: 'Marcações fora da área para revisar', Icone: Ic.check },
  { id: 'equipe', label: 'Equipe', desc: 'Quem está na equipe e a carga de cada um', Icone: Ic.usuario },
  { id: 'ponto', label: 'Ponto', desc: 'Bater ponto, espelho e justificativas', Icone: Ic.relogio },
  { id: 'conta', label: 'Conta', desc: 'Lembrete, privacidade e sair', Icone: Ic.usuario },
];

/** `modulos`: quais entradas mostrar (Pessoas e Ponto só quando a área é permitida; Conta sempre). */
export function Mais({ abrir, modulos }: { abrir: (s: SubMais) => void; modulos: SubMais[] }) {
  return (
    <>
      <div className="pd-head"><div className="pd-titulo">Mais</div></div>
      <div className="oi-scroll">
        <div className="pd-corpo">
          <div className="p4-rotulo">Módulos</div>
          <div className="ms-grade">
            {MODULOS.filter((m) => modulos.includes(m.id)).map(({ id, label, desc, Icone }) => (
              <button key={id} className="ms-mod" onClick={() => abrir(id)}>
                <span className="ms-ico"><Icone tamanho={20} /></span>
                <b>{label}</b>
                <small>{desc}</small>
              </button>
            ))}
          </div>
          <div className="p4-rotulo">No computador</div>
          <div className="p4-lista">
            <button className="ms-linha" onClick={() => Browser.open({ url: 'https://oimpresso.com/home' })}>
              <span style={{ flex: 1 }}><b>Abrir o oimpresso completo</b><small>Produtos, vendas, finanças e o resto do sistema</small></span>
              <span aria-hidden="true">›</span>
            </button>
          </div>
          <div className="ms-marca"><img src={logo} alt="" /><span>oimpresso</span></div>
        </div>
      </div>
    </>
  );
}

/** Cabeçalho com voltar para telas abertas a partir do Mais (Ponto, Conta). */
export function VoltarMais({ aoVoltar }: { aoVoltar: () => void }) {
  return (
    <button className="pd-voltar ms-voltar" onClick={aoVoltar} aria-label="Voltar para Mais">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
    </button>
  );
}
