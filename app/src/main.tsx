import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { normalizeUrl } from './lib/state/actions';
import { setUpInstall } from './lib/state/install';
import { initTheme } from './lib/state/theme';
import './index.css';

normalizeUrl();
initTheme();
setUpInstall();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
