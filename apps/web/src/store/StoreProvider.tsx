import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { loadData, saveData } from '../lib/storage';
import type { AppData } from '../lib/types';
import { StoreContext } from './context';

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
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
      if (!saveData(next)) toast('Could not save — storage is full or blocked');
    },
    [toast],
  );

  const update = useCallback(
    (mutate: (draft: AppData) => void) => {
      setData((current) => {
        const draft = structuredClone(current);
        mutate(draft);
        if (!saveData(draft)) toast('Could not save — storage is full or blocked');
        return draft;
      });
    },
    [toast],
  );

  const value = useMemo(
    () => ({ data, update, replace: persist, toast }),
    [data, update, persist, toast],
  );

  return (
    <StoreContext.Provider value={value}>
      {children}
      <div className={'toast' + (toastShown ? ' show' : '')} role="status">
        {toastMsg}
      </div>
    </StoreContext.Provider>
  );
}
