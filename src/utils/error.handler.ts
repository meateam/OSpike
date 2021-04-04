// error.handler

import { Request, Response, NextFunction } from 'express';
import { BaseError } from './error';
import { MongooseErrorHandler } from './error.handler.mongoose';
import { LOG_LEVEL, log, parseLogData } from './logger';

// TODO: Error type correction
export function errorHandler(error: any, req: Request, res: Response, next: NextFunction) {
  let clientId;

  if (req.body && req.body.clientId) {
    clientId = req.body.clientId;
  } else if (req.query && req.query.client_id) {
    clientId = req.query.client_id;
  } else if (req.headers['authorization']) {
    try {
      let decode = req.headers['authorization'];

      if (decode && decode.indexOf('Basic') !== -1) {
          decode = decode.replace('Basic ', '');
      }

      decode = Buffer.from(decode as any, 'base64').toString();

      if (decode && decode.indexOf(':') !== -1) {
        clientId = decode.split(':')[0];
      }
    } catch (err) {
      console.log(err);
    }
  }
  
  // Authentication error caused by passport strategy
  if (error.name === 'AuthenticationError') {
    log(
      LOG_LEVEL.WARN,
      parseLogData(
        'Authentication Error',
        `Received From: ${req.headers['x-forwarded-for']
         }, ${ req.session ?
               req.session.messages[req.session.messages.length - 1] :
               error.name + ': ' + error.message || 'Unknown error'}`,
        error.status,
        error.stack,
        clientId
      ),
    );
    return res.status(error.status).send({
      message: req.session ? req.session.messages[req.session.messages.length - 1] : error.name,
    });
  }

  if (error instanceof BaseError) {
    log(
      LOG_LEVEL.WARN,
      parseLogData(
        error.name,
        `Received From: ${req.headers['x-forwarded-for']}, message: ${error.message}`,
        error.status,
        error.stack,
        clientId
      ),
    );
    return res.status(error.status).send({ message: error.message });
  }

  if (MongooseErrorHandler.instanceOf(error)) {
    const errorDetails = MongooseErrorHandler.parseError(error);

    log(
      LOG_LEVEL.WARN,
      parseLogData(
        error.name || 'Mongoose Error',
        `Received From: ${req.headers['x-forwarded-for']
         }, message: ${errorDetails.message || error.message || error}`,
        errorDetails.status.toString(),
        error.stack,
        clientId
      ),
    );

    return res.status(errorDetails.status).send({ message: errorDetails.message });
  }

  log(
    LOG_LEVEL.ERROR,
    parseLogData(
      error.name || 'Internal Unknown Error',
      `Received From: ${req.headers['x-forwarded-for']}, message: ${error.message || error}`,
      error.status || 500,
      error.stack,
      clientId
    ),
  );

  // Other errors
  return res.status(error.status || 500)
            .send({ message: error.message || 'Internal Server Error' });
}
