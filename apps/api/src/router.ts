import { Router } from 'express';
import { requireAuth } from './middleware/requireAuth.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { clientsRouter } from './modules/clients/clients.routes.js';
import { dataRouter } from './modules/data/data.routes.js';
import { invoicesRouter } from './modules/invoices/invoices.routes.js';
import { lookupRouter } from './modules/lookup/lookup.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { sessionsRouter } from './modules/sessions/sessions.routes.js';

export const router = Router();

// Public: registering and logging in are how you get a session in the first
// place. /auth/me guards itself.
router.use('/auth', authRouter);

// Everything below needs one.
router.use(requireAuth);
router.use('/bootstrap', dataRouter);
router.use('/profile', profileRouter);
router.use('/clients', clientsRouter);
router.use('/sessions', sessionsRouter);
router.use('/invoices', invoicesRouter);
router.use('/lookup', lookupRouter);
