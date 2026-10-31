import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fontsource-variable/inter';
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';
import './styles/layouts.css';
import './styles/responsive.css';
import './styles/theme.css';
import './styles/dashboard.css';
import './styles/design-system.css';
import { App } from './app/App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Installable app (PWA). Only in production builds so the dev server is never cached.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not critical: the portal works the same without it
    });
  });
}
