// oauth2.routes.spec

import { expect } from 'chai';
import { default as request } from 'supertest';
import app from '../app';
import config from '../config';
import { dismantleNestedProperties, objWithoutKeys } from '../utils/objectUtils';
import { deleteCollections } from '../test';
import accessTokenModel from '../accessToken/accessToken.model';
import { errorMessages as tokenErrorMessages } from '../accessToken/accessToken.error';
import clientModel from '../client/client.model';
import refreshTokenModel from '../refreshToken/refreshToken.model';
import { IClient } from '../client/client.interface';
import { OAuth2Utils, JWTPayload } from './oauth2.utils';
import { refreshTokenValueGenerator } from '../utils/valueGenerator';
import { IAccessToken } from '../accessToken/accessToken.interface';
import scopeModel from '../scope/scope.model';
import { IScope } from '../scope/scope.interface';
// import userModel from '../user/user.model';
import { errorMessages } from './oauth2.error';
import { IRefreshToken } from '../refreshToken/refreshToken.interface';

// Utility functions for the tests
function createAuthorizationParameters(responseType: string,
                                       clientId: string,
                                       redirectUri: string,
                                       scopes: string,
                                       state: string,
                                       audience: string) {
  return {
    ...(state ? { state } : null),
    ...(audience ? { audience } : null),
    ...(responseType ? { response_type: responseType } : null),
    ...(clientId ? { client_id: clientId } : null),
    ...(redirectUri ? { redirect_uri: redirectUri } : null),
    ...(scopes ? { scope: scopes } : null),
  };
}

function createTokenParameters(grantType?: string,
                               audience?: string,
                               scopes?: string,
                               username?: string,
                               password?: string) {
  return {
    ...(audience ? { audience } : null),
    ...(grantType ? { grant_type: grantType } : null),
    ...(scopes ? { scope: scopes } : null),
    ...(username ? { username } : null),
    ...(password ? { password } : null),
  };
}

function createRefreshTokenParameters(refreshToken?: string, scope?: string) {

  return {
    grant_type: 'refresh_token',
    ...(refreshToken ? { refresh_token: refreshToken } : null),
    ...(scope ? { scope } : null),
  };
}

/**
 * Create HTTP Basic Authentication string for authorization header
 * @param clientId - Id of the client
 * @param clientSecret - Secret of the client
 */
function createAuthorizationHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

interface ITokenOptions {
  aud?: string;
  scope?: string[] | string;
  sub?: string;
}

interface ITokenClaims extends Required<ITokenOptions> {
  clientId: string;
  iat: number;
  exp: number;
  iss: string;
}

enum GrantType { CODE, IMPLICIT, CLIENT_CREDENTIALS, PASSWORD, REFRESH_TOKEN }

function checkTokenResponseValidity(grantType: GrantType,
                                    response: request.Response,
                                    client: IClient,
                                    tokenOptions: ITokenOptions) {
  const responseBodyTemplate = ['access_token', 'refresh_token', 'expires_in', 'token_type'];
  let accessToken: JWTPayload;

  switch (grantType) {

    // Checking Authorization Code Flow
    case (GrantType.CODE):
      break;

    // Checking Implicit Flow
    case (GrantType.IMPLICIT):
      break;

    // Checking Client Credentials Flow
    case (GrantType.CLIENT_CREDENTIALS):
      expect(response).to.have.property('status', 200);
      responseBodyTemplate.splice(1, 1);
      expect(response.body).to.have.all.keys(responseBodyTemplate);

      accessToken = OAuth2Utils.stripJWTAccessToken(response.body.access_token) as JWTPayload;

      expect(accessToken).to.nested.include({
        iss: config.issuerHostUri,
        clientId: client.id,
        sub: client.id.toString(),
        iat: accessToken.exp - config.ACCESS_TOKEN_EXPIRATION_TIME,
        exp: accessToken.iat + config.ACCESS_TOKEN_EXPIRATION_TIME,
        ...dismantleNestedProperties(null, tokenOptions),
      });
      break;

    // Checking Resource Owner Password Credentials Flow
    case (GrantType.PASSWORD):
      expect(response).to.have.property('status', 200);
      expect(response.body).to.have.all.keys(responseBodyTemplate);

      accessToken = OAuth2Utils.stripJWTAccessToken(response.body.access_token) as JWTPayload;

      expect(accessToken).to.nested.include({
        iss: config.issuerHostUri,
        clientId: client.id,
        iat: accessToken.exp - config.ACCESS_TOKEN_EXPIRATION_TIME,
        exp: accessToken.iat + config.ACCESS_TOKEN_EXPIRATION_TIME,
        ...dismantleNestedProperties(null, tokenOptions),
      });
      break;

    // Checking Refresh Token Flow
    case (GrantType.REFRESH_TOKEN):
      expect(response).to.have.property('status', 200);
      expect(response.body).to.have.all.keys(responseBodyTemplate);

      accessToken = OAuth2Utils.stripJWTAccessToken(response.body.access_token) as JWTPayload;

      expect(accessToken).to.nested.include({
        iss: config.issuerHostUri,
        clientId: client.id,
        iat: accessToken.exp - config.ACCESS_TOKEN_EXPIRATION_TIME,
        exp: accessToken.iat + config.ACCESS_TOKEN_EXPIRATION_TIME,
        ...dismantleNestedProperties(null, tokenOptions),
      });
      break;

    default:
      break;
  }
}

/**
 * Checks token introspection request validity
 * @param response - The response to check token introspection validity.
 * @param token - The access token to validate values appropriate to the response given.
 *                If not given at all, refers it like it was unexisted/inactive token.
 */
