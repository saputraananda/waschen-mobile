import { useEffect } from 'react';

/**
 * Freeze background scroll (body) selama modal/bottom-sheet terbuka.
 * Support nested modal (counter-based).
 *
 * Original styles hanya disimpan saat lock pertama (count 1→).
 * Restore hanya saat lock terakhir dilepas — mencegah nested unlock
 * mengembalikan body ke overflow:hidden / position:fixed (scroll stuck).
 */
export default function useLockBodyScroll(locked) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const openCount = Number(body.dataset.modalLockCount || '0') + 1;
    body.dataset.modalLockCount = String(openCount);

    if (openCount === 1) {
      body.dataset.modalLockPrevOverflow = body.style.overflow;
      body.dataset.modalLockPrevPosition = body.style.position;
      body.dataset.modalLockPrevTop = body.style.top;
      body.dataset.modalLockPrevWidth = body.style.width;
      body.dataset.modalLockScrollY = String(window.scrollY);

      body.style.overflow = 'hidden';
      body.style.position = 'fixed';
      body.style.top = `-${window.scrollY}px`;
      body.style.width = '100%';
    }

    return () => {
      const remaining = Number(body.dataset.modalLockCount || '1') - 1;
      body.dataset.modalLockCount = String(Math.max(remaining, 0));
      if (remaining > 0) return;

      const scrollY = Number(body.dataset.modalLockScrollY || '0') || 0;
      body.style.overflow = body.dataset.modalLockPrevOverflow || '';
      body.style.position = body.dataset.modalLockPrevPosition || '';
      body.style.top = body.dataset.modalLockPrevTop || '';
      body.style.width = body.dataset.modalLockPrevWidth || '';

      delete body.dataset.modalLockPrevOverflow;
      delete body.dataset.modalLockPrevPosition;
      delete body.dataset.modalLockPrevTop;
      delete body.dataset.modalLockPrevWidth;
      delete body.dataset.modalLockScrollY;
      delete body.dataset.modalLockCount;

      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
