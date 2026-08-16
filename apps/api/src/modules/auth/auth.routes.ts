import { Router } from 'express';
import type { Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { env } from '../../config/env.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { validateBody } from '../../middleware/validate.js';
import { authService } from './auth.service.js';
import { SESSION_COOKIE } from '../../app.js';

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

// Guessing a password is the one attack these routes invite; registering in
// bulk is the other. Both are slow work for a person and fast for a script.
const attempts = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: 'Preveč poskusov. Poskusite znova čez nekaj minut.',
});

authRouter.post(
  '/register',
  attempts,
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
  attempts,
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
    res.clearCookie(SESSION_COOKIE);
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
