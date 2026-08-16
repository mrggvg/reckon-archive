import { Router } from 'express';
import { sessionInputSchema, type SessionInput } from '@reckon/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { validateId } from '../../middleware/validateId.js';
import { sessionsService } from './sessions.service.js';

export const sessionsRouter = Router();

sessionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await sessionsService.list(req.session.userId!));
  }),
);

sessionsRouter.post(
  '/',
  validateBody(sessionInputSchema),
  asyncHandler(async (req, res) => {
    const created = await sessionsService.create(
      req.session.userId!,
      req.body as SessionInput,
    );
    res.status(201).json(created);
  }),
);

sessionsRouter.put(
  '/:id',
  validateId,
  validateBody(sessionInputSchema),
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(
      await sessionsService.update(
        req.session.userId!,
        req.params.id,
        req.body as SessionInput,
      ),
    );
  }),
);

sessionsRouter.delete(
  '/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    await sessionsService.remove(req.session.userId!, req.params.id);
    res.status(204).end();
  }),
);
