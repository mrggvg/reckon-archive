import { createContext, useContext } from 'react';
import type { AppData } from '../lib/types';

export interface StoreValue {
  data: AppData;
  /** Mutate a structured clone of the data, then persist it. */
  update: (mutate: (draft: AppData) => void) => void;
  /** Replace the whole dataset (restore from backup). */
  replace: (next: AppData) => void;
  toast: (message: string) => void;
}

export const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
