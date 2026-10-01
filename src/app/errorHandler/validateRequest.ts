import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

type ValidationSchema = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

const validateRequest = (schemas: ValidationSchema): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }

      if (schemas.params) {
        const parsedParams = schemas.params.parse(req.params);
        Object.assign(req.params, parsedParams); // params is a normal object, mutation is fine here
      }

      if (schemas.query) {
        const parsedQuery = schemas.query.parse(req.query);

        // Express 5: req.query is a live getter recomputed from the URL on
        // every access — mutating the object you get back is thrown away
        // the instant you read req.query again. Redefine the property itself
        // instead so the coerced values (numbers/booleans/defaults) stick.
        Object.defineProperty(req, "query", {
          value: parsedQuery,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export default validateRequest;