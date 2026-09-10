import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { initPwaInstallCapture } from './utils/pwaInstall.js';
import './index.css';

initPwaInstallCapture();
registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </React.StrictMode>
);
