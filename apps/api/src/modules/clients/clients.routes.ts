import { Router } from 'express';
import { z } from 'zod';
import { clientSchema, type ClientInput } from '@reckon/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { validateId } from '../../middleware/validateId.js';
import { clientsService } from './clients.service.js';

export const clientsRouter = Router();

clientsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await clientsService.list(req.session.userId!));
  }),
);

clientsRouter.get(
  '/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(await clientsService.get(req.session.userId!, req.params.id));
  }),
);

clientsRouter.post(
  '/',
  validateBody(clientSchema),
  asyncHandler(async (req, res) => {
    const created = await clientsService.create(
      req.session.userId!,
      req.body as ClientInput,
    );
    res.status(201).json(created);
  }),
);

clientsRouter.put(
  '/:id',
  validateId,
  validateBody(clientSchema),
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(
      await clientsService.update(
        req.session.userId!,
        req.params.id,
        req.body as ClientInput,
      ),
    );
  }),
);

clientsRouter.patch(
  '/:id/active',
  validateId,
  validateBody(z.object({ isActive: z.boolean() })),
  asyncHandler<{ id: string }>(async (req, res) => {
    const { isActive } = req.body as { isActive: boolean };
    res.json(await clientsService.setActive(req.session.userId!, req.params.id, isActive));
  }),
);

clientsRouter.delete(
  '/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(await clientsService.remove(req.session.userId!, req.params.id));
  }),
);
