import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { validateBody } from '../../middleware/validate.js';
import { authService } from './auth.service.js';

const credentials = z.object({
  email: z.email('Vnesite veljaven e-poštni naslov').trim().toLowerCase(),
  password: z.string().min(8, 'Uporabite vsaj 8 znakov'),
});

/** Issues a fresh session id, so a pre-login cookie can't be replayed. */
function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

export const authRouter = Router();

authRouter.post(
  '/register',
  validateBody(credentials),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof credentials>;
    const user = await authService.register(email, password);
    await regenerateSession(req);
    req.session.userId = user.id;
    res.status(201).json({ user });
  }),
);

authRouter.post(
  '/login',
  validateBody(credentials),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof credentials>;
    const user = await authService.login(email, password);
    await regenerateSession(req);
    req.session.userId = user.id;
    res.json({ user });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await destroySession(req);
    res.clearCookie('connect.sid');
    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: await authService.me(req.session.userId!) });
  }),
);
