import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import { initPwaInstallCapture } from './utils/pwaInstall.js';
import './index.css';

initPwaInstallCapture();

// Scroll di atas input angka jangan menambah/mengurangi nilainya.
document.addEventListener('wheel', () => {
  const el = document.activeElement;
  if (el?.type === 'number') el.blur();
}, { passive: true });
// iOS PWA standalone tidak reload saat resume dari background -> update SW tak pernah terdeteksi.
// Paksa cek update saat app kembali foreground + tiap 1 jam.
const updateSW = registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
        if (!reg) return;
        const check = () => { if (document.visibilityState === 'visible') reg.update(); };
        document.addEventListener('visibilitychange', check);
        window.addEventListener('focus', check);
        setInterval(check, 60 * 60 * 1000);
    },
    onNeedRefresh() { updateSW(true); },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SocketProvider>
      <App />
    </SocketProvider>
  </React.StrictMode>
);
