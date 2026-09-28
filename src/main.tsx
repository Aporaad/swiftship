import './lib/sanitizeConsole';
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthSessionProvider } from './features/auth/AuthSessionProvider';
import './index.css';
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthSessionProvider>
      <App />
    </AuthSessionProvider>
  </StrictMode>,
);
