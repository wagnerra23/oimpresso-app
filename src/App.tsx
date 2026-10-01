// Shell do app: login → 3 abas (Início · Ponto · Conta), barra inferior do design-v3.
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Network } from '@capacitor/network';
import { SplashScreen } from '@capacitor/splash-screen';
import { carregarToken, DEMO, quandoExpirar } from './api';
import { renovarLembrete } from './push';
import { useTemaDoCelular } from './tema';
import { Ic } from './icones';
import { Login } from './telas/Login';
import { Inicio } from './telas/Inicio';
import { Ponto } from './telas/Ponto';
import { Conta } from './telas/Conta';

type Aba = 'inicio' | 'ponto' | 'conta';
type Toast = { texto: string; tom: 'ok' | 'warn' | 'erro' } | null;

const ABAS: Array<{ id: Aba; label: string; Icone: (p: { tamanho?: number }) => ReactElement }> = [
  { id: 'inicio', label: 'Início', Icone: Ic.inicio },
  { id: 'ponto', label: 'Ponto', Icone: Ic.relogio },
  { id: 'conta', label: 'Conta', Icone: Ic.usuario },
];

export function App() {
  const tema = useTemaDoCelular();
  const [pronto, setPronto] = useState(false);
  const [logado, setLogado] = useState(false);
  const [aba, setAba] = useState<Aba>('inicio');
  const [online, setOnline] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<number | undefined>(undefined);

  const avisar = useCallback((texto: string, tom: 'ok' | 'warn' | 'erro' = 'ok') => {
    setToast({ texto, tom });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => {
    quandoExpirar(() => { setLogado(false); setAba('inicio'); });
    carregarToken().then((ok) => { setLogado(ok); setPronto(true); SplashScreen.hide(); });
    Network.getStatus().then((s) => setOnline(s.connected));
    const h = Network.addListener('networkStatusChange', (s) => setOnline(s.connected));
    return () => { h.then((x) => x.remove()); };
  }, []);

  useEffect(() => {
    if (logado) renovarLembrete(() => setAba('ponto')).catch(() => {});
  }, [logado]);

  if (!pronto) return null;
  if (!logado) return <Login aoEntrar={() => { setLogado(true); setAba('inicio'); }} />;

  return (
    <div className="oi oi-app" data-theme={tema}>
      {DEMO && <div className="app-banner demo">Modo demonstração — dados simulados</div>}
      {!online && <div className="app-banner off" role="status">Sem conexão. Bater ponto precisa de internet.</div>}
      <div className="oi-screen">
        {aba === 'inicio' && <Inicio irParaPonto={() => setAba('ponto')} />}
        {aba === 'ponto' && <Ponto avisar={avisar} online={online} />}
        {aba === 'conta' && <Conta avisar={avisar} aoSair={() => setLogado(false)} />}
      </div>
      <nav className="oi-tabbar" aria-label="Navegação">
        {ABAS.map(({ id, label, Icone }) => (
          <button key={id} className={'oi-tab' + (aba === id ? ' active' : '')} aria-current={aba === id ? 'page' : undefined}
            onClick={() => setAba(id)} style={{ minHeight: 52 }}>
            <div className="ico-wrap"><Icone tamanho={22} /></div>
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {toast && <div className={'app-toast ' + toast.tom} role="status">{toast.texto}</div>}
    </div>
  );
}
