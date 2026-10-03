// Shell do app. Barra de baixo do contrato §7.1: Início · Tarefas · Pedidos · Produção · Mais, com
// Pessoas, Ponto e Conta dentro de Mais. Quais abas aparecem vem do ERP (§6 `areas`, D6): aba visível =
// rota que responde. Colaborador (sem ERP) abre direto no Ponto, que vira aba: Ponto · Mais.
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as AppNativo } from '@capacitor/app';
import { api, carregarToken, DEMO, quandoExpirar, type Area } from './api';
import { renovarLembrete } from './push';
import { useTemaDoCelular } from './tema';
import { Ic } from './icones';
import { tratarVoltar } from './voltar';
import { Pedidos } from './telas/Pedidos';
import { Producao } from './telas/Producao';
import { idDoTodo, Tarefas } from './telas/Tarefas';
import { Mais, MODULOS, VoltarMais, type SubMais } from './telas/Mais';
import { PerfilMenu } from './telas/PerfilMenu';
import { montarNavegacao, MODULOS_BARRA, NAV_PADRAO, type Aba, type Navegacao } from './navegacao';
import { Pessoas } from './telas/Pessoas';
import { Orcamentos } from './telas/Orcamentos';
import { Relatorios } from './telas/Relatorios';
import { Dashboard } from './telas/Dashboard';
import { FilaGestor } from './telas/FilaGestor';
import { Equipe } from './telas/Equipe';
import { Assistente } from './telas/Assistente';
import { Pagamentos } from './telas/Pagamentos';
import { Produtos } from './telas/Produtos';
import { Estoque } from './telas/Estoque';
import { Financeiro } from './telas/Financeiro';
import { Fiscal } from './telas/Fiscal';
import { useVoltar } from './voltar';
import { Login } from './telas/Login';
import { Inicio } from './telas/Inicio';
import { Ponto } from './telas/Ponto';
import { Conta } from './telas/Conta';

type Toast = { texto: string; tom: 'ok' | 'warn' | 'erro' } | null;

/** Ícone e rótulo de cada aba. Qualquer módulo de MODULOS pode virar aba pela tela 30. */
const ABAS: Array<{ id: Aba; label: string; Icone: (p: { tamanho?: number }) => ReactElement }> = [
  { id: 'inicio', label: 'Início', Icone: Ic.inicio },
  ...MODULOS.filter((m) => MODULOS_BARRA.includes(m.id as Aba)).map((m) => ({ id: m.id as Aba, label: m.label, Icone: m.Icone })),
  { id: 'mais', label: 'Mais', Icone: Ic.mais },
];

