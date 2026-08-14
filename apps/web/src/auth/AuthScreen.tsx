import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from './context';
import { btn, btnBlock, field, hint, input, label, tabSeg } from '../styles/cx';

type Mode = 'signin' | 'register';

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
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-xs">
        <div className="mb-6">
          <span className="block text-2xl font-bold tracking-tight">Reckon</span>
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
            {fields.email && <div className="mt-1.5 text-xs text-error-fg">{fields.email}</div>}
          </div>

          <div className={field}>
            <label className={label} htmlFor="authPassword">
              Geslo
            </label>
            <input
              id="authPassword"
              className={input + (fields.password ? ' border-destructive' : '')}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fields.password ? true : undefined}
            />
            {fields.password ? (
              <div className="mt-1.5 text-xs text-error-fg">{fields.password}</div>
            ) : mode === 'register' ? (
              <div className={hint}>Najmanj 8 znakov.</div>
            ) : null}
          </div>

          <button className={`${btn.primary} ${btnBlock}`} type="submit" disabled={busy}>
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
              <button className="cursor-pointer border-none bg-none p-0 font-semibold text-primary underline underline-offset-2" onClick={() => switchMode('register')}>
                Ustvarite ga
              </button>
            </>
          ) : (
            <>
              Že registrirani?{' '}
              <button className="cursor-pointer border-none bg-none p-0 font-semibold text-primary underline underline-offset-2" onClick={() => switchMode('signin')}>
                Prijavite se
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
