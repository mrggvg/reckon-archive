import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { dataService, restoreSchema, type RestoreInput } from './data.service.js';
import { clientsService } from '../clients/clients.service.js';
import { invoicesService } from '../invoices/invoices.service.js';
import { profileService } from '../profile/profile.service.js';
import { sessionsService } from '../sessions/sessions.service.js';

export const dataRouter = Router();

/**
 * The whole ledger in one request.
 *
 * The interface works from the complete dataset — calendars, running totals and
 * the unbilled-hours picker all read across every record — so one round trip on
 * load beats four, and at the scale of one freelancer's years of work the
 * payload is small.
 */
dataRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const [profile, clients, sessions, invoices] = await Promise.all([
      profileService.get(userId),
      clientsService.list(userId),
      sessionsService.list(userId),
      invoicesService.list(userId),
    ]);
    res.json({ profile, clients, sessions, invoices });
  }),
);

/**
 * Replaces the whole ledger from a backup file, in one transaction.
 *
 * Restoring is destructive by definition, so it is all-or-nothing: either the
 * backup lands complete or the account is left exactly as it was. Identifiers
 * from the file are not reused — rows are inserted fresh and the links between
 * them remapped — because a backup taken from another account would otherwise
 * carry that account's keys into this one.
 */
dataRouter.post(
  '/restore',
  validateBody(restoreSchema),
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    await dataService.restore(userId, req.body as RestoreInput);

    const [profile, clients, sessions, invoices] = await Promise.all([
      profileService.get(userId),
      clientsService.list(userId),
      sessionsService.list(userId),
      invoicesService.list(userId),
    ]);
    res.json({ profile, clients, sessions, invoices });
  }),
);
