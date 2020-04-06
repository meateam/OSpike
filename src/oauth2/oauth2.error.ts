// oauth2.error

import { Unauthorized } from '../utils/error';

export class InsufficientScopes extends Unauthorized {
  constructor(message?: string) {
    super(message || 'Insufficient Scopes Requested');
  }
}

export const errorMessages = {
  MISSING_AUDIENCE: 'The audience parameter is missing.',
  MISSING_SCOPE_IN_CLIENT: `Client doesn't support client_credentials due incomplete scopes value.`,
  MISSING_SCOPE: 'The scope parameter is missing.',
  INSUFFICIENT_SCOPE_FOR_CLIENT: `The client doesn't have permission for the requested scopes.`,
};
