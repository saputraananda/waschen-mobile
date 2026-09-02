import { useEffect } from 'react';

/**
 * Freeze background scroll (body) selama modal/bottom-sheet terbuka.
 * Support nested modal (counter-based) via data attribute di body.
 */
export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const openCount = Number(body.dataset.modalLockCount || '0') + 1;
    body.dataset.modalLockCount = String(openCount);

    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    const scrollY = window.scrollY;

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';

    return () => {
      const remaining = Number(body.dataset.modalLockCount || '1') - 1;
      body.dataset.modalLockCount = String(Math.max(remaining, 0));
      if (remaining > 0) return;

      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
