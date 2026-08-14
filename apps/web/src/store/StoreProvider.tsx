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
      if (!saveData(userId, next)) toast('Shranjevanje ni uspelo — pomnilnik brskalnika je poln ali blokiran');
    },
    [toast, userId],
  );

  const update = useCallback(
    (mutate: (draft: AppData) => void) => {
      setData((current) => {
        const draft = structuredClone(current);
        mutate(draft);
        if (!saveData(userId, draft)) toast('Shranjevanje ni uspelo — pomnilnik brskalnika je poln ali blokiran');
        return draft;
      });
    },
    [toast, userId],
  );

  const value = useMemo(
    () => ({
      data,
      update,
      replace: persist,
      toast,
      toastMessage: toastMsg,
      toastVisible: toastShown,
    }),
    [data, update, persist, toast, toastMsg, toastShown],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
