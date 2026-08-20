import { useState } from 'react';

/*
 * Which shape a screen is showing — list, calendar, table.
 *
 * Kept in localStorage rather than component state: someone who works in the
 * table view means it, and having to re-pick it on every visit to the tab is
 * the kind of small friction that makes a preference feel broken. It is only a
 * display choice, so a browser that refuses to store it simply forgets.
 */
export function useViewMode<T extends string>(key: string, fallback: T) {
  const [mode, setMode] = useState<T>(() => {
    // renderToString has no window, and neither has a locked-down browser.
    if (typeof window === 'undefined') return fallback;
    try {
      return (window.localStorage.getItem(key) as T | null) ?? fallback;
    } catch {
      return fallback;
    }
  });

  const choose = (next: T) => {
    setMode(next);
    try {
      window.localStorage.setItem(key, next);
    } catch {
      // A preference not worth an error message.
    }
  };

  return [mode, choose] as const;
}