export function App() {
  const tema = useTemaDoCelular();
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [aba, setAba] = useState<Aba>('inicio');
  const [subMais, setSubMais] = useState<SubMais | null>(null);
  // Card "Estoque" do Início abre a tela 05 já em "Baixo estoque"; pelo Mais abre em "Todos".
  const [estoqueFiltro, setEstoqueFiltro] = useState<'todos' | 'baixo'>('todos');
  const [nav, setNav] = useState<Navegacao | null>(null);
  const navRef = useRef<Navegacao>(NAV_PADRAO);
  navRef.current = nav ?? NAV_PADRAO;
  // Só vai para área liberada; o Ponto mora na barra (colaborador) ou dentro de Mais (ERP).
  const irPara = useCallback((a: Aba, sub: SubMais | null = null) => {
    const n = navRef.current;
    if (!n.abas.includes(a)) return;
    if (sub && !n.modulosMais.includes(sub) && sub !== 'menu') return;
    setAba(a); setSubMais(sub);
  }, []);
  /** Abre um módulo onde ele estiver: na barra (aba) ou dentro de Mais (a tela 30 decide). */
  const abrir = useCallback((m: Aba) => {
    const n = navRef.current;
    if (n.abas.includes(m)) irPara(m);
    else if (n.modulosMais.includes(m as SubMais)) irPara('mais', m as SubMais);
  }, [irPara]);
  const abrirPonto = useCallback(() => abrir('ponto'), [abrir]);
  // Áreas liberadas pelo ERP (D6): a tela 30 só oferece o que o usuário pode usar.
  const [areas, setAreas] = useState<Area[]>([]);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  // Tarefa a abrir no detalhe quando a aba Tarefas montar (vinda do sino).
  const [tarefaPendente, setTarefaPendente] = useState<string | null>(null);
  const limparTarefaPendente = useCallback(() => setTarefaPendente(null), []);
  const timer = useRef<number | undefined>(undefined);
  const abaAtual = useRef<Aba>('inicio');
  abaAtual.current = aba;

  // Voltar do Android: a tela empilhada trata (ex.: detalhe → lista); senão volta ao Início;
  // no Início, o app vai para segundo plano.
  useEffect(() => {
    const h = AppNativo.addListener('backButton', () => {
      if (tratarVoltar()) return;
      const casa = navRef.current.casa;
      if (abaAtual.current !== casa) { setAba(casa); setSubMais(null); return; }
      AppNativo.minimizeApp().catch(() => {});
    });
    return () => { h.then((x) => x.remove()); };
  }, []);

  const avisar = useCallback((texto: string, tom: 'ok' | 'warn' | 'erro' = 'ok') => {
    setToast({ texto, tom });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    quandoExpirar(() => { setLogado(false); setNav(null); setAba('inicio'); setSubMais(null); });
    carregarToken().then((ok) => { setLogado(ok); setPronto(true); SplashScreen.hide(); });
    Network.getStatus().then((s) => setOnline(s.connected));
    const h = Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
    return () => { h.then((x) => x.remove()); };
  }, []);

  useEffect(() => {
    if (!logado) return;
    // Áreas liberadas e onde abrir (D6). Falha = navegação padrão, para não travar o app.
    api.inicio()
      .then((p) => { setAreas(p.areas); return montarNavegacao(p.perfil, p.areas, p.abre_em, p.barra ?? null); })
      .catch(() => NAV_PADRAO)
      .then((n) => { navRef.current = n; setNav(n); setAba(n.casa); setSubMais(null); });
    renovarLembrete(abrirPonto).catch(() => {});
  }, [logado, abrirPonto]);

  // Ponto/Conta abertos a partir do Mais: o voltar do Android volta ao Mais.
  useVoltar(aba === 'mais' && subMais !== null, () => setSubMais(null));

  // Notificação de tarefa (tela 16) abre o detalhe (tela 28); id fora do formato "todo:<n>" abre só a lista.
  const abrirTarefa = (id: number | string | null) => { setTarefaPendente(idDoTodo(id)); abrir('tarefas'); };

  // Tela 30: grava no ERP (`[]` = padrão) e remonta a barra com o que o servidor devolveu. O usuário continua em Meu menu.
  const salvarBarra = async (modulos: Area[]) => {
    const r = await api.salvarBarra(modulos);
    const nv = montarNavegacao('erp', areas, 'inicio', r.barra);
    navRef.current = nv; setNav(nv); setAba('mais'); setSubMais('menu');
  };

  /** Uma tela por chave: como aba (sem voltar) ou aberta a partir de Mais (com voltar). */
  function tela(k: Aba | SubMais, voltar?: ReactNode) {
    switch (k) {
      case 'tarefas': return <Tarefas avisar={avisar} abrirPonto={abrirPonto} abrir={tarefaPendente} aoAbrir={limparTarefaPendente} voltar={voltar} />;
      case 'pedidos': return <Pedidos voltar={voltar} avisar={avisar} online={online} />;
      case 'producao': return <Producao voltar={voltar} />;
      case 'pessoas': return <Pessoas avisar={avisar} voltar={voltar} />;
      case 'orcamentos': return <Orcamentos voltar={voltar} />;
      case 'estoque': return <Estoque filtroInicial={estoqueFiltro} voltar={voltar} />;
      case 'produtos': return <Produtos avisar={avisar} voltar={voltar} />;
      case 'financeiro': return <Financeiro voltar={voltar} />;
      case 'fiscal': return <Fiscal voltar={voltar} />;
      case 'relatorios': return <Relatorios voltar={voltar} />;
      case 'dashboard': return <Dashboard irParaPedidos={() => abrir('pedidos')} irParaProducao={() => abrir('producao')} voltar={voltar} />;
      case 'ponto_gestor': return <FilaGestor avisar={avisar} voltar={voltar} />;
      case 'equipe': return <Equipe voltar={voltar} />;
      case 'assistente': return <Assistente online={online} voltar={voltar} />;
      case 'pagamentos': return <Pagamentos avisar={avisar} voltar={voltar} />;
      case 'ponto': return <Ponto avisar={avisar} online={online} voltar={voltar} />;
      case 'conta': return <Conta avisar={avisar} aoSair={() => setLogado(false)} voltar={voltar} />;
      case 'menu': {
        const nv = navRef.current;
        const disponiveis = MODULOS_BARRA.filter((m) => nv.abas.includes(m) || nv.modulosMais.includes(m as SubMais));
        // key: depois de salvar/restaurar a barra muda e a tela recomeça a partir dela.
        return <PerfilMenu key={nv.modulosBarra.join(',')} disponiveis={disponiveis} atual={nv.modulosBarra}
          aoSalvar={salvarBarra} avisar={avisar} online={online} voltar={voltar} />;
      }
      default: return null;
    }
  }

  if (!pronto) return null;
  if (!logado) return <Login aoEntrar={() => setLogado(true)} />;
  const n = nav ?? NAV_PADRAO;

  return (
    <div className="oi oi-app" data-theme={tema}>
      {DEMO && <div className="app-banner demo">Modo demonstração — dados simulados</div>}
      {!online && <div className="app-banner off" role="status">Sem conexão. Bater ponto precisa de internet.</div>}
      <div className="oi-screen">
        {!nav && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {nav && aba === 'inicio' && <Inicio avisar={avisar} irParaPonto={abrirPonto} irParaPedidos={() => abrir('pedidos')} irParaTarefas={() => abrir('tarefas')}
          irParaEstoque={n.modulosMais.includes('estoque') || n.abas.includes('estoque') ? () => { setEstoqueFiltro('baixo'); abrir('estoque'); } : undefined}
          abrirDestino={(tipo, id) => (tipo === 'ponto' ? abrirPonto() : tipo === 'tarefa' ? abrirTarefa(id) : tipo === 'producao' ? abrir('producao')
            : tipo === 'pedido' ? abrir('pedidos') : irPara('mais'))} />}
        {nav && aba !== 'inicio' && aba !== 'mais' && tela(aba)}
        {nav && aba === 'mais' && subMais === null && <Mais abrir={(x) => { setEstoqueFiltro('todos'); setSubMais(x); }} modulos={n.modulosMais}
          aoPersonalizar={n.personalizavel ? () => setSubMais('menu') : undefined} />}
        {nav && aba === 'mais' && subMais !== null && tela(subMais, <VoltarMais aoVoltar={() => setSubMais(null)} />)}
      </div>
      <nav className="oi-tabbar" aria-label="Navegação">
        {nav && n.abas.map((a) => ABAS.find((x) => x.id === a)).filter((x): x is (typeof ABAS)[number] => !!x).map(({ id, label, Icone }) => (
          <button key={id} className={'oi-tab' + (aba === id ? ' active' : '')} aria-current={aba === id ? 'page' : undefined}
            onClick={() => irPara(id)} style={{ minHeight: 52 }}>
            <div className="ico-wrap"><Icone tamanho={22} /></div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {toast && <div className={'app-toast ' + toast.tom} role="status">{toast.texto}</div>}
    </div>
  );
}
