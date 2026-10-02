import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './styles/oimpresso-tokens.css';
import './styles/oi-v4.css';
import './styles/ponto.css';
import './styles/app.css';
import './styles/ponto-v4.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
