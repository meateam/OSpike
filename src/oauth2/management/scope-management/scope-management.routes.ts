// scope-management.routes

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import config from '../../../config';
import { ScopeManagementController } from './scope-management.controller';
import { Wrapper } from '../../../utils/wrapper';
import { InvalidScopeInformation, ScopeNotFound } from './scope-management.error';
import { LOG_LEVEL, log, parseLogData } from '../../../utils/logger';

/**
 * Authentication middlewares for restricting routes.
 *
 * The first restrict only the client manager.
 * The seconds restrict the client manager and also the registration token of the client.
 */
const authenticateMiddleware =
  function (req: Request, res: Response, next: NextFunction) {
    const passportCallback = Wrapper.wrapPassportCallback(req, res, next);
    return (
      passport.authenticate(
        config.CLIENT_MANAGER_PASSPORT_STRATEGY,
        { session: false, failWithError: true, failureMessage: true },
        passportCallback,
      )(req, res, next)
    );
  };

const authenticateManagementMiddleware =
  function (req: Request, res: Response, next: NextFunction) {
    const passportCallback = Wrapper.wrapPassportCallback(req, res, next);
    return (
      passport.authenticate(
        config.CLIENT_MANAGER_PASSPORT_MANAGEMENT_STRATEGY,
        { session: false, failWithError: true, failureMessage: true },
        passportCallback,
      )(req, res, next)
    );
  };

export const errorMessages = {
  MISSING_SCOPE_INFORMATION: 'Scope information parameter is missing',
  MISSING_SCOPE_ID: 'Scope id request parameter is missing',
  MISSING_SCOPE_ID_OR_INFORMATION: 'Scope id or scope information parameter is missing',
  MISSING_SCOPES_FILTER: `Missing 'clientId' or 'audienceId' parameter to filter scopes`,
  NOT_FOUND_SCOPE: 'Scope not found',
  NOT_FOUND_SCOPES: 'Scopes for that client id / audience are not found',
};

export const scopeManagementRouter = Router();

// Create scope endpoint
scopeManagementRouter.post(
  config.OAUTH_MANAGEMENT_SCOPE_ENDPOINT,
  authenticateManagementMiddleware,
  Wrapper.wrapAsync(async (req: Request, res: Response) => {

    // If the request contains the scope information and the scope
    // information used for creating a scope to the requester only
    // TODO: Need to check if the requester create scope to himself only
    if (req.body.scopeInformation) {
      const createdScope = await ScopeManagementController.createScope(req.body.scopeInformation);

      log(
        LOG_LEVEL.INFO,
        parseLogData(
          'Scope Management Router',
          `Received from ${req.headers['x-forwarded-for']}, Operation - Create Scope. ${'\r\n'
            } Scope information: ${JSON.stringify(req.body.scopeInformation)}`,
          201,
          null,
        ),
      );

      return res.status(201).send(createdScope);
    }

    log(
      LOG_LEVEL.INFO,
      parseLogData(
        'Scope Management Router',
        `Received from ${req.headers['x-forwarded-for']}, Operation - Create scope. ${'\r\n'
          }Results: Missing scope information`,
        400,
        null,
      ),
    );

    throw new InvalidScopeInformation(errorMessages.MISSING_SCOPE_INFORMATION);
  },
));

// Get specific scope information endpoint
scopeManagementRouter.get(
  `${config.OAUTH_MANAGEMENT_SCOPE_ENDPOINT}/:scopeId`,
  authenticateMiddleware,
  Wrapper.wrapAsync(async (req: Request, res: Response) => {

    // If the request contains the scope id
    if (req.params.scopeId) {
      const scopeInformation = await ScopeManagementController.getScopeById(req.params.scopeId);

      log(
        LOG_LEVEL.INFO,
        parseLogData(
          'Scope Management Router',
          `Received from ${req.headers['x-forwarded-for']}, Operation - Read scope. ${'\r\n'
            } Scope Id: ${req.params.clientId}`,
          200,
          null,
        ),
      );

      // If scope not found
      if (!scopeInformation) {
        throw new ScopeNotFound(errorMessages.NOT_FOUND_SCOPE);
      }

      return res.status(200).send(scopeInformation);
    }

    log(
      LOG_LEVEL.INFO,
      parseLogData(
        'Scope Management Router',
        `Received from ${req.headers['x-forwarded-for']}, Operation - Read scope. ${'\r\n'
          }Results: Missing scope id`,
        400,
        null,
      ),
    );

    throw new InvalidScopeInformation(errorMessages.MISSING_SCOPE_ID);
  },
));

