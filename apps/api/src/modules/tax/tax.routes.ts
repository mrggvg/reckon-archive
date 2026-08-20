import { Router } from 'express';
import { z } from 'zod';
import { fromCents, toCents } from '@reckon/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { NotFoundError } from '../../lib/AppError.js';
import { validateBody } from '../../middleware/validate.js';
import { validateId } from '../../middleware/validateId.js';
import { profileRepo } from '../profile/profile.repo.js';
import { earningsService } from './earnings.service.js';
import { taxRepo } from './tax.repo.js';
import { taxService } from './tax.service.js';

export const taxRouter = Router();

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum mora biti LLLL-MM-DD');

/** The year in the query, defaulting to this one. */
const yearOf = (req: { query: Record<string, unknown> }) => {
  const raw = Number(req.query.year);
  return Number.isInteger(raw) && raw >= 2000 && raw <= 2100
    ? raw
    : new Date().getFullYear();
};

const todayIso = () => new Date().toISOString().slice(0, 10);

taxRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    res.json(await taxService.summary(req.session.userId!, yearOf(req)));
  }),
);

taxRouter.get(
  '/trajectory',
  asyncHandler(async (req, res) => {
    res.json(await taxService.trajectory(req.session.userId!, yearOf(req)));
  }),
);

taxRouter.get(
  '/contributions',
  asyncHandler(async (req, res) => {
    res.json(await taxService.contributionSchedule(req.session.userId!, yearOf(req)));
  }),
);

/** The accounts and references of the last filing, to save retyping them. */
taxRouter.get(
  '/contributions/last-payment-details',
  asyncHandler(async (req, res) => {
    const row = await taxRepo.latestContribution(req.session.userId!);
    res.json(
      row
        ? {
            piz: { iban: row.piz_iban, reference: row.piz_reference },
            zzDo: { iban: row.zz_do_iban, reference: row.zz_do_reference },
            stv: { iban: row.stv_iban, reference: row.stv_reference },
            zap: { iban: row.zap_iban, reference: row.zap_reference },
          }
        : null,
    );
  }),
);

const account = z.object({
  iban: z.string().trim().max(34),
  reference: z.string().trim().max(30),
});

const contributionInput = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  base: z.number().nonnegative(),
  piz: z.number().nonnegative(),
  zzDo: z.number().nonnegative(),
  stv: z.number().nonnegative(),
  zap: z.number().nonnegative(),
  payment: z
    .object({ piz: account, zzDo: account, stv: account, zap: account })
    .optional(),
});

taxRouter.post(
  '/contributions',
  validateBody(contributionInput),
  asyncHandler(async (req, res) => {
    const c = req.body as z.infer<typeof contributionInput>;
    const blank = { iban: '', reference: '' };
    const pay = c.payment ?? { piz: blank, zzDo: blank, stv: blank, zap: blank };

    const row = await taxRepo.saveContribution(req.session.userId!, {
      period_year: c.year,
      period_month: c.month,
      base_cents: toCents(c.base),
      piz_cents: toCents(c.piz),
      zz_do_cents: toCents(c.zzDo),
      stv_cents: toCents(c.stv),
      zap_cents: toCents(c.zap),
      // The filing's own total, summed from what it states rather than
      // recomputed: if they ever disagree, the filing is right.
      total_cents: toCents(c.piz) + toCents(c.zzDo) + toCents(c.stv) + toCents(c.zap),
      source: 'filed',
      piz_iban: pay.piz.iban,
      piz_reference: pay.piz.reference,
      zz_do_iban: pay.zzDo.iban,
      zz_do_reference: pay.zzDo.reference,
      stv_iban: pay.stv.iban,
      stv_reference: pay.stv.reference,
      zap_iban: pay.zap.iban,
      zap_reference: pay.zap.reference,
    });

    /*
     * The filing is the authority on the insurance base, and the base is what
     * every later estimate is built from. FURS revises it each March and
     * recalculates it from the previous year's profit — neither of which the
     * app can know — so when a filing disagrees with the profile, the filing
     * wins and the profile is corrected.
     */
    const baseUpdated =
      c.base > 0
        ? await profileRepo.syncContributionBase(req.session.userId!, toCents(c.base))
        : null;

    // First filing wins: from here on every estimate can be paid the same way.
    await profileRepo.learnContributionAccounts(req.session.userId!, {
      piz_iban: row.piz_iban,
      piz_reference: row.piz_reference,
      zz_do_iban: row.zz_do_iban,
      zz_do_reference: row.zz_do_reference,
      stv_iban: row.stv_iban,
      stv_reference: row.stv_reference,
      zap_iban: row.zap_iban,
      zap_reference: row.zap_reference,
    });

    res.status(201).json({
      id: row.id,
      year: row.period_year,
      month: row.period_month,
      /** Set when the filing corrected the profile's insurance base. */
      baseUpdated,
    });
  }),
);

