import { Router } from 'express';
import { requireAuth } from './middleware/requireAuth.js';
import { clientsRouter } from './modules/clients/clients.routes.js';

export const router = Router();

router.use(requireAuth);
router.use('/clients', clientsRouter);
