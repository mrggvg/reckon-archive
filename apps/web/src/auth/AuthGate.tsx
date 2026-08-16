import App from '../App';
import { StoreProvider } from '../store/StoreProvider';
import { LedgerGate } from '../store/LedgerGate';
import { AuthScreen } from './AuthScreen';
import { useAuth } from './context';

export function AuthGate() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-2xl font-bold tracking-tight text-muted-fg">
        Reckon
      </div>
    );
  }

  if (status === 'anon' || !user) return <AuthScreen />;

  // Keyed on the user so switching accounts remounts the store rather than
  // carrying one person's ledger into another's session.
  return (
    <StoreProvider key={user.id} userId={user.id}>
      <LedgerGate>
        <App />
      </LedgerGate>
    </StoreProvider>
  );
}
