import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';

// Generic in the route params so `/:id` handlers keep their inferred param types
// instead of collapsing to an index signature.
export const asyncHandler =
  <P = ParamsDictionary, ResBody = unknown, ReqBody = unknown, ReqQuery = Query>(
    fn: (
      req: Request<P, ResBody, ReqBody, ReqQuery>,
      res: Response<ResBody>,
      next: NextFunction,
    ) => Promise<unknown>,
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery> =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
