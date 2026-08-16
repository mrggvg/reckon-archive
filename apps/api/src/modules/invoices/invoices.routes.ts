import { Router } from 'express';
import {
  invoiceEditSchema,
  invoiceGenerateSchema,
  invoiceImportSchema,
  invoicePaymentSchema,
  type InvoiceEditInput,
  type InvoiceGenerateInput,
  type InvoiceImportInput,
  type InvoicePaymentInput,
} from '@reckon/shared';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { validateId } from '../../middleware/validateId.js';
import { invoicesService } from './invoices.service.js';

export const invoicesRouter = Router();

invoicesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await invoicesService.list(req.session.userId!));
  }),
);

invoicesRouter.get(
  '/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(await invoicesService.get(req.session.userId!, req.params.id));
  }),
);

invoicesRouter.post(
  '/',
  validateBody(invoiceGenerateSchema),
  asyncHandler(async (req, res) => {
    const created = await invoicesService.generate(
      req.session.userId!,
      req.body as InvoiceGenerateInput,
    );
    res.status(201).json(created);
  }),
);

invoicesRouter.post(
  '/import',
  validateBody(invoiceImportSchema),
  asyncHandler(async (req, res) => {
    const created = await invoicesService.import(
      req.session.userId!,
      req.body as InvoiceImportInput,
    );
    res.status(201).json(created);
  }),
);

invoicesRouter.patch(
  '/:id',
  validateId,
  validateBody(invoiceEditSchema),
  asyncHandler<{ id: string }>(async (req, res) => {
    res.json(
      await invoicesService.update(
        req.session.userId!,
        req.params.id,
        req.body as InvoiceEditInput,
      ),
    );
  }),
);

invoicesRouter.patch(
  '/:id/payment',
  validateId,
  validateBody(invoicePaymentSchema),
  asyncHandler<{ id: string }>(async (req, res) => {
    const { paid, paidDate } = req.body as InvoicePaymentInput;
    res.json(
      await invoicesService.setPayment(req.session.userId!, req.params.id, paid, paidDate),
    );
  }),
);

invoicesRouter.delete(
  '/:id',
  validateId,
  asyncHandler<{ id: string }>(async (req, res) => {
    await invoicesService.remove(req.session.userId!, req.params.id);
    res.status(204).end();
  }),
);
