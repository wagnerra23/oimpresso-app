// Tema do celular (decisão [W] D14, 2026-10-01: "segue o tema do celular").
// Lê prefers-color-scheme e acompanha a troca ao vivo. Os dois temas estão em styles/oi-v4.css.
import { useEffect, useState } from 'react';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

export type Tema = 'light' | 'dark';
const consulta = () => window.matchMedia('(prefers-color-scheme: dark)');

export function useTemaDoCelular(): Tema {
  const [tema, setTema] = useState<Tema>(() => (consulta().matches ? 'dark' : 'light'));
  useEffect(() => {
    const mq = consulta();
    const mudou = (e: MediaQueryListEvent) => setTema(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', mudou);
    return () => mq.removeEventListener('change', mudou);
  }, []);
  useEffect(() => {
    document.documentElement.style.colorScheme = tema;
    // Ícones da barra de status/navegação: claros no tema escuro, escuros no claro.
    if (Capacitor.isNativePlatform()) {
      SystemBars.setStyle({ style: tema === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
    }
  }, [tema]);
  return tema;
}
