// oauth2.routes

import { Router } from 'express';
import {
  authorizationEndpoint,
  tokenEndpoint,
  decisionEndpoint,
//  loginForm,
//  loginMethod,
  tokenIntrospectionEndpoint,
} from './oauth2.controller';
import { managementRouter } from './management/management.routes';
import { scopeManagementRouter } from './management/scope-management/scope-management.routes';
import {
  userPermissionRouter,
} from './management/permission-management/permission-management.routes';
import config from '../config';

const router = Router();

// OAuth2 routes
router.get('/authorize', authorizationEndpoint);
router.post('/token', tokenEndpoint);
router.post('/tokeninfo', tokenIntrospectionEndpoint);
router.post('/decision', decisionEndpoint);

// Authentication routes
// router.get('/login', loginForm);
// router.post('/login', loginMethod);

// Management routes
router.use(config.OAUTH_MANAGEMENT_ENDPOINT, managementRouter);

// Scopes management routes
router.use(config.OAUTH_MANAGEMENT_ENDPOINT, scopeManagementRouter);

// User permission management routes
router.use(config.OAUTH_MANAGEMENT_ENDPOINT, userPermissionRouter);

export default router;
