import { useEffect, useState } from 'react';

/** 反映ハイライト用。token が変わるとフラッシュをやり直す */
export function useHousingApplyFlash(highlightToken?: number): boolean {
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (highlightToken == null) {
      setFlashing(false);
      return;
    }
    setFlashing(false);
    const frame = requestAnimationFrame(() => setFlashing(true));
    const timer = window.setTimeout(() => setFlashing(false), 1800);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [highlightToken]);

  return flashing;
}
