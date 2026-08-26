/**
 * Reset scroll + viewport zoom (sering tersisa setelah fokus input login di mobile).
 */
export function resetPageView() {
  if (typeof window === 'undefined') return;

  try {
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
  } catch (_) {
    /* ignore */
  }

  window.scrollTo(0, 0);
  if (document.documentElement) document.documentElement.scrollTop = 0;
  if (document.body) document.body.scrollTop = 0;

  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;

  const base =
    'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

  // Trick: rewrite viewport briefly so mobile browsers drop residual zoom
  viewport.setAttribute('content', `${base}, maximum-scale=1.01`);
  requestAnimationFrame(() => {
    viewport.setAttribute('content', base);
  });
}
