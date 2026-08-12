import { useState } from 'react';
import { ApiError } from '../lib/api';
import { useAuth } from './context';

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
        setError('Something went wrong. Try again.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark">Reckon</span>
          <span className="sub">freelance ledger</span>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={'tab-seg' + (mode === 'signin' ? ' active' : '')}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className={'tab-seg' + (mode === 'register' ? ' active' : '')}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        {error && (
          <div className="banner danger" role="alert">
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <div className="field">
            <label className="label" htmlFor="authEmail">
              Email
            </label>
            <input
              id="authEmail"
              className={'input' + (fields.email ? ' invalid' : '')}
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={fields.email ? true : undefined}
            />
            {fields.email && <div className="field-error">{fields.email}</div>}
          </div>

          <div className="field">
            <label className="label" htmlFor="authPassword">
              Password
            </label>
            <input
              id="authPassword"
              className={'input' + (fields.password ? ' invalid' : '')}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fields.password ? true : undefined}
            />
            {fields.password ? (
              <div className="field-error">{fields.password}</div>
            ) : mode === 'register' ? (
              <div className="hint">At least 8 characters.</div>
            ) : null}
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy
              ? mode === 'signin'
                ? 'Signing in…'
                : 'Creating account…'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="auth-foot">
          {mode === 'signin' ? (
            <>
              No account yet?{' '}
              <button className="link-btn" onClick={() => switchMode('register')}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already registered?{' '}
              <button className="link-btn" onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
