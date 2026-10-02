// Shell do app. Barra de baixo do contrato §7.1: Início · Tarefas · Pedidos · Produção · Mais, com
// Pessoas, Ponto e Conta dentro de Mais. Quais abas aparecem vem do ERP (§6 `areas`, D6): aba visível =
// rota que responde. Colaborador (sem ERP) abre direto no Ponto, que vira aba: Ponto · Mais.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
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
import { Mais, VoltarMais, type SubMais } from './telas/Mais';
import { montarNavegacao, NAV_PADRAO, type Aba, type Navegacao } from './navegacao';
import { Pessoas } from './telas/Pessoas';
import { Orcamentos } from './telas/Orcamentos';
import { Equipe } from './telas/Equipe';
import { Produtos } from './telas/Produtos';
import { Estoque } from './telas/Estoque';
import { useVoltar } from './voltar';
import { Login } from './telas/Login';
import { Inicio } from './telas/Inicio';
import { Ponto } from './telas/Ponto';
import { Conta } from './telas/Conta';

type Toast = { texto: string; tom: 'ok' | 'warn' | 'erro' } | null;

const ABAS: Array<{ id: Aba; label: string; Icone: (p: { tamanho?: number }) => ReactElement }> = [
  { id: 'inicio', label: 'Início', Icone: Ic.inicio },
  { id: 'tarefas', label: 'Tarefas', Icone: Ic.tarefa },
  { id: 'pedidos', label: 'Pedidos', Icone: Ic.pedido },
  { id: 'producao', label: 'Produção', Icone: Ic.producao },
  { id: 'ponto', label: 'Ponto', Icone: Ic.relogio },
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
    if (sub && !n.modulosMais.includes(sub)) return;
    setAba(a); setSubMais(sub);
  }, []);
  const abrirPonto = useCallback(() => (navRef.current.pontoNaBarra ? irPara('ponto') : irPara('mais', 'ponto')), [irPara]);
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
      .then((p) => montarNavegacao(p.perfil, p.areas, p.abre_em))
      .catch(() => NAV_PADRAO)
      .then((n) => { navRef.current = n; setNav(n); setAba(n.casa); setSubMais(null); });
    renovarLembrete(abrirPonto).catch(() => {});
  }, [logado, abrirPonto]);

  // Ponto/Conta abertos a partir do Mais: o voltar do Android volta ao Mais.
  useVoltar(aba === 'mais' && subMais !== null, () => setSubMais(null));

  // Notificação de tarefa (tela 16) abre o detalhe (tela 28); id fora do formato "todo:<n>" abre só a lista.
  const abrirTarefa = (id: number | string | null) => { setTarefaPendente(idDoTodo(id)); irPara('tarefas'); };

  if (!pronto) return null;
  if (!logado) return <Login aoEntrar={() => setLogado(true)} />;
  const n = nav ?? NAV_PADRAO;

  return (
    <div className="oi oi-app" data-theme={tema}>
      {DEMO && <div className="app-banner demo">Modo demonstração — dados simulados</div>}
      {!online && <div className="app-banner off" role="status">Sem conexão. Bater ponto precisa de internet.</div>}
      <div className="oi-screen">
        {!nav && <div className="pd-corpo"><p className="p4-legal">Carregando…</p></div>}
        {nav && aba === 'inicio' && <Inicio avisar={avisar} irParaPonto={abrirPonto} irParaPedidos={() => irPara('pedidos')} irParaTarefas={() => irPara('tarefas')}
          irParaEstoque={n.modulosMais.includes('estoque') ? () => { setEstoqueFiltro('baixo'); irPara('mais', 'estoque'); } : undefined}
          abrirDestino={(tipo, id) => (tipo === 'ponto' ? abrirPonto() : tipo === 'tarefa' ? abrirTarefa(id) : tipo === 'producao' ? irPara('producao')
            : tipo === 'pedido' ? irPara('pedidos') : irPara('mais'))} />}
        {nav && aba === 'tarefas' && <Tarefas avisar={avisar} abrirPonto={abrirPonto} abrir={tarefaPendente} aoAbrir={limparTarefaPendente} />}
        {nav && aba === 'pedidos' && <Pedidos />}
        {nav && aba === 'producao' && <Producao />}
        {nav && aba === 'ponto' && <Ponto avisar={avisar} online={online} />}
        {nav && aba === 'mais' && subMais === null && <Mais abrir={(s) => { setEstoqueFiltro('todos'); setSubMais(s); }} modulos={n.modulosMais} />}
        {aba === 'mais' && subMais === 'pessoas' && <Pessoas avisar={avisar} voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'orcamentos' && <Orcamentos voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'produtos' && <Produtos voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'estoque' && <Estoque filtroInicial={estoqueFiltro} voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'equipe' && <Equipe voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'ponto' && <Ponto avisar={avisar} online={online} voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'conta' && <Conta avisar={avisar} aoSair={() => setLogado(false)} voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
      </div>
      <nav className="oi-tabbar" aria-label="Navegação">
        {nav && ABAS.filter((x) => n.abas.includes(x.id)).map(({ id, label, Icone }) => (
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