taxRouter.delete(
  '/contributions/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    if (!(await taxRepo.deleteContribution(req.session.userId!, req.params.id))) {
      throw new NotFoundError('Obračun ni najden');
    }
    res.status(204).end();
  }),
);

taxRouter.get(
  '/payments',
  asyncHandler(async (req, res) => {
    const rows = await taxRepo.payments(req.session.userId!, yearOf(req));
    res.json(
      rows.map((p) => ({
        id: p.id,
        paidOn: p.paid_on,
        amount: fromCents(p.amount_cents),
        kind: p.kind,
        note: p.note,
        periodYear: p.period_year,
        periodMonth: p.period_month,
        groupKey: p.group_key,
      })),
    );
  }),
);

const paymentInput = z.object({
  paidOn: isoDate,
  amount: z.number().positive('Znesek mora biti večji od 0'),
  kind: z.enum(['contributions', 'income_tax', 'other']),
  note: z.string().trim().max(200).default(''),
  // What it settles. A contributions payment says which month and which of the
  // four groups; income tax says which year.
  periodYear: z.number().int().min(2000).max(2100).nullable().default(null),
  periodMonth: z.number().int().min(1).max(12).nullable().default(null),
  groupKey: z.enum(['piz', 'zz_do', 'stv', 'zap']).nullable().default(null),
});

taxRouter.post(
  '/payments',
  validateBody(paymentInput),
  asyncHandler(async (req, res) => {
    const p = req.body as z.infer<typeof paymentInput>;
    const row = await taxRepo.addPayment(req.session.userId!, {
      paidOn: p.paidOn,
      amountCents: toCents(p.amount),
      kind: p.kind,
      note: p.note,
      periodYear: p.periodYear,
      periodMonth: p.periodMonth,
      groupKey: p.groupKey,
    });
    res.status(201).json({
      id: row.id,
      paidOn: row.paid_on,
      amount: fromCents(row.amount_cents),
      kind: row.kind,
      note: row.note,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      groupKey: row.group_key,
    });
  }),
);

taxRouter.delete(
  '/payments/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    if (!(await taxRepo.deletePayment(req.session.userId!, req.params.id))) {
      throw new NotFoundError('Plačilo ni najdeno');
    }
    res.status(204).end();
  }),
);

const assessmentInput = z.object({
  assessed: z.number().nonnegative(),
  receivedOn: isoDate,
  note: z.string().trim().max(200).default(''),
});

taxRouter.put(
  '/assessments/:year',
  validateBody(assessmentInput),
  asyncHandler<{ year: string }>(async (req, res) => {
    const year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new NotFoundError('Leto ni veljavno');
    }
    const a = req.body as z.infer<typeof assessmentInput>;
    const row = await taxRepo.saveAssessment(req.session.userId!, year, {
      assessedCents: toCents(a.assessed),
      receivedOn: a.receivedOn,
      note: a.note,
    });
    res.json({
      taxYear: row.tax_year,
      assessed: fromCents(row.assessed_cents),
      receivedOn: row.received_on,
      note: row.note,
    });
  }),
);

export const earningsRouter = Router();

earningsRouter.get(
  '/effective-rate',
  asyncHandler(async (req, res) => {
    const basis = req.query.basis === 'service' ? 'service' : 'payment';
    res.json(await earningsService.effectiveRate(req.session.userId!, basis, todayIso()));
  }),
);