// Get scopes information endpoint
scopeManagementRouter.get(
  `${config.OAUTH_MANAGEMENT_SCOPE_ENDPOINT}`,
  authenticateMiddleware,
  Wrapper.wrapAsync(async (req: Request, res: Response) => {

    // If the request contains client id or audience id to filter scopes by
    if (req.params.clientId || req.params.audienceId) {

      let requestedScopes = [];

      if (req.params.clientId) {
        requestedScopes =
          await ScopeManagementController.getScopesByClientId(req.params.clientId);
      } else {
        requestedScopes =
          await ScopeManagementController.getScopesByAudienceId(req.params.audienceId);
      }

      // If scopes not found
      if (requestedScopes.length === 0) {
        throw new ScopeNotFound(errorMessages.NOT_FOUND_SCOPES);
      }

      log(
        LOG_LEVEL.INFO,
        parseLogData(
          'Scope Management Router',
          `Received from ${req.headers['x-forwarded-for']}, Operation - Read scope. ${'\r\n'
            } Scope Id: ${req.params.clientId}`,
          200,
          null,
        ),
      );

      return res.status(200).send(requestedScopes);
    }

    log(
      LOG_LEVEL.INFO,
      parseLogData(
        'Scope Management Router',
        `Received from ${req.headers['x-forwarded-for']}, Operation - Read scope. ${'\r\n'
          }Results: Missing client id or audience id`,
        400,
        null,
      ),
    );

    throw new InvalidScopeInformation(errorMessages.MISSING_SCOPES_FILTER);
  },
));

// Update scope information endpoint
scopeManagementRouter.put(
  `${config.OAUTH_MANAGEMENT_ENDPOINT}/:scopeId`,
  authenticateManagementMiddleware,
  Wrapper.wrapAsync(async (req: Request, res: Response) => {

    // If the request contains the scope id and update scope information
    // also if the requester updating scopes that belongs to him onlu
    // TODO: Need to check if the reuqester updating scope belong to him
    if (req.params.scopeId && req.body.scopeInformation) {
      const updatedScope = await ScopeManagementController.updateScope(
        req.params.scopeId,
        req.body.scopeInformation,
      );

      log(
        LOG_LEVEL.INFO,
        parseLogData(
          'Scope Management Router',
          `Received from ${req.headers['x-forwarded-for']}, Operation - Update scope. ${'\r\n'
            }Scope Id: ${req.params.scopeId} ${'\r\n'
            }New Scope information: ${req.body.scopeInformation}`,
          200,
          null,
        ),
      );

      // If the scope not found in the first place
      if (!updatedScope) {
        throw new ScopeNotFound(errorMessages.NOT_FOUND_SCOPE);
      }

      return res.status(200).send(updatedScope);
    }

    log(
      LOG_LEVEL.INFO,
      parseLogData(
        'Scope Management Router',
        `Received from ${req.headers['x-forwarded-for']}, Operation - Update scope. ${'\r\n'
          }Results: Missing scope id or information`,
        400,
        null,
      ),
    );

    throw new InvalidScopeInformation(errorMessages.MISSING_SCOPE_ID_OR_INFORMATION);
  },
));

// Delete scope endpoint
scopeManagementRouter.delete(
  `${config.OAUTH_MANAGEMENT_ENDPOINT}/:scopeId`,
  authenticateManagementMiddleware,
  Wrapper.wrapAsync(async (req: Request, res: Response) => {

    // If the request contains the scope id
    if (req.params.scopeId) {

      // If the deletion succeed
      if (await ScopeManagementController.deleteScope(req.params.scopeId)) {

        log(
          LOG_LEVEL.INFO,
          parseLogData(
            'Scope Management Router',
            `Received from ${req.headers['x-forwarded-for']}, Operation - Delete scope. ${'\r\n'
              } Scope Id: ${req.params.scopeId}`,
            204,
            null,
          ),
        );

        return res.sendStatus(204);
      }

      log(
        LOG_LEVEL.ERROR,
        parseLogData(
          'Scope Management Router',
          `Unknown Error: Received from ${req.headers['x-forwarded-for']
            }, Operation - Delete scope. ${'\r\n'} Scope Id: ${req.params.scopeId}`,
          500,
          null,
        ),
      );

      // Somehow the deletion failed
      return res.status(500).send('Internal Server Error');
    }

    log(
      LOG_LEVEL.INFO,
      parseLogData(
        'Scope Management Router',
        `Received from ${req.headers['x-forwarded-for']}, Operation - Delete scope. ${'\r\n'
          }Results: Missing scope id`,
        400,
        null,
      ),
    );

    throw new InvalidScopeInformation(errorMessages.MISSING_SCOPE_ID);
  },
));
