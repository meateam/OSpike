// management.error

import { NotFound, BadRequest, BaseError } from '../../utils/error';

export class ClientNotFound extends NotFound {
  constructor(message?: string) {
    super(message || 'Client not found');
  }
}

export class BadClientInformation extends BadRequest {
  constructor(message?: string) {
    super(message || 'Invalid client information given');
  }
}

export class PassportClientManagementError extends BaseError {
  constructor(message?: string, status?: number) {
    super(message || 'Unauthorized', status || 401);
  }
}
