// Ícones do protótipo (design-v3/icons.jsx): traço 1.6, viewBox 24.
import type { ReactNode } from 'react';

const svg = (filhos: ReactNode) => ({ tamanho = 22 }: { tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{filhos}</svg>
);

export const Ic = {
  inicio: svg(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  relogio: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  pedido: svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" /></>),
  mais: svg(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  pacote: svg(<><path d="M21 8l-9-5-9 5 9 5z" /><path d="M3 8v8l9 5 9-5V8" /><path d="M12 13v8" /></>),
  estoque: svg(<><path d="M3 21V8l9-5 9 5v13" /><path d="M7 21v-8h10v8" /><path d="M7 17h10" /></>),
  check: svg(<><path d="M5 12l5 5L20 7" /></>),
  producao: svg(<><path d="M3 21V10l5 3V10l5 3V7l8 4v10z" /><path d="M7 17h2M12 17h2M17 17h1" /></>),
  tarefa: svg(<><path d="M3 5h18v9h-6l-2 3h-2l-2-3H3z" /><path d="M3 14v5h18v-5" /></>),
  pessoas: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0113 0" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18 14.5a6.5 6.5 0 013.5 5.5" /></>),
  usuario: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>),
  calendario: svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>),
  sair: svg(<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>),
  chat: svg(<><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8" /><path d="M8 12h5" /></>),
  sino: svg(<><path d="M6 9a6 6 0 1112 0v4l2 3H4l2-3V9z" /><path d="M10 19a2 2 0 004 0" /></>),
};
