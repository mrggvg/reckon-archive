import { withTransaction } from '../../db/tx.js';
import { ConflictError, UnauthorizedError } from '../../lib/AppError.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { authRepo, type UserRow } from './auth.repo.js';

export const authService = {
  async register(email: string, password: string): Promise<UserRow> {
    if (await authRepo.emailTaken(email)) {
      throw new ConflictError('Ta e-poštni naslov je že registriran');
    }
    const passwordHash = await hashPassword(password);
    return withTransaction((client) => authRepo.createUser(client, email, passwordHash));
  },

  async login(email: string, password: string): Promise<UserRow> {
    const found = await authRepo.findCredentialsByEmail(email);
    // Same error either way — a wrong password and an unknown address must not
    // be distinguishable, or the form becomes an account-enumeration oracle.
    const ok = found ? await verifyPassword(password, found.password_hash) : false;
    if (!found || !ok) throw new UnauthorizedError('E-pošta ali geslo ni pravilno');

    return { id: found.id, email: found.email, created_at: found.created_at };
  },

  async me(userId: string): Promise<UserRow> {
    const user = await authRepo.findById(userId);
    if (!user) throw new UnauthorizedError('Seja ni več veljavna');
    return user;
  },
};
