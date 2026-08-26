import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { resetPageView } from '../utils/resetPageView.js';

/**
 * Reset scroll & viewport zoom whenever route changes.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    resetPageView();
  }, [pathname]);

  return null;
}
