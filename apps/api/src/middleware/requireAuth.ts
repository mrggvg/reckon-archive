import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../lib/AppError.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    next(new UnauthorizedError());
    return;
  }
  next();
};
