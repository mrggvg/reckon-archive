import type { MissingField } from '@reckon/shared';
import { AlertIcon, UserIcon } from './icons';
import { btn, btnBlock, hint } from '../styles/cx';

/**
 * Shown in place of a form that can't legally be filled in yet. Names the
 * missing pieces rather than just disabling the button, and goes straight to
 * the form that fixes them.
 */
export function ProfileRequired({
  missing,
  onOpenProfile,
}: {
  missing: MissingField[];
  onOpenProfile: () => void;
}) {
  return (
    <>
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-border bg-warning-bg p-4 text-sm leading-normal text-warning-fg">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <div>
          <strong className="mb-0.5 block">Najprej dopolnite svoje podatke</strong>
          Brez njih račun ne bi bil veljaven, zato ga ni mogoče izstaviti.
        </div>
      </div>

      <ul className="mb-4 flex flex-col gap-2">
        {missing.map((m) => (
          <li
            key={m.key}
            className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-destructive" />
            {m.label}
          </li>
        ))}
      </ul>

      <p className={`${hint} mb-4`}>
        Podatki se izpišejo na vsak račun — naziv in naslov zahteva 82. člen ZDDV-1,
        davčna številka je ustaljena praksa, TRR pa je tisto, na kar stranka plača.
      </p>

      <button className={`${btn.primary} ${btnBlock}`} onClick={onOpenProfile}>
        <UserIcon className="size-3.5" />
        Odpri profil
      </button>
    </>
  );
}
