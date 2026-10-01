import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// O build vai para www/ — é o webDir do Capacitor (bundle local, não o site).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'www', emptyOutDir: true, sourcemap: false },
});
