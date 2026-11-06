'use client';

import { useCallback, useEffect, useState } from 'react';

export function useMobileEnvironment() {
  const [now, setNow] = useState<Date | null>(null);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => { setNow(new Date()); setOnline(navigator.onLine); };
    update();
    const timer = window.setInterval(update, 30_000);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.clearInterval(timer); window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return { now, online };
}

export function useMobileRevalidation(revalidate: () => void) {
  const onVisible = useCallback(() => { if (document.visibilityState === 'visible') revalidate(); }, [revalidate]);
  useEffect(() => {
    window.addEventListener('online', revalidate);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('online', revalidate); document.removeEventListener('visibilitychange', onVisible); };
  }, [revalidate, onVisible]);
}