function checkTokenIntrospection(response: request.Response, token?: IAccessToken) {

  let payload = token ? OAuth2Utils.stripJWTAccessToken(token.value) as object : {};
  if ((<any>payload).scope) {
    (<any>payload).scope.forEach(
      (scope: any, index: number) => {
        (<any>payload)[`scope[${index}].value`] = scope;
        (<any>payload)[`scope[${index}].description`] = 'No description provided';
      },
    );

    payload = objWithoutKeys(payload, ['scope']);
  }

  expect(response).to.nested.include({
    status: 200,
    ...dismantleNestedProperties(
      'body',
      {
        active: !!token,
        ...(token ?
          {
            clientId: token.clientId,
            ...(token.userId && typeof token.userId === 'object' ?
                { userId: token.userId } : null),
            ...payload,
          } : {}
        ),

      },
    ),
  });
}

describe('OAuth2 Flows Functionality', () => {

  // Routes for the flows
  const AUTH_CODE_ENDPOINT = `${config.OAUTH_ENDPOINT}${config.OAUTH_AUTHORIZATION_ENDPOINT}`;
  const TOKEN_ENDPOINT = `${config.OAUTH_ENDPOINT}${config.OAUTH_TOKEN_ENDPOINT}`;
  const LOGIN_ENDPOINT = `${config.OAUTH_ENDPOINT}${config.OAUTH_USER_LOGIN_ENDPOINT}`;
  const DECISION_ENDPOINT = `${config.OAUTH_ENDPOINT}${config.OAUTH_TOKEN_USER_CONSENT_ENDPOINT}`;
  const TOKEN_INTROSPECTION_ENDPOINT =
    `${config.OAUTH_ENDPOINT}${config.OAUTH_TOKEN_INTROSPECTION_ENDPOINT}`;

  let registeredClient = new clientModel({
    id: 'registeredClientId',
    secret: 'registeredClientSecret',
    audienceId: 'registeredClientAudienceId',
    registrationToken: 'registeredClientRegistrationTokenBlaBla',
    name: 'registeredClient',
    hostUris: ['https://registeredClient.register.com'],
    redirectUris: ['/callback'],
  });

  let registeredClient2 = new clientModel({
    id: 'registeredClientId2',
    secret: 'registeredClientSecert2',
    audienceId: 'registeredClientAudienceId2',
    registrationToken: 'registreredClientRegistrationTokebBlaBla2',
    name: 'registeredClient2',
    hostUris: ['https://registeredClient2.register.com'],
    redirectUris: ['/callback2'],
  });

  let registeredClient3 = new clientModel({
    id: 'registeredClientId3',
    secret: 'registeredClientSecert3',
    audienceId: 'registeredClientAudienceId3',
    registrationToken: 'registreredClientRegistrationTokebBlaBla3',
    name: 'registeredClient3',
    hostUris: ['https://registeredClient3.register.com'],
    redirectUris: ['/callback3'],
  });

  /**
   * Each scope belongs to client X [1/2/3] and contains the next client
   * as the scope permitted client [1->2] [2->3] [3->1]
   * client 1 has access also to scope of client 2
   */
  let scopeOfClient1: IScope | null = null;
  let scopeOfClient2: IScope | null = null;
  let scopeOfClient3: IScope | null = null;
  let anotherScopeOfClient1: IScope | null = null;

  before(async () => {
    await deleteCollections();

    registeredClient = await registeredClient.save();
    registeredClient2 = await registeredClient2.save();
    registeredClient3 = await registeredClient3.save();

    scopeOfClient1 = await new scopeModel({
      value: 'test',
      audienceId: registeredClient.audienceId,
      permittedClients: [registeredClient2._id],
    }).save();
    scopeOfClient2 = await new scopeModel({
      value: 'test2',
      audienceId: registeredClient2.audienceId,
      permittedClients: [registeredClient3._id, registeredClient._id],
    }).save();
    scopeOfClient3 = await new scopeModel({
      value: 'test3',
      audienceId: registeredClient3.audienceId,
      permittedClients: [registeredClient._id],
    }).save();
    anotherScopeOfClient1 = await new scopeModel({
      value: 'testtest',
      audienceId: registeredClient.audienceId,
      permittedClients: [registeredClient2._id],
    }).save();
  });

  after(async () => {
    await deleteCollections();
  });

  describe('Authorization Code Flow', () => {

  });

  describe('Implicit Flow', () => {

    afterEach(async () => {
      await deleteCollections(['accesstokens']);
    });

  });

  describe('Resource Owner Password Credentials Flow', () => {

    afterEach(async () => {
      await deleteCollections(['accesstokens']);
    });

    // TODO: Need to fix this to support user cases
    // it('Should acquire token for registered client and user via HTTP Basic Authentication',
    //    (done) => {
    //      request(app)
    //       .post(TOKEN_ENDPOINT)
    //       .set(
    //         'Authorization',
    //         createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //       ).send(
    //         createTokenParameters(
    //           'password',
    //           'https://audience',
    //           'something',
    //           registeredUser.email,
    //           registeredUserPassword,
    //         ),
    //       ).expect((res) => {
    //         checkTokenResponseValidity(
    //           GrantType.PASSWORD,
    //           res,
    //           registeredClient,
    //           { aud: 'https://audience', scope: ['something'], sub: registeredUser.id },
    //         );
    //       }).end(done);
    //    },
    // );

    // it('Should acquire token for registered client and user via POST Authentication',
    //    (done) => {
    //      request(app)
    //       .post(TOKEN_ENDPOINT)
    //       .send({
    //         ...createTokenParameters(
    //           'password',
    //           'https://audience',
    //           'something',
    //           registeredUser.email,
    //           registeredUserPassword,
    //         ),
    //         client_id: registeredClient.id,
    //         client_secret: registeredClient.secret,
    //       }).expect((res) => {
    //         checkTokenResponseValidity(
    //           GrantType.PASSWORD,
    //           res,
    //           registeredClient,
    //           { aud: 'https://audience', scope: ['something'], sub: registeredUser.id },
    //         );
    //       }).end(done);
    //    },
    // );

    // it(`Should acquire token for registered client and user ${''
    //     }even if there's already token for the user (different audience)`,
    //    async () => {
    //      const previousAccessToken = await new accessTokenModel({
    //        clientId: registeredClient._id,
    //        audience: 'https://someaudience.com',
    //        userId: registeredUser.id,
    //        value: 'abcd1234',
    //        scopes: ['something'],
    //        grantType: 'password',
    //      }).save();

    //      const response =
    //        await request(app)
    //               .post(TOKEN_ENDPOINT)
    //               .set(
    //                 'Authorization',
    //                 createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //               ).send(
    //                 createTokenParameters(
    //                   'password',
    //                   'https://audience',
    //                   'something',
    //                   registeredUser.email,
    //                   registeredUserPassword,
    //                 ),
    //               );

    //      checkTokenResponseValidity(
    //        GrantType.PASSWORD,
    //        response,
    //        registeredClient,
    //        { aud: 'https://audience', scope: ['something'], sub: registeredUser.id },
    //      );
    //    },
    // );

    // it(`Should acquire token for registered client and user ${''
    //     }even if there's already token for the user (different user)`,
    //    async () => {
    //      const previousAccessToken = await new accessTokenModel({
    //        clientId: registeredClient._id,
    //        audience: 'https://audience.com',
    //        userId: registeredUser.id,
    //        value: 'abcd1234',
    //        scopes: ['something'],
    //        grantType: 'password',
    //      }).save();

    //      const response =
    //        await request(app)
    //               .post(TOKEN_ENDPOINT)
    //               .set(
    //                 'Authorization',
    //                 createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //               ).send(
    //                 createTokenParameters(
    //                   'password',
    //                   'https://audience',
    //                   'something',
    //                   registeredUser2.email,
    //                   registeredUserPassword2,
    //                 ),
    //               );

    //      checkTokenResponseValidity(
    //        GrantType.PASSWORD,
    //        response,
    //        registeredClient,
    //        { aud: 'https://audience', scope: ['something'], sub: registeredUser2.id },
    //      );
    //    },
    // );

    // it('Should not acquire token for registered client and user without client authentication',
    //    (done) => {
    //      request(app)
    //      .post(TOKEN_ENDPOINT)
    //      .send(
    //        createTokenParameters(
    //          'password',
    //          'https://audience',
    //          'something',
    //          registeredUser.id,
    //          registeredUserPassword,
    //         ),
    //      ).expect(401)
    //      .end(done);
    //    },
    // );

    // it('Should not acquire token for registered client and user without audience parameter',
    //    (done) => {
    //      request(app)
    //       .post(TOKEN_ENDPOINT)
    //       .set(
    //         'Authorization',
    //         createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //       ).send(
    //         createTokenParameters(
    //           'password',
    //           undefined,
    //           'something',
    //           registeredUser.email,
    //           registeredUserPassword,
    //         ),
    //       ).expect(400, { message: errorMessages.MISSING_AUDIENCE })
    //       .end(done);
    //    },
    // );

    // it(`Should not acquire token for registered client and user ${''
    //     }without/incorrect grant_type parameter`,
    //    (done) => {
    //      request(app)
    //       .post(TOKEN_ENDPOINT)
    //       .set(
    //         'Authorization',
    //         createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //       ).send(
    //         createTokenParameters(
    //           undefined,
    //           'https://audience',
    //           'something',
    //           registeredUser.email,
    //           registeredUserPassword,
    //         ),
    //       ).expect(501)
    //       .end(done);
    //    },
    // );

    // it(`Should not acquire token for registered client and user when ${''
    //     }there's already token associated with the same audience`,
    //    async () => {
    //      const previousAccessToken = await new accessTokenModel({
    //       clientId: registeredClient._id,
    //       userId: registeredUser._id,
    //       audience: 'https://audience',
    //       value: 'abcd1234',
    //       scopes: ['reading'],
    //       grantType: 'password',
    //      }).save();

    //      const response =
    //        await request(app)
    //               .post(TOKEN_ENDPOINT)
    //               .set(
    //                 'Authorization',
    //                 createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //               ).send(
    //                 createTokenParameters(
    //                   'password',
    //                   'https://audience',
    //                   'something',
    //                   registeredUser.email,
    //                   registeredUserPassword,
    //                   ),
    //               );
    //      expect(response).to.nested.include({
    //        status: 400,
    //        'body.message': tokenErrorMessages.DUPLICATE_ACCESS_TOKEN,
    //      });

    //    },
    // );

    // it('Should not acquire token for unregistered client',
    //    (done) => {
    //      request(app)
    //       .post(TOKEN_ENDPOINT)
    //       .set(
    //         'Authorization',
    //         createAuthorizationHeader('unexistingClientId', 'unexisitingClientSecret'),
    //       ).send(
    //         createTokenParameters(
    //           'password',
    //           'https://audience',
    //           'something',
    //           registeredUser.email,
    //           registeredUserPassword,
    //         ),
    //       ).expect(401)
    //       .end(done);
    //    },
    // );

  //   it('Should not acquire token for unregistered user',
  //      (done) => {
  //        request(app)
  //         .post(TOKEN_ENDPOINT)
  //         .set(
  //           'Authorization',
  //           createAuthorizationHeader(registeredClient.id, registeredClient.secret),
  //         ).send(
  //           createTokenParameters(
  //             'password',
  //             'https://audience',
  //             'something',
  //             'unexistingUserEmail',
  //             'unexistingUserPassword',
  //           ),
  //         ).expect(403, { message: 'Invalid resource owner credentials' })
  //         .end(done);
  //      },
  //   );
  });

  describe('Client Credentials Flow', () => {

    afterEach(async () => {
      await deleteCollections(['accesstokens']);
    });

    it(`Should acquire token for registered client ${''
        }via HTTP Basic Authentication`,
       (done) => {
         request(app)
          .post(TOKEN_ENDPOINT)
          .set(
            'Authorization',
            createAuthorizationHeader(registeredClient.id, registeredClient.secret),
          ).send(
            createTokenParameters(
              config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
              registeredClient3.audienceId as string,
              (scopeOfClient3 as IScope).value,
            ),
          ).expect((res) => {
            checkTokenResponseValidity(
              GrantType.CLIENT_CREDENTIALS,
              res,
              registeredClient,
              {
                aud: registeredClient3.audienceId as string,
                scope: [(scopeOfClient3 as IScope).value],
              },
            );
          }).end(done);
       },
    );

    it(`Should acquire token for registered client ${''
        }via POST Authentication`,
       (done) => {
         request(app)
          .post(TOKEN_ENDPOINT)
          .send({
            ...createTokenParameters(
              config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
              registeredClient3.audienceId as string,
              (scopeOfClient3 as IScope).value,
            ),
            client_id: registeredClient.id,
            client_secret: registeredClient.secret,
          }).expect((res) => {
            checkTokenResponseValidity(
              GrantType.CLIENT_CREDENTIALS,
              res,
              registeredClient,
              {
                aud: registeredClient3.audienceId as string,
                scope: [(scopeOfClient3 as IScope).value],
              },
            );
          }).end(done);
       },
    );

    it(`Should acquire token for registered client ${''
        }even if there's already token for the client (different audience)`,
       async () => {
         const previousAccessToken = await new accessTokenModel({
           clientId: registeredClient._id,
           audience: registeredClient3.audienceId as string,
           value: 'abcd1234',
           scopes: [(scopeOfClient3 as IScope)._id],
           grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
         }).save();

         const response =
           await request(app)
                  .post(TOKEN_ENDPOINT)
                  .set(
                    'Authorization',
                    createAuthorizationHeader(registeredClient.id, registeredClient.secret),
                  ).send(
                    createTokenParameters(
                      config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
                      registeredClient2.audienceId as string,
                      (scopeOfClient2 as IScope).value,
                    ),
                  );

         checkTokenResponseValidity(
           GrantType.CLIENT_CREDENTIALS,
           response,
           registeredClient,
           {
             aud: registeredClient2.audienceId as string,
             scope: [(scopeOfClient2 as IScope).value],
           },
         );
       },
    );

    it(`Should acquire limit number of tokens for registered client`,
       async () => {

         // Create all access token requests for reaching the limit
         for (let index = 0; index < config.ACCESS_TOKEN_COUNT_LIMIT; index += 1) {
           const response =
             await request(app)
                    .post(TOKEN_ENDPOINT)
                    .set(
                      'Authorization',
                      createAuthorizationHeader(registeredClient.id, registeredClient.secret),
                    ).send(
                      createTokenParameters(
                        config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
                        registeredClient3.audienceId as string,
                        (scopeOfClient3 as IScope).value),
                    );

           // Checking each token validity
           checkTokenResponseValidity(
             GrantType.CLIENT_CREDENTIALS,
             response,
             registeredClient,
             {
               aud: registeredClient3.audienceId as string,
               scope: [(scopeOfClient3 as IScope).value],
             },
           );
         }

       },
    );

    it(`Should acquire token for registered client for different audience ${''
       }even if reached token limit number`,
       async () => {

         const tokens = [];

         // Creating first the limit number of tokens in the db
         for (let index = 0; index < config.ACCESS_TOKEN_COUNT_LIMIT; index += 1) {
           tokens.push(
             await new accessTokenModel({
               clientId: registeredClient._id,
               audience: registeredClient3.audienceId,
               value: index,
               scopes: [(scopeOfClient3 as IScope)._id],
               grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
             }).save(),
          );
         }

         // Creating one more token, but for different audience
         const response =
           await request(app)
                   .post(TOKEN_ENDPOINT)
                   .set(
                     'Authorization',
                     createAuthorizationHeader(registeredClient.id, registeredClient.secret),
                   ).send(
                     createTokenParameters(
                       config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
                       registeredClient2.audienceId as string,
                       (scopeOfClient2 as IScope).value,
                     ),
                   );

         checkTokenResponseValidity(
           GrantType.CLIENT_CREDENTIALS,
           response,
           registeredClient,
           {
             aud: registeredClient2.audienceId as string,
             scope: [(scopeOfClient2 as IScope).value],
           },
         );
       },
    );

    it(`Should acquire tokens for registered client even if currently ${''
       }there is limit number of tokens in db, but one of them is invalid`,
       async () => {
         const tokens = [];

         // Creating first limit -1 tokens count for making one of them invalid (expired)
         for (let index = 0; index < config.ACCESS_TOKEN_COUNT_LIMIT - 1; index += 1) {
           tokens.push(
            await new accessTokenModel({
              clientId: registeredClient._id,
              audience: registeredClient3.audienceId,
              value: index,
              scopes: [(scopeOfClient3 as IScope)._id],
              grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
            }).save(),
           );
         }

         // Creating one more token but invalid (expired)
         tokens.push(
          await new accessTokenModel({
            clientId: registeredClient._id,
            audience: registeredClient3.audienceId,
            value: 'Expired',
            scopes: [(scopeOfClient3 as IScope)._id],
            grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
            expireAt: Date.now() - config.ACCESS_TOKEN_EXPIRATION_TIME * 1000 - 10000,
          }).save(),
         );

         const response =
           await request(app)
                   .post(TOKEN_ENDPOINT)
                   .set(
                     'Authorization',
                     createAuthorizationHeader(registeredClient.id, registeredClient.secret),
                   ).send(
                     createTokenParameters(
                       config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
                       registeredClient3.audienceId as string,
                       (scopeOfClient3 as IScope).value,
                     ),
                   );

         checkTokenResponseValidity(
           GrantType.CLIENT_CREDENTIALS,
           response,
           registeredClient,
           {
             aud: registeredClient3.audienceId as string,
             scope: [(scopeOfClient3 as IScope).value],
           },
         );
       },
    );

    it(`Should not acquire token for registered client if reached token limit number`,
       async () => {

         const tokens = [];

         // Creating first the limit number of tokens in the db
         for (let index = 0; index < config.ACCESS_TOKEN_COUNT_LIMIT; index += 1) {
           tokens.push(
             await new accessTokenModel({
               clientId: registeredClient._id,
               audience: registeredClient3.audienceId,
               value: index,
               scopes: [(scopeOfClient3 as IScope)._id],
               grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
             }).save(),
           );
         }

         // Creating one more token exceeding the token limit number
         const response =
            await request(app)
                   .post(TOKEN_ENDPOINT)
                   .set(
                     'Authorization',
                     createAuthorizationHeader(registeredClient.id, registeredClient.secret),
                   ).send(
                     createTokenParameters(
                       config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
                       registeredClient3.audienceId as string,
                       (scopeOfClient3 as IScope).value,
                      ),
                   );

         expect(response).to.nested.include({
           status: 400,
           'body.message': tokenErrorMessages.LIMIT_VIOLATION_ACCESS_TOKEN_WITHOUT_USER,
         });
       },
    );

    it(`Should not acquire token for registered client without client authentication`,
       (done) => {
         request(app)
         .post(TOKEN_ENDPOINT)
         .send(
           createTokenParameters(
            config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
            registeredClient3.audienceId as string,
            (scopeOfClient3 as IScope).value,
          ),
         ).expect(401)
         .end(done);
       },
    );

    it(`Should not acquire token for registered client without audience parameter`,
       (done) => {
         request(app)
          .post(TOKEN_ENDPOINT)
          .set(
            'Authorization',
            createAuthorizationHeader(registeredClient.id, registeredClient.secret),
          ).send(
            createTokenParameters(
              config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
              undefined,
              (scopeOfClient3 as IScope).value,
            ),
          ).expect(400, { message: errorMessages.MISSING_AUDIENCE })
          .end(done);
       },
    );

    it(`Should not acquire token for registered client without/incorrect grant_type parameter`,
       (done) => {
         request(app)
          .post(TOKEN_ENDPOINT)
          .set(
            'Authorization',
            createAuthorizationHeader(registeredClient.id, registeredClient.secret),
          ).send(
            createTokenParameters(
              undefined,
              registeredClient3.audienceId as string,
              (scopeOfClient3 as IScope).value,
            ),
          ).expect(501)
          .end(done);
       },
    );

    // it(`Should not acquire token for registered client when ${''
    //     }there's already token associated with the same audience`,
    //    async () => {
    //      const previousAccessToken = await new accessTokenModel({
    //       clientId: registeredClient._id,
    //       audience: 'https://audience',
    //       value: 'abcd1234',
    //       scopes: ['reading'],
    //       grantType: 'client_credentials',
    //      }).save();

    //      const response =
    //        await request(app)
    //               .post(TOKEN_ENDPOINT)
    //               .set(
    //                 'Authorization',
    //                 createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //               ).send(
    //                 createTokenParameters('client_credentials', 'https://audience', 'something'),
    //               );
    //      expect(response).to.nested.include({
    //        status: 400,
    //        'body.message': tokenErrorMessages.DUPLICATE_ACCESS_TOKEN_WITHOUT_USER,
    //      });

    //    },
    // );
    // Need to think about it? (The first test function)
    it.skip('Should not acquire token for registered client without scope parameter');
    it.skip(`Should not acquire token for registered client ${''
            }with scopes that does not belong to it`);
    it.skip(`Should not acquire token for registered client without ${''
            }scopes registered (if not defined scope parameter)`);
    it('Should not acquire token for registered client by incorrect secret',
       (done) => {
         request(app)
          .post(TOKEN_ENDPOINT)
          .set('Authorization', createAuthorizationHeader(registeredClient.id, 'incorrectSecret'))
          .send(
            createTokenParameters(
              config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
              registeredClient3.audienceId as string,
              (scopeOfClient3 as IScope).value,
            ),
          ).expect(401)
          .end(done);
       },
    );

    it('Should not acquire token for unregistered client', (done) => {
      request(app)
        .post(TOKEN_ENDPOINT)
        .set('Authorization', createAuthorizationHeader('unexistingId', 'unexisitingSecret'))
        .send(
          createTokenParameters(
            config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
            registeredClient3.audienceId as string,
            (scopeOfClient3 as IScope).value,
          ),
        ).expect(401)
        .end(done);
    });

  });

  describe('Refresh Token Flow', () => {

    // let tokenClientCredentials: IAccessToken;
    // let tokenAuthorizationCode: IAccessToken;
    // let tokenResourceOwnerCredentials: IAccessToken;
    // let tokenImplicit: IAccessToken;

    // let refreshTokenClientCredentials: IRefreshToken;
    // let refreshTokenAuthorizationCode: IRefreshToken;
    // let refreshTokenResourceOwnerCredentials: IRefreshToken;
    // let refreshTokenImplicit: IRefreshToken;

    // const tokenParamsClientCredentials = {
    //   clientId: registeredClient._id,
    //   audience: registeredClient2.audienceId,
    //   value: OAuth2Utils.createJWTAccessToken({
    //     aud: registeredClient2.audienceId as string,
    //     sub: registeredClient._id,
    //     scope: ['read'],
    //     clientId: registeredClient._id,
    //   }),
    //   scopes: ['read'],
    //   grantType: 'client_credentials',
    // };

    // const tokenParamsAuthorizationCode = {
    //   clientId: registeredClient._id,
    //   userId: registeredUser._id,
    //   audience: registeredClient2.audienceId,
    //   value: OAuth2Utils.createJWTAccessToken({
    //     aud: registeredClient2.audienceId as string,
    //     sub: registeredUser._id,
    //     scope: ['write'],
    //     clientId: registeredClient._id,
    //   }),
    //   scopes: ['write'],
    //   grantType: 'code',
    // };

    // const tokenParamsResourceOwnerCredentials = {
    //   clientId: registeredClient._id,
    //   userId: registeredUser._id,
    //   audience: registeredClient3.audienceId,
    //   value: OAuth2Utils.createJWTAccessToken({
    //     aud: registeredClient3.audienceId as string,
    //     sub: registeredUser._id,
    //     scope: ['write'],
    //     clientId: registeredClient._id,
    //   }),
    //   scopes: ['write'],
    //   grantType: 'password',
    // };

    // const tokenParamsImplicit = {
    //   clientId: registeredClient3._id,
    //   userId: registeredUser._id,
    //   audience: registeredClient.audienceId,
    //   value: OAuth2Utils.createJWTAccessToken({
    //     aud: registeredClient.audienceId as string,
    //     sub: registeredUser._id,
    //     scope: ['write'],
    //     clientId: registeredClient._id,
    //   }),
    //   scopes: ['write'],
    //   grantType: 'token',
    // };

    // Middleware for before and after test cases
    const deleteAndCreateTokens = async () => {
      await deleteCollections(['accesstokens', 'refreshtokens']);

      // tokenClientCredentials = await new accessTokenModel(tokenParamsClientCredentials).save();
      // tokenAuthorizationCode = await new accessTokenModel(tokenParamsAuthorizationCode).save();
      // tokenResourceOwnerCredentials =
      //   await new accessTokenModel(tokenParamsResourceOwnerCredentials).save();
      // tokenImplicit = await new accessTokenModel(tokenParamsImplicit).save();

      // refreshTokenClientCredentials = await new refreshTokenModel({
      //   value: refreshTokenValueGenerator(),
      //   accessTokenId: tokenClientCredentials._id,
      // }).save();
      // refreshTokenAuthorizationCode = await new refreshTokenModel({
      //   value: refreshTokenValueGenerator(),
      //   accessTokenId: tokenAuthorizationCode._id,
      // }).save();
      // refreshTokenResourceOwnerCredentials = await new refreshTokenModel({
      //   value: refreshTokenValueGenerator(),
      //   accessTokenId: tokenResourceOwnerCredentials._id,
      // }).save();
      // refreshTokenImplicit = await new refreshTokenModel({
      //   value: refreshTokenValueGenerator(),
      //   accessTokenId: tokenImplicit._id,
      // }).save();

      // await tokenClientCredentials.populate('clientId').execPopulate();
      // await tokenAuthorizationCode.populate('clientId').execPopulate();
      // await tokenResourceOwnerCredentials.populate('clientId').execPopulate();
      // await tokenImplicit.populate('clientId').execPopulate();
    };

    before(deleteAndCreateTokens);

    afterEach(deleteAndCreateTokens);

    // TODO: Change this according to new scope model
    // it('Should refresh existing token via HTTP Basic Authentication',
    //    async () => {

    //      // Response for each flow
    //      const resAuthCode =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenAuthorizationCode.clientId).id,
    //             (<IClient>tokenAuthorizationCode.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenAuthorizationCode.value));
    //      const resImplicit =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenImplicit.clientId).id,
    //             (<IClient>tokenImplicit.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenImplicit.value));
    //      const resResourceOwnerCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenResourceOwnerCredentials.clientId).id,
    //             (<IClient>tokenResourceOwnerCredentials.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value));
    //      const resClientCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenClientCredentials.clientId).id,
    //             (<IClient>tokenClientCredentials.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenClientCredentials.value));

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resAuthCode,
    //        (<IClient>tokenAuthorizationCode.clientId),
    //        {
    //          aud: tokenAuthorizationCode.audience,
    //          sub: <string>tokenAuthorizationCode.userId,
    //          scope: tokenAuthorizationCode.scopes,
    //        },
    //      );

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resImplicit,
    //        (<IClient>tokenImplicit.clientId),
    //        {
    //          aud: tokenImplicit.audience,
    //          sub: <string>tokenImplicit.userId,
    //          scope: tokenImplicit.scopes,
    //        },
    //      );

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resResourceOwnerCredentials,
    //        (<IClient>tokenResourceOwnerCredentials.clientId),
    //        {
    //          aud: tokenResourceOwnerCredentials.audience,
    //          sub: <string>tokenResourceOwnerCredentials.userId,
    //          scope: tokenResourceOwnerCredentials.scopes,
    //        },
    //      );

    //      expect(resClientCredentials).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //    },
    // );

    // it('Should refresh existing token via POST Authentication',
    //    async () => {

    //      // Response for each flow
    //      const resAuthCode =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send({
    //           client_id: (<IClient>tokenAuthorizationCode.clientId).id,
    //           client_secret: (<IClient>tokenAuthorizationCode.clientId).secret,
    //           ...createRefreshTokenParameters(refreshTokenAuthorizationCode.value),
    //         });
    //      const resImplicit =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send({
    //           client_id: (<IClient>tokenImplicit.clientId).id,
    //           client_secret: (<IClient>tokenImplicit.clientId).secret,
    //           ...createRefreshTokenParameters(refreshTokenImplicit.value),
    //         });
    //      const resResourceOwnerCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send({
    //           client_id: (<IClient>tokenResourceOwnerCredentials.clientId).id,
    //           client_secret: (<IClient>tokenResourceOwnerCredentials.clientId).secret,
    //           ...createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value),
    //         });
    //      const resClientCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send({
    //           client_id: (<IClient>tokenClientCredentials.clientId).id,
    //           client_secret: (<IClient>tokenClientCredentials.clientId).secret,
    //           ...createRefreshTokenParameters(refreshTokenClientCredentials.value),
    //         });

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resAuthCode,
    //        (<IClient>tokenAuthorizationCode.clientId),
    //        {
    //          aud: tokenAuthorizationCode.audience,
    //          sub: <string>tokenAuthorizationCode.userId,
    //          scope: tokenAuthorizationCode.scopes,
    //        },
    //      );

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resImplicit,
    //        (<IClient>tokenImplicit.clientId),
    //        {
    //          aud: tokenImplicit.audience,
    //          sub: <string>tokenImplicit.userId,
    //          scope: tokenImplicit.scopes,
    //        },
    //      );

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resResourceOwnerCredentials,
    //        (<IClient>tokenResourceOwnerCredentials.clientId),
    //        {
    //          aud: tokenResourceOwnerCredentials.audience,
    //          sub: <string>tokenResourceOwnerCredentials.userId,
    //          scope: tokenResourceOwnerCredentials.scopes,
    //        },
    //      );

    //      expect(resClientCredentials).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //    },
    // );

    // it('Should not refresh existing token without authentication',
    //    async () => {

    //      // Response for each flow
    //      const resAuthCode =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send(createRefreshTokenParameters(refreshTokenAuthorizationCode.value));
    //      const resImplicit =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send(createRefreshTokenParameters(refreshTokenImplicit.value));
    //      const resResourceOwnerCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send(createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value));
    //      const resClientCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .send(createRefreshTokenParameters(refreshTokenClientCredentials.value));

    //      expect(resAuthCode).to.nested.include({ status: 401 });
    //      expect(resImplicit).to.nested.include({ status: 401 });
    //      expect(resResourceOwnerCredentials).to.nested.include({ status: 401 });
    //      expect(resClientCredentials).to.nested.include({ status: 401 });
    //    },
    // );

    // it('Should not refresh existing token for unassociated client',
    //    async () => {

    //      // Response for each flow
    //      const resAuthCode =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             registeredClient2.id,
    //             registeredClient2.secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenAuthorizationCode.value));
    //      const resImplicit =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             registeredClient2.id,
    //             registeredClient2.secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenImplicit.value));
    //      const resResourceOwnerCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             registeredClient2.id,
    //             registeredClient2.secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value));
    //      const resClientCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             registeredClient2.id,
    //             registeredClient2.secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenClientCredentials.value));

    //      expect(resAuthCode).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resImplicit).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resResourceOwnerCredentials).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resClientCredentials).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });
    //    },
    //   );

    // it('Should not refresh exisiting token for unexisting client',
    //    async () => {

    //      // Response for each flow
    //      const resAuthCode =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             'unexistingClientId',
    //             'unexistingClientSecret',
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenAuthorizationCode.value));
    //      const resImplicit =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             'unexistingClientId',
    //             'unexistingClientSecret',
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenImplicit.value));
    //      const resResourceOwnerCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             'unexistingClientId',
    //             'unexistingClientSecret',
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value));
    //      const resClientCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             'unexistingClientId',
    //             'unexistingClientSecret',
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenClientCredentials.value));

    //      expect(resAuthCode).to.nested.include({ status: 401 });
    //      expect(resImplicit).to.nested.include({ status: 401 });
    //      expect(resResourceOwnerCredentials).to.nested.include({ status: 401 });
    //      expect(resClientCredentials).to.nested.include({ status: 401 });
    //    },
    // );

    // it('Should not refresh unexisting token by existing client',
    //    (done) => {
    //      request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             registeredClient.id,
    //             registeredClient.secret,
    //           ),
    //         ).send(createRefreshTokenParameters('unexistingRefreshToken'))
    //         .expect(403, { message: 'Invalid refresh token' })
    //         .end(done);
    //    },
    // );

    // it('Should not refresh revoked exisiting token twice in a row by existing client',
    //    async () => {

    //     // Response for each flow
    //      const resAuthCode =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenAuthorizationCode.clientId).id,
    //             (<IClient>tokenAuthorizationCode.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenAuthorizationCode.value));
    //      const resAuthCode2 =
    //      await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenAuthorizationCode.clientId).id,
    //             (<IClient>tokenAuthorizationCode.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenAuthorizationCode.value));
    //      const resImplicit =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenImplicit.clientId).id,
    //             (<IClient>tokenImplicit.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenImplicit.value));
    //      const resImplicit2 =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenImplicit.clientId).id,
    //             (<IClient>tokenImplicit.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenImplicit.value));
    //      const resResourceOwnerCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenResourceOwnerCredentials.clientId).id,
    //             (<IClient>tokenResourceOwnerCredentials.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value));
    //      const resResourceOwnerCredentials2 =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenResourceOwnerCredentials.clientId).id,
    //             (<IClient>tokenResourceOwnerCredentials.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenResourceOwnerCredentials.value));
    //      const resClientCredentials =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenClientCredentials.clientId).id,
    //             (<IClient>tokenClientCredentials.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenClientCredentials.value));
    //      const resClientCredentials2 =
    //       await request(app)
    //         .post(TOKEN_ENDPOINT)
    //         .set(
    //           'Authorization',
    //           createAuthorizationHeader(
    //             (<IClient>tokenClientCredentials.clientId).id,
    //             (<IClient>tokenClientCredentials.clientId).secret,
    //           ),
    //         ).send(createRefreshTokenParameters(refreshTokenClientCredentials.value));

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resAuthCode,
    //        (<IClient>tokenAuthorizationCode.clientId),
    //        {
    //          aud: tokenAuthorizationCode.audience,
    //          sub: <string>tokenAuthorizationCode.userId,
    //          scope: tokenAuthorizationCode.scopes,
    //        },
    //      );

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resImplicit,
    //        (<IClient>tokenImplicit.clientId),
    //        {
    //          aud: tokenImplicit.audience,
    //          sub: <string>tokenImplicit.userId,
    //          scope: tokenImplicit.scopes,
    //        },
    //      );

    //      checkTokenResponseValidity(
    //        GrantType.REFRESH_TOKEN,
    //        resResourceOwnerCredentials,
    //        (<IClient>tokenResourceOwnerCredentials.clientId),
    //        {
    //          aud: tokenResourceOwnerCredentials.audience,
    //          sub: <string>tokenResourceOwnerCredentials.userId,
    //          scope: tokenResourceOwnerCredentials.scopes,
    //        },
    //      );

    //      expect(resClientCredentials).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resAuthCode2).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resImplicit2).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resResourceOwnerCredentials2).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });

    //      expect(resClientCredentials2).to.nested.include({
    //        status: 403,
    //        'body.message': 'Invalid refresh token',
    //      });
    //    },
    // );

  });

  describe('Token Introspection', () => {

    let validToken: IAccessToken | null = null;

    // let validToken2 = new accessTokenModel({
    //   clientId: registeredClient._id,
    //   userId: registeredUser._id,
    //   audience: registeredClient2.audienceId,
    //   value: OAuth2Utils.createJWTAccessToken({
    //     aud: registeredClient2.audienceId as string,
    //     sub: registeredUser._id,
    //     scope: ['write'],
    //     clientId: registeredClient._id,
    //   }),
    //   scopes: ['write'],
    //   grantType: 'code',
    // });

    let validInactiveToken: IAccessToken | null = null ;

    before(async () => {
      await deleteCollections(['accesstokens']);

      validToken = await new accessTokenModel({
        clientId: registeredClient2._id,
        audience: registeredClient.audienceId,
        value: OAuth2Utils.createJWTAccessToken({
          aud: registeredClient.audienceId as string,
          sub: registeredClient2.id,
          scope: [(scopeOfClient1 as IScope).value],
          clientId: registeredClient2._id,
        }),
        scopes: [(scopeOfClient1 as IScope)._id],
        grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
      }).save();
      validInactiveToken = await new accessTokenModel({
        clientId: registeredClient3._id,
        audience: registeredClient2.audienceId,
        value: OAuth2Utils.createJWTAccessToken({
          aud: registeredClient2.audienceId as string,
          sub: registeredClient3.id,
          scope: [(scopeOfClient2 as IScope).value],
          clientId: registeredClient3._id,
        }),
        scopes: [(scopeOfClient2 as IScope)._id],
        grantType: config.OAUTH_GRANT_TYPES.CLIENT_CREDENTIALS,
        expireAt: new Date(1000),
      }).save();

    });

    it('Should return information about valid token via HTTP Basic Authentication', async () => {
      const response =
        await request(app)
                .post(TOKEN_INTROSPECTION_ENDPOINT)
                .set(
                  'Authorization',
                  createAuthorizationHeader(registeredClient2.id, registeredClient2.secret),
                ).send({ token: (validToken as IAccessToken).value });

      checkTokenIntrospection(response, (validToken as IAccessToken));
    });

    it('Should return information about valid token via POST Authentication', async () => {
      const response =
        await request(app)
                .post(TOKEN_INTROSPECTION_ENDPOINT)
                .send({
                  token: (validToken as IAccessToken).value,
                  client_id: registeredClient.id,
                  client_secret: registeredClient.secret,
                });

      checkTokenIntrospection(response, (validToken as IAccessToken));
    });

    // it('Should return information about valid token containing associated username', (done) => {
    //   request(app)
    //     .post(TOKEN_INTROSPECTION_ENDPOINT)
    //     .set(
    //       'Authorization',
    //       createAuthorizationHeader(registeredClient.id, registeredClient.secret),
    //     ).send({ token: validToken2.value })
    //     .expect(res => checkTokenIntrospection(res, validToken2))
    //     .end(done);
    // });

    it('Should return information about valid token to audience client', async () => {
      const response =
        await request(app)
                .post(TOKEN_INTROSPECTION_ENDPOINT)
                .set(
                  'Authorization',
                  createAuthorizationHeader(registeredClient2.id, registeredClient2.secret),
                ).send({ token: (validToken as IAccessToken).value });

      checkTokenIntrospection(response, (validToken as IAccessToken));
    });

    it('Should return information about valid token to the associated client', async () => {
      const response =
        await request(app)
                .post(TOKEN_INTROSPECTION_ENDPOINT)
                .set(
                  'Authorization',
                  createAuthorizationHeader(registeredClient.id, registeredClient.secret),
                ).send({ token: (validToken as IAccessToken).value });

      checkTokenIntrospection(response, (validToken as IAccessToken));
    });

    it(`Should not return information about valid token to ${''
       }client which is not associated or audience`,
       async () => {
         const response =
          await request(app)
                  .post(TOKEN_INTROSPECTION_ENDPOINT)
                  .set(
                    'Authorization',
                    createAuthorizationHeader(registeredClient3.id, registeredClient3.secret),
                  ).send({ token: (validToken as IAccessToken).value });

         checkTokenIntrospection(response);
       },
    );

    it('Should not return information about valid token without authentication', (done) => {
      request(app)
        .post(TOKEN_INTROSPECTION_ENDPOINT)
        .send({ token: (validToken as IAccessToken).value })
        .expect(401)
        .end(done);
    });

    it('Should return only active status about inactive token', async () => {
      const response =
        await request(app)
          .post(TOKEN_INTROSPECTION_ENDPOINT)
          .set(
            'Authorization',
            createAuthorizationHeader(registeredClient3.id, registeredClient3.secret),
          ).send({ token: (validInactiveToken as IAccessToken).value });

      checkTokenIntrospection(response);
    });

    it('Should return only active status about unexists token', (done) => {

      const unexistToken = OAuth2Utils.createJWTAccessToken({
        aud: 'https://unexistingAudienceHostUri',
        sub: 'unexistSubjectId',
        scope: ['unexistingScope'],
        clientId: 'unexistingClientId',
      });

      const unexistToken2 = OAuth2Utils.createJWTAccessToken({
        aud: registeredClient2.audienceId as string,
        sub: registeredClient.id,
        scope: [(scopeOfClient1 as IScope).value],
        clientId: registeredClient.id,
      });

      request(app)
        .post(TOKEN_INTROSPECTION_ENDPOINT)
        .set(
          'Authorization',
          createAuthorizationHeader(registeredClient.id, registeredClient.secret),
        ).send({ token:  unexistToken })
        .expect(res => checkTokenIntrospection(res))
        .end(() => {
          request(app)
            .post(TOKEN_INTROSPECTION_ENDPOINT)
            .set(
              'Authorization',
              createAuthorizationHeader(registeredClient.id, registeredClient.secret),
            ).send({ token:  unexistToken2 })
            .expect(res => checkTokenIntrospection(res))
            .end(done);
        });
    });
  });
});
