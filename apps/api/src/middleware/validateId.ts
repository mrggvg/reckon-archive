import type { RequestHandler } from 'express';
import { UUID_PATTERN } from '@reckon/shared';
import { NotFoundError } from '../lib/AppError.js';

/**
 * Refuses a path id that isn't a uuid at all.
 *
 * Without this the malformed value reaches Postgres, which raises a type error
 * the handler can't tell apart from a real fault — a client's typo would be
 * reported as a server failure. A record that can't exist simply isn't found.
 */
export const validateId: RequestHandler<{ id: string }> = (req, _res, next) => {
  if (!UUID_PATTERN.test(req.params.id)) {
    next(new NotFoundError());
    return;
  }
  next();
};
