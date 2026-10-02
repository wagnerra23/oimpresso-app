// Shell do app. Barra de baixo do contrato §7.1: Início · Tarefas · Pedidos · Produção · Mais;
// Ponto e Conta (e depois Pessoas) dentro de Mais. Aba só aparece quando a tela existe.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as AppNativo } from '@capacitor/app';
import { carregarToken, DEMO, quandoExpirar } from './api';
import { renovarLembrete } from './push';
import { useTemaDoCelular } from './tema';
import { Ic } from './icones';
import { tratarVoltar } from './voltar';
import { Pedidos } from './telas/Pedidos';
import { Tarefas } from './telas/Tarefas';
import { Mais, VoltarMais, type SubMais } from './telas/Mais';
import { Pessoas } from './telas/Pessoas';
import { useVoltar } from './voltar';
import { Login } from './telas/Login';
import { Inicio } from './telas/Inicio';
import { Ponto } from './telas/Ponto';
import { Conta } from './telas/Conta';

type Aba = 'inicio' | 'tarefas' | 'pedidos' | 'mais';
type Toast = { texto: string; tom: 'ok' | 'warn' | 'erro' } | null;

const ABAS: Array<{ id: Aba; label: string; Icone: (p: { tamanho?: number }) => ReactElement }> = [
  { id: 'inicio', label: 'Início', Icone: Ic.inicio },
  { id: 'tarefas', label: 'Tarefas', Icone: Ic.tarefa },
  { id: 'pedidos', label: 'Pedidos', Icone: Ic.pedido },
  { id: 'mais', label: 'Mais', Icone: Ic.mais },
];

export function App() {
  const tema = useTemaDoCelular();
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [aba, setAba] = useState<Aba>('inicio');
  const [subMais, setSubMais] = useState<SubMais | null>(null);
  const irPara = useCallback((a: Aba, sub: SubMais | null = null) => { setAba(a); setSubMais(sub); }, []);
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<number | undefined>(undefined);
  const abaAtual = useRef<Aba>('inicio');
  abaAtual.current = aba;

  // Voltar do Android: a tela empilhada trata (ex.: detalhe → lista); senão volta ao Início;
  // no Início, o app vai para segundo plano.
  useEffect(() => {
    const h = AppNativo.addListener('backButton', () => {
      if (tratarVoltar()) return;
      if (abaAtual.current !== 'inicio') { setAba('inicio'); return; }
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
    quandoExpirar(() => { setLogado(false); setAba('inicio'); setSubMais(null); });
    carregarToken().then((ok) => { setLogado(ok); setPronto(true); SplashScreen.hide(); });
    Network.getStatus().then((s) => setOnline(s.connected));
    const h = Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
    return () => { h.then((x) => x.remove()); };
  }, []);

  useEffect(() => {
    if (logado) renovarLembrete(() => irPara('mais', 'ponto')).catch(() => {});
  }, [logado]);

  // Ponto/Conta abertos a partir do Mais: o voltar do Android volta ao Mais.
  useVoltar(aba === 'mais' && subMais !== null, () => setSubMais(null));

  if (!pronto) return null;
  if (!logado) return <Login aoEntrar={() => { setLogado(true); irPara('inicio'); }} />;

  return (
    <div className="oi oi-app" data-theme={tema}>
      {DEMO && <div className="app-banner demo">Modo demonstração — dados simulados</div>}
      {!online && <div className="app-banner off" role="status">Sem conexão. Bater ponto precisa de internet.</div>}
      <div className="oi-screen">
        {aba === 'inicio' && <Inicio irParaPonto={() => irPara('mais', 'ponto')} />}
        {aba === 'tarefas' && <Tarefas avisar={avisar} abrirPonto={() => irPara('mais', 'ponto')} />}
        {aba === 'pedidos' && <Pedidos />}
        {aba === 'mais' && subMais === null && <Mais abrir={setSubMais} />}
        {aba === 'mais' && subMais === 'pessoas' && <Pessoas voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'ponto' && <Ponto avisar={avisar} online={online} voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
        {aba === 'mais' && subMais === 'conta' && <Conta avisar={avisar} aoSair={() => setLogado(false)} voltar={<VoltarMais aoVoltar={() => setSubMais(null)} />} />}
      </div>
      <nav className="oi-tabbar" aria-label="Navegação">
        {ABAS.map(({ id, label, Icone }) => (
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
