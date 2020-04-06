// authCode.model

import { Schema, model } from 'mongoose';
import {
  IClient,
  collectionName as ClientModelName,
} from '../client/client.interface';
import { IAuthCode, collectionName } from './authCode.interface';
import { BadRedirectUri } from './authCode.error';
import { collectionName as ScopeModelName } from '../scope/scope.interface';
import { scopeRefValidator } from '../scope/scope.validator';
import config from '../config';

const authCodeSchema = new Schema({
  value: {
    type: String,
    unique: true,
    required: true,
  },
  clientId: {
    type: String,
    ref: ClientModelName,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  userProperties: {
    type: Object,
    required: true,
  },
  audience: {
    type: String,
    required: true,
  },
  redirectUri: {
    type: String,
    required: true,
  },
  scopes: {
    type: [{ type: Schema.Types.ObjectId, ref: ScopeModelName, validate: scopeRefValidator }],
    required: true,
  },
  expireAt: {
    type: Date,
    default: Date.now,
    expires: config.AUTH_CODE_EXPIRATION_TIME,
  },
});

// Construct better error handling for errors from mongo server
authCodeSchema.post('save', (err, doc, next) => {
  if (err.name === 'MongoError' && err.code === 11000) {
    err.message = `There's already authorization code for the client and user for that audience.`;
  }

  next(err);
});

// Checking if redirectUri specified is in the redirect uris of the client model
authCodeSchema.pre<IAuthCode>('validate', async function () {
  const clientModel = await model<IClient>(ClientModelName).findOne({ id: this.clientId });
  if (clientModel && clientModel.isValidRedirectUri(this.redirectUri)) {
    throw new BadRedirectUri();
  }
});

const authCodeModel = model<IAuthCode>(collectionName, authCodeSchema);

export default authCodeModel;
