// accessToken.model

import { Schema, model } from 'mongoose';
import { collectionName as ClientModelName } from '../client/client.interface';
import { collectionName as ScopeModelName } from '../scope/scope.interface';
import { IAccessToken, collectionName } from './accessToken.interface';
import { clientRefValidator } from '../client/client.validator';
import config from '../config';
import { AccessTokenLimitExceeded, errorMessages } from './accessToken.error';
import { scopeRefValidator } from '../scope/scope.validator';

const accessTokenSchema = new Schema(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: ClientModelName,
      required: true,
      validate: clientRefValidator as any,
    },
    userId: {
      type: String,
    },
    audience: {
      type: String,
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
    scopes: {
      type: [{ type: Schema.Types.ObjectId, ref: ScopeModelName, validate: scopeRefValidator }],
      required: true,
    },
    grantType: {
      type: String,
      enum: (<any>Object).values(config.OAUTH_GRANT_TYPES),
      required: true,
    },
    expireAt: { // Expiration time of token, the token will be deleted from db by the expires value.
      type: Date,
      default: Date.now,
      expires: config.ACCESS_TOKEN_EXPIRATION_TIME,
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  },
);

// Ensures there's only one token for user in specific client app and audience
// accessTokenSchema.index({ clientId: 1, userId: 1, audience: 1 }, { unique: true });

accessTokenSchema.pre<IAccessToken>(
  'save',
  async function (this: IAccessToken, next: any) {

    // Error object for violation of access token limitation
    let error = undefined;

    // Token created for user, should not have limitation
    if (this.userId) {
      next(error);
    } else { // Otherwise, token should have limitation

      // Checking if the client is not in the whitelist (Need to check if it violate the limitation)
      if (config.ACCESS_TOKEN_LIMIT_WHITELIST.indexOf((this.clientId as string).toString()) === -1) {
        const foundTokens = await accessTokenModel.find({
          clientId: this.clientId,
          userId: { $exists: false } ,
          audience: this.audience,
        });
  
        let currentActiveTokensCount = foundTokens.length;
  
        for (const currToken of foundTokens) {
  
          // Checking if the access token is invalid by expiration time,
          // or if theres any other access token with the same value of the currently
          // created access token.
          // Access tokens can have same value only if the requests for the access token
          // performed almost in the same time, in matter of milliseconds.
          // (Because the value of the 'exp' and 'iat' value in the JWT is in seconds)
          // If we allow access token to be saved with the same value, it will violate
          // the unique index on the 'value' key.
  
          if ((currToken.expireAt.getTime() +
              config.ACCESS_TOKEN_EXPIRATION_TIME * 1000 <= Date.now()) ||
              (currToken.value === this.value)) {
            await currToken.remove();
            currentActiveTokensCount -= 1;
          }
        }
  
        if (currentActiveTokensCount >= config.ACCESS_TOKEN_COUNT_LIMIT) {
  
          // Creating this error as MongoError for easy control via mongoose error handler
          error = new AccessTokenLimitExceeded(
            errorMessages.LIMIT_VIOLATION_ACCESS_TOKEN_WITHOUT_USER,
          );
        }
      }
      

      next(error);
    }
  },
);

// Virtual field for audience client validations and population
accessTokenSchema.virtual('audienceClient', {
  ref: ClientModelName,
  localField: 'audience',
  foreignField: 'audienceId',
  justOne: true,
});

/**
 * ############ FOR FUTURE VERSIONS ONLY ############
 * We can decide for each client, how much he want the user to have a token.
 * To do so, we need to modify some things:
 *
 * 1. Set specific TTL for deletion of access token document based on 'expireAt' field.
 *    Uncomment the following code:
 *
 * accessTokenSchema.index(
 *   { expireAt: 1 },
 *   { expireAfterSeconds: config.ACCESS_TOKEN_EXPIRATION_TIME }
 * );
 *
 * 2. At 'expireAt' field of the document, we should remove the 'expires' field (because we already
 *    declared it the index above) and we set the 'expireAt' field for any time we want the document
 *    to be deleted. (Maybe querying about the client document associate to that token and set the
 *    time according to its configuration [Maybe field inside client documents, which indicates the
 *    token TTL for each user])
 *    BIG NOTE: We can specify range limit of the 'expireAt' field for not allowing user to create
 *              infinite token. (setting expireAfterSeconds to minimum field value, and somehow
 *              validate the 'expireAt' field to not exceed the current time plus maximum constant
 *              time for token. [expireAt <= Date.now() + ACCESS_TOKEN_MAX_TIME])
 *
 * 3. Update the refresh token model to expire after the expiration time of the access token
 *    associated to it and add constant time for it (The expiration time of the refresh token
 *    could be set by the oauth2.controller file inside the authorization code exchange method)
 */

const accessTokenModel = model<IAccessToken>(collectionName, accessTokenSchema);

export default accessTokenModel;
