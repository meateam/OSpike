// wrapper

import { Response, Request, NextFunction } from 'express';
import { Unauthorized, BaseError } from './error';
import { PassportClientManagementError } from '../oauth2/management/management.error';

export class Wrapper {

  /**
   * Creates an async wrap for a given function.
   * @param func - Any function.
   */
  static wrapAsync(func: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      func(req, res, next).catch((err: Error) => next(err));
    };
  }

  /**
   * Creates wrapper function for passport authenticate callback function
   * @param req - Request object
   * @param res - Response object
   * @param next - Next function
   */
  static wrapPassportCallback(req: Request, res: Response, next: NextFunction) {
    return function (error: any, user: any, errorBody: any, status: any) {

      // Self implemented strategy case - got error from client manager strategy
      if (typeof errorBody === 'object' && errorBody.message && typeof status === 'number') {
        return next(new PassportClientManagementError(errorBody.message, status));
      }

      if (error) {
        return next(error instanceof BaseError ? error : new Unauthorized());
      }

      if (!user) {
        return next(new Unauthorized());
      }

      req.user = user;
      next();
    };
  }
}
