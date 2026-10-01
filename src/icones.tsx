// Ícones do protótipo (design-v3/icons.jsx): traço 1.6, viewBox 24.
import type { ReactNode } from 'react';

const svg = (filhos: ReactNode) => ({ tamanho = 22 }: { tamanho?: number }) => (
  <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{filhos}</svg>
);

export const Ic = {
  inicio: svg(<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></>),
  relogio: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  usuario: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>),
  calendario: svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18" /><path d="M8 3v4" /><path d="M16 3v4" /></>),
  sair: svg(<><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4" /><path d="M6 12h10" /></>),
  sino: svg(<><path d="M6 9a6 6 0 1112 0v4l2 3H4l2-3V9z" /><path d="M10 19a2 2 0 004 0" /></>),
};
