import { createContext, useContext } from 'react';

/**
 * False for sheets sitting underneath another one. They stay mounted — so a
 * half-filled form survives a detour — but must not react to Escape or steal
 * focus while they're covered.
 */
export const SheetActiveContext = createContext(true);

export function useSheetActive(): boolean {
  return useContext(SheetActiveContext);
}
