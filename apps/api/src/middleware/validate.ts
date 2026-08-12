import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { ValidationError } from '../lib/AppError.js';

/**
 * Parses and replaces req.body with the validated value, so handlers downstream
 * work with typed, trimmed data instead of whatever arrived.
 */
export const validateBody =
  <T>(schema: ZodType<T>): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || 'body';
        fields[key] ??= issue.message;
      }
      next(new ValidationError(fields));
      return;
    }
    req.body = result.data;
    next();
  };
