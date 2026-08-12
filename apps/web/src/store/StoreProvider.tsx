import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { loadData, saveData } from '../lib/storage';
import type { AppData } from '../lib/types';
import { StoreContext } from './context';

export function StoreProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [data, setData] = useState<AppData>(() => loadData(userId));
  const [toastMsg, setToastMsg] = useState('');
  const [toastShown, setToastShown] = useState(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const toast = useCallback((message: string) => {
    setToastMsg(message);
    setToastShown(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastShown(false), 2200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const persist = useCallback(
    (next: AppData) => {
      setData(next);
      if (!saveData(userId, next)) toast('Could not save — storage is full or blocked');
    },
    [toast, userId],
  );

  const update = useCallback(
    (mutate: (draft: AppData) => void) => {
      setData((current) => {
        const draft = structuredClone(current);
        mutate(draft);
        if (!saveData(userId, draft)) toast('Could not save — storage is full or blocked');
        return draft;
      });
    },
    [toast, userId],
  );

  const value = useMemo(
    () => ({ data, update, replace: persist, toast }),
    [data, update, persist, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div
        className={
          'pointer-events-none fixed bottom-23 left-1/2 z-200 max-w-xs -translate-x-1/2 rounded-xl bg-fg px-5 py-3 text-sm font-medium text-white transition-all duration-250 desk:right-6 desk:bottom-6 desk:left-auto desk:translate-x-0 ' +
          (toastShown ? 'translate-y-0 opacity-100' : 'invisible translate-y-20 opacity-0')
        }
        role="status"
      >
        {toastMsg}
      </div>
    </StoreContext.Provider>
  );
}
