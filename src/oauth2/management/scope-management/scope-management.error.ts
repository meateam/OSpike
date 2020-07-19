// scope-management.error

import { BadRequest, NotFound } from '../../../utils/error';

export class InvalidScopeInformation extends BadRequest {
  constructor(message?: string) {
    super(message || 'Invalid scope information given.');
  }
}

export class ScopeNotFound extends NotFound {
  constructor(message?: string) {
    super(message || 'Scope not found.');
  }
}
