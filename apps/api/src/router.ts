import { Router } from 'express';
import { requireAuth } from './middleware/requireAuth.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { clientsRouter } from './modules/clients/clients.routes.js';

export const router = Router();

// Public: registering and logging in are how you get a session in the first
// place. /auth/me guards itself.
router.use('/auth', authRouter);

// Everything below needs one.
router.use(requireAuth);
router.use('/clients', clientsRouter);
