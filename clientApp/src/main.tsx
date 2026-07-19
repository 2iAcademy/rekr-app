import '../instrument.js';
import { StrictMode } from 'react';
import { createRoot, type Container } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { Toaster } from '@/components/ui/sonner';
import * as Sentry from '@sentry/react';

const container = document.getElementById('root');
const root = createRoot(container as Container, {
  onUncaughtError: Sentry.reactErrorHandler((error, errorInfo) => {
    console.warn('Uncaught error', error, errorInfo.componentStack);
  }),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
});
root.render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>,
);
