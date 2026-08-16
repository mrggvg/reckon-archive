import { ApiError } from './api';

/**
 * What to tell the user when a request didn't go through.
 *
 * The server's own message is preferred — it knows whether the hours were
 * already billed or the number was taken — and anything else falls back to
 * something honest about the connection rather than a shrug.
 */
export function failureMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Shranjevanje ni uspelo. Poskusite znova.';
}
