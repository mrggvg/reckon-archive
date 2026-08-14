import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from './context';
import {
  badge,
  btn,
  btnBlock,
  field,
  hint,
  input,
  label,
  tabSeg,
} from '../styles/cx';

type Mode = 'signin' | 'register';

/** A week of logged hours, as the app itself would show it. */
const SAMPLE_DAYS = [
  { day: 'sre', date: '06.05.', span: '09:00–13:30', hours: '4,5 h' },
  { day: 'čet', date: '07.05.', span: '08:30–16:00', hours: '7,5 h' },
  { day: 'pet', date: '08.05.', span: '09:00–12:00', hours: '3,0 h' },
];

/**
 * Desktop-only half of the sign-in screen.
 *
 * Instead of a stock illustration it shows the app's own material — three
 * logged days adding up to one invoice — so the screen says what Reckon does
 * before you have an account to look at. Hidden on phones, where the form
 * should own the whole viewport.
 */
function Showcase() {
  return (
    <aside className="hidden flex-col justify-between border-l border-border bg-primary p-10 text-primary-fg desk:flex">
      <span className="font-mono text-2xs uppercase tracking-wider opacity-80">
        od ure do računa
      </span>

      <div>
        <h2 className="mt-0 mb-2 text-3xl leading-tight font-bold tracking-tight text-balance">
          Vsaka ura pride na račun.
        </h2>
        <p className="m-0 text-sm opacity-80 text-pretty">
          Evidenca opravljenega dela in izdaja računov za s.p. Brez preglednic.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 text-fg shadow-xs">
        <div className="mb-3 flex items-baseline justify-between font-mono text-2xs uppercase tracking-wider text-muted-fg">
          <span>maj 2026</span>
          <span>28,00 €/h</span>
        </div>

        <ul className="m-0 list-none p-0">
          {SAMPLE_DAYS.map((d) => (
            <li
              key={d.date}
              className="flex items-baseline justify-between gap-3 py-1 text-xs"
            >
              <span className="whitespace-nowrap text-muted-fg">
                {d.day} {d.date}
              </span>
              <span className="font-mono text-muted-fg">{d.span}</span>
              <span className="font-mono font-semibold">{d.hours}</span>
            </li>
          ))}
          <li className="py-1 text-center text-xs text-muted-fg" aria-hidden>
            ⋯
          </li>
        </ul>

        <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <div className="font-mono text-2xs whitespace-nowrap text-muted-fg">
              Račun 004/2026
            </div>
            <div className="text-lg leading-tight font-bold tracking-tight">
              1.820,00 €
            </div>
          </div>
          <span className={badge.success}>plačano</span>
        </div>
      </div>
    </aside>
  );
}

export function AuthScreen() {
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setFields({});
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setFields({});
    try {
      if (mode === 'signin') await signIn(email, password);
      else await register(email, password);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.fields ? '' : err.message);
        setFields(err.fields ?? {});
      } else {
        setError('Prišlo je do napake. Poskusite znova.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-svh items-center justify-center bg-bg p-6">
      <div className="grid w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-xs desk:max-w-4xl desk:grid-cols-2">
        <div className="p-8 desk:p-10">
          <div className="mb-6">
            <span className="block text-2xl font-bold tracking-tight">
              Reckon
            </span>
            <span className="mt-1 block font-mono text-2xs uppercase tracking-wider text-muted-fg">
              evidenca dela
            </span>
          </div>

          <div className="mb-4 flex gap-0.5 rounded-lg bg-muted p-1">
            <button
              type="button"
              className={tabSeg(mode === 'signin')}
              onClick={() => switchMode('signin')}
            >
              Prijava
            </button>
            <button
              type="button"
              className={tabSeg(mode === 'register')}
              onClick={() => switchMode('register')}
            >
              Registracija
            </button>
          </div>

          {error && (
            <div
              className="mb-4 rounded-2xl border border-border bg-error-bg px-3 py-2.5 text-xs text-error-fg"
              role="alert"
            >
              {error}
            </div>
          )}

          <form onSubmit={onSubmit} noValidate>
            <div className={field}>
              <label className={label} htmlFor="authEmail">
                E-pošta
              </label>
              <input
                id="authEmail"
                className={input + (fields.email ? ' border-destructive' : '')}
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={fields.email ? true : undefined}
              />
              {fields.email && (
                <div className="mt-1.5 text-xs text-error-fg">
                  {fields.email}
                </div>
              )}
            </div>

            <div className={field}>
              <label className={label} htmlFor="authPassword">
                Geslo
              </label>
              <input
                id="authPassword"
                className={
                  input + (fields.password ? ' border-destructive' : '')
                }
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={fields.password ? true : undefined}
              />
              {fields.password ? (
                <div className="mt-1.5 text-xs text-error-fg">
                  {fields.password}
                </div>
              ) : mode === 'register' ? (
                <div className={hint}>Najmanj 8 znakov.</div>
              ) : null}
            </div>

            <button
              className={`${btn.primary} ${btnBlock}`}
              type="submit"
              disabled={busy}
            >
              {busy
                ? mode === 'signin'
                  ? 'Prijavljam …'
                  : 'Ustvarjam račun …'
                : mode === 'signin'
                  ? 'Prijava'
                  : 'Ustvari račun'}
            </button>
          </form>

          <p className="mt-4 mb-0 text-center text-xs text-muted-fg">
            {mode === 'signin' ? (
              <>
                Še nimate računa?{' '}
                <button
                  className="cursor-pointer border-none bg-none p-0 font-semibold text-primary underline underline-offset-2"
                  onClick={() => switchMode('register')}
                >
                  Ustvarite ga
                </button>
              </>
            ) : (
              <>
                Že registrirani?{' '}
                <button
                  className="cursor-pointer border-none bg-none p-0 font-semibold text-primary underline underline-offset-2"
                  onClick={() => switchMode('signin')}
                >
                  Prijavite se
                </button>
              </>
            )}
          </p>
        </div>

        <Showcase />
      </div>
    </div>
  );
}
