import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { lookupService } from './lookup.service.js';

export const lookupRouter = Router();

// Each call is an outbound request made on our behalf to somebody else's
// service; a stuck key on a form shouldn't be able to hammer it.
const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Preveč poizvedb v register. Poskusite čez minuto.',
});

lookupRouter.get(
  '/company',
  limit,
  asyncHandler(async (req, res) => {
    const taxNumber = String(req.query.taxNumber ?? '');
    res.json(await lookupService.company(taxNumber));
  }),
);
