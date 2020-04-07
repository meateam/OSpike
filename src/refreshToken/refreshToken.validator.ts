// refreshToken.validator

import { refValidator } from '../generic/generic.validator';
import { collectionName } from './refreshToken.interface';

// Refresh Token reference validator
export const refreshTokenRefValidator = [
  refValidator.bind({}, collectionName, '_id'),
  `Reference Error - ${collectionName} {VALUE} does not exist`,
];
