import { useCallback, useRef, useState } from 'react';

/**
 * Soft refresh: tarik ulang data tanpa reload halaman (hindari splash).
 */
export default function useSoftRefresh(refetchFn, toastMs = 1800) {
  const [refreshing, setRefreshing] = useState(false);
  const [showUpdated, setShowUpdated] = useState(false);
  const toastTimerRef = useRef(null);

  const clearToastTimer = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refetchFn?.();
    } catch {
      // error ditangani di refetchFn
    } finally {
      setRefreshing(false);
      clearToastTimer();
      setShowUpdated(true);
      toastTimerRef.current = setTimeout(() => {
        setShowUpdated(false);
        toastTimerRef.current = null;
      }, toastMs);
    }
  }, [refetchFn, refreshing, toastMs, clearToastTimer]);

  const dismissUpdated = useCallback(() => {
    clearToastTimer();
    setShowUpdated(false);
  }, [clearToastTimer]);

  return { refreshing, showUpdated, setShowUpdated: dismissUpdated, handleRefresh };
}
