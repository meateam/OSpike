 // authCode.error

import { BadRequest } from '../utils/error';

export class BadRedirectUri extends BadRequest {
  constructor(message?: string) {
    super(
      message ||
      'Reference Error - RedirectUri doesn\'t exists in client model',
    );
  }
}
