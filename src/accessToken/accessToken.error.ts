// accessToken.error

import { BadRequest } from '../utils/error';
import config from '../config';

export class AccessTokenLimitExceeded extends BadRequest {
  constructor(message?: string) {
    super(
      message ||
      'Access Token Limit Exceeded - You have reached the limit of generated tokens per client',
    );
  }
}

export const errorMessages = {
  DUPLICATE_ACCESS_TOKEN: `There's already token for the client and the user and the audience.`,
  DUPLICATE_ACCESS_TOKEN_WITHOUT_USER: `There's already token for the client and the audience.`,
  LIMIT_VIOLATION_ACCESS_TOKEN:
    `Access Token LIMIT Exceeded - There's already ${config.ACCESS_TOKEN_COUNT_LIMIT}${''
    } tokens for the client and the user and the audience.`,
  LIMIT_VIOLATION_ACCESS_TOKEN_WITHOUT_USER:
    `Access Token LIMIT Exceeded - There's already ${config.ACCESS_TOKEN_COUNT_LIMIT}${''
    } tokens for the client and the audience.`,
};
