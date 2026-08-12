import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
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
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(await clientsService.get(req.session.userId!, req.params.id));
  }),
);
