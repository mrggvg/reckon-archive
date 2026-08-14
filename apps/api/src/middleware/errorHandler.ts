import type { ErrorRequestHandler } from 'express';
import { AppError } from '../lib/AppError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, fields: err.fields });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Napaka na strežniku' });
};
