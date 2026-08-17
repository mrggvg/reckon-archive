import { Router } from 'express';
import {
  profileSchema,
  taxProfileSchema,
  type ProfileInput,
  type TaxProfileInput,
} from '@reckon/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { profileService } from './profile.service.js';

export const profileRouter = Router();

profileRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await profileService.get(req.session.userId!));
  }),
);

profileRouter.get(
  '/tax',
  asyncHandler(async (req, res) => {
    res.json(await profileService.getTax(req.session.userId!));
  }),
);

profileRouter.put(
  '/tax',
  validateBody(taxProfileSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await profileService.saveTax(req.session.userId!, req.body as TaxProfileInput),
    );
  }),
);

profileRouter.put(
  '/',
  validateBody(profileSchema),
  asyncHandler(async (req, res) => {
    res.json(await profileService.save(req.session.userId!, req.body as ProfileInput));
  }),
);
