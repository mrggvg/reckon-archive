import { useStore } from '../store/context';

/**
 * Transient confirmations. Sits bottom-right on a desktop — except while a
 * panel is open, when that corner belongs to the drawer, so it moves to the
 * opposite side rather than landing on top of the save button.
 */
export function Toast({ panelOpen }: { panelOpen: boolean }) {
  const { toastMessage, toastVisible } = useStore();

  return (
    <div
      className={
        'pointer-events-none fixed left-1/2 z-200 max-w-xs -translate-x-1/2 rounded-xl bg-fg px-5 py-3 text-sm font-medium text-white transition-all duration-250 desk:bottom-6 desk:translate-x-0 ' +
        // On a phone the sheet is full screen: lift clear of its pinned action.
        (panelOpen ? 'bottom-28 ' : 'bottom-23 ') +
        (panelOpen ? 'desk:right-auto desk:left-6 ' : 'desk:left-auto desk:right-6 ') +
        (toastVisible ? 'translate-y-0 opacity-100' : 'invisible translate-y-20 opacity-0')
      }
      role="status"
    >
      {toastMessage}
    </div>
  );
}
