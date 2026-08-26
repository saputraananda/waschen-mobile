/**
 * Global PWA install prompt capture.
 * beforeinstallprompt often fires once early (before Profile mounts),
 * so we store it here and share across the app.
 */

const INSTALLED_KEY = 'waschen_pwa_installed';

let deferredPrompt = null;
const subscribers = new Set();

function notify() {
  subscribers.forEach((fn) => fn(deferredPrompt));
}

export function markPwaInstalled() {
  try {
    localStorage.setItem(INSTALLED_KEY, '1');
  } catch (_) {
    /* ignore */
  }
}

export function clearPwaInstalledMark() {
  try {
    localStorage.removeItem(INSTALLED_KEY);
  } catch (_) {
    /* ignore */
  }
}

export function isPwaMarkedInstalled() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function isPwaStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true
  );
}

/** Sync check used for initial UI state */
export function isPwaKnownInstalled() {
  return isPwaStandalone() || isPwaMarkedInstalled();
}

/** Async check including Chromium related-apps API */
export async function checkPwaInstalled() {
  if (isPwaStandalone()) {
    markPwaInstalled();
    return true;
  }
  if (isPwaMarkedInstalled()) return true;

  if (typeof navigator !== 'undefined' && typeof navigator.getInstalledRelatedApps === 'function') {
    try {
      const apps = await navigator.getInstalledRelatedApps();
      if (Array.isArray(apps) && apps.length > 0) {
        markPwaInstalled();
        return true;
      }
    } catch (_) {
      /* ignore */
    }
  }

  return false;
}

export function initPwaInstallCapture() {
  if (typeof window === 'undefined' || window.__waschenPwaInstallReady) return;
  window.__waschenPwaInstallReady = true;

  if (isPwaStandalone()) {
    markPwaInstalled();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Prompt available => app is not (fully) installed for this browser session
    clearPwaInstalledMark();
    deferredPrompt = e;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    markPwaInstalled();
    notify();
  });
}

export function getDeferredInstallPrompt() {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null;
  notify();
}

export function subscribePwaInstall(fn) {
  subscribers.add(fn);
  fn(deferredPrompt);
  return () => subscribers.delete(fn);
}

export function waitForInstallPrompt(timeoutMs = 1500) {
  const existing = getDeferredInstallPrompt();
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (prompt) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(prompt || null);
    };

    const unsubscribe = subscribePwaInstall((prompt) => {
      if (prompt) finish(prompt);
    });

    const timer = setTimeout(() => finish(getDeferredInstallPrompt()), timeoutMs);
  });
}
