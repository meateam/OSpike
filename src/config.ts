// config

import { join } from 'path';

const config = {
  // Expiration Times - format in seconds for mongoose TTL expiration field
  AUTH_CODE_EXPIRATION_TIME: 
    process.env.AUTH_CODE_EXPIRATION_TIME && !isNaN(parseInt(process.env.AUTH_CODE_EXPIRATION_TIME, 10)) ?
    parseInt(process.env.AUTH_CODE_EXPIRATION_TIME, 10)
    :
    120, // 2 Minutes
  ACCESS_TOKEN_EXPIRATION_TIME: 
    process.env.ACCESS_TOKEN_EXPIRATION_TIME && !isNaN(parseInt(process.env.ACCESS_TOKEN_EXPIRATION_TIME, 10)) ?
    parseInt(process.env.ACCESS_TOKEN_EXPIRATION_TIME, 10)
    :
    180, // 3 Minutes
  REFRESH_TOKEN_EXPIRATION_TIME: 
    process.env.REFRESH_TOKEN_EXPIRATION_TIME && !isNaN(parseInt(process.env.REFRESH_TOKEN_EXPIRATION_TIME, 10)) ?
    parseInt(process.env.REFRESH_TOKEN_EXPIRATION_TIME, 10)
    :
    180, // 3 Minutes

  // Access Token Count Limit - Number of tokens limitation
  ACCESS_TOKEN_COUNT_LIMIT: 
    process.env.ACCESS_TOKEN_COUNT_LIMIT && !isNaN(parseInt(process.env.ACCESS_TOKEN_COUNT_LIMIT, 10)) ?
    parseInt(process.env.ACCESS_TOKEN_COUNT_LIMIT, 10)
    :
    10,

  // Access Token Limitation Whitelist
  ACCESS_TOKEN_LIMIT_WHITELIST: 
    process.env.ACCESS_TOKEN_LIMIT_WHITELIST && process.env.ACCESS_TOKEN_LIMIT_WHITELIST.split(',').length > 0 ?
    process.env.ACCESS_TOKEN_LIMIT_WHITELIST.split(',')
    :
    [],

  // Lengths
  AUTH_CODE_LENGTH: 50,
  ACCESS_TOKEN_LENGTH: 100,
  REFRESH_TOKEN_LENGTH: 50,
  CLIENT_ID_LENGTH: 40,
  CLIENT_SECRET_LENGTH: 100,
  AUDIENCE_ID_LENGTH: 30,
  REGISTRATION_TOKEN_LENGTH: 40,

  // Client Manager
  CLIENT_MANAGER_SCOPE: 'client_manager_special_scope',
  CLIENT_MANAGER_AUTHORIZATION_HEADER: 'authorization-registrer',
  CLIENT_MANAGER_PASSPORT_STRATEGY: 'client_manager_strategy', // Only client manager authentication
  CLIENT_MANAGER_PASSPORT_MANAGEMENT_STRATEGY: 'client_manager_management_strategy',

  // OSpike Audience (For the client manager operations)
  OSPIKE_AUDIENCE: process.env.OSPIKE_AUDIENCE,

  // OAuth2 Grant Types
  OAUTH_GRANT_TYPES: {
    AUTHORIZATION_CODE: 'code',
    IMPLICIT: 'token',
    RESOURCE_OWNER_PASSWORD_CREDENTIALS: 'password',
    CLIENT_CREDENTIALS: 'client_credentials',
  },

  /** Routes Configuration */
  OAUTH_ENDPOINT: '/oauth2',

  // OAuth2 Flows Routes
  OAUTH_AUTHORIZATION_ENDPOINT: '/authorize',
  OAUTH_TOKEN_ENDPOINT: '/token',
  OAUTH_TOKEN_INTROSPECTION_ENDPOINT: '/tokeninfo',
  OAUTH_TOKEN_USER_CONSENT_ENDPOINT: '/decision', // User decision endpoint
  OAUTH_USER_LOGIN_ENDPOINT: '/login',

  // OAuth2 Management Routes
  OAUTH_MANAGEMENT_ENDPOINT: '/management',
  OAUTH_MANAGEMENT_CLIENT_ENDPOINT: '/client',
  OAUTH_MANAGEMENT_SCOPE_ENDPOINT: '/scope',
  OAUTH_MANAGEMENT_PERMISSION_ENDPOINT: '/user',

  // OAuth2 User Permission Management Routes
  OAUTH_PERMISSION_MANAGEMENT_ENDPOINT: '/user-permissions',

  // Authentication Routes
  AUTH_ENDPOINT: '/auth',
  AUTH_SHRAGA_ENDPOINT: '/shraga',
  AUTH_SHRAGA_CALLBACK_ENDPOINT: '/callback',

  // Well-known Routes for resource sharing (SSL Certificates, Public key, etc.)
  WELLKNOWN_ENDPOINT: '/.well-known',

  // Shraga Callback Route
  get SHRAGA_CALLBACK_ENDPOINT() {
    return `${this.OAUTH_ENDPOINT + this.OAUTH_AUTHORIZATION_ENDPOINT}`;
  },

  // Shraga Callback Hostname
  SHRAGA_REDIRECT_HOSTNAME: `https://${process.env.HOSTNAME}`,

  // Session
  SESSION_SECRET: 'bla_bla_secret_session_dont_tell_anyone',

  // Session Redis Store Configurations
  SESSION_REDIS_HOST: process.env.SESSION_REDIS_HOST,
  SESSION_REDIS_PORT: 
    process.env.SESSION_REDIS_PORT && !isNaN(parseInt(process.env.SESSION_REDIS_PORT)) ?
    parseInt(process.env.SESSION_REDIS_PORT)
    :
    undefined,
  SESSION_REDIS_PASSWORD: process.env.SESSION_REDIS_PASSWORD,

  // MongoDB Url
  mongoUrl:
    `mongodb${process.env.MONGO_SRV || ''}://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.MONGO_URL}`,

  // SSL Configuration
  privateKeyPath: join(__dirname, 'certs/files/privatekey.pem'),
  publicKeyPath: join(__dirname, 'certs/files/publickey.pem'),
  certificatePath: join(__dirname, 'certs/files/certificate.pem'),

  // JWT Configuration
  issuerHostUri: `https://${process.env.ISSUER_HOSTNAME}`,
  jwtAlgorithm: 'RS256',
  jwksPath: join(__dirname, 'certs/files/jwks.json'),

  // DDOS Protection values
  DDOS_ENABLED: process.env.DDOS_ENABLED === 'true' || false,
  DDOS_BURST_RATE: process.env.DDOS_BURST_RATE || 8,
  DDOS_LIMIT_RATE: process.env.DDOS_LIMIT_RATE || 15,
  DDOS_WHITELIST: 
    process.env.DDOS_WHITELIST && process.env.DDOS_WHITELIST.split(',').length > 0 ?
    process.env.DDOS_WHITELIST.split(',')
    :
    null,

  // Predefined string values
  DEFAULT_DESCRIPTION: 'No description provided.',
};

export default config;
