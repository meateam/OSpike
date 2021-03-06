// app

import * as bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import express, { NextFunction } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import path from 'path';
import './passport_config'; // Setting up all passport middlewares
import './db_config'; // Create mongodb connections
import { default as redis } from 'redis';
import { default as session } from 'express-session';
import { default as oauthRouter } from './oauth2/oauth2.routes';
import { default as authRouter } from './auth/auth.routes';
import { default as wellKnownRouter } from './certs/certs.routes';
import { errorHandler } from './utils/error.handler';
import { log, parseLogData, LOG_LEVEL } from './utils/logger';
import config from './config';

const ddos = require('ddos');
const redisConnector = require('connect-redis');

const app = express();

// Morgan formatting types for each environment
const morganFormatting: any = { prod: 'common', dev: 'dev', test: 'tiny' };

morgan.token('remote-user', (req, res) => {
  if (req.headers['authorization']) {
    const encodedCredentials = (req.headers['authorization'] as string).split('Basic');

    if (encodedCredentials.length === 0 || encodedCredentials.length < 2) {
      return null;
    }

    const credentials = (Buffer.from(encodedCredentials[1], 'base64').toString()).split(':');

    if (credentials.length >= 1) {
      return credentials[0];
    }
  }

  if (req.body) {
    return req.body.client_id;
  }
});

// Set ejs as view engine for server side rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

// Static files middleware
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Middlewares
app.set('port', process.env.PORT);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(morganFormatting[process.env.NODE_ENV || 'dev']));
app.use(helmet());

// Set up DDOS protection only if enabled
if (config.DDOS_ENABLED) {
  app.use(
    new ddos(
      { 
        burst: config.DDOS_BURST_RATE,
        limit: config.DDOS_LIMIT_RATE,
        ...(config.DDOS_WHITELIST ? { whitelist: config.DDOS_WHITELIST } : {}),
      },
    ).express
  );
}

// Create redis store instance if possible, for managing session store in redis.
let redisStoreInstance = null;

if (config.SESSION_REDIS_HOST && config.SESSION_REDIS_PORT && config.SESSION_REDIS_PASSWORD) {
  const redisClient = redis.createClient({
    host: config.SESSION_REDIS_HOST,
    port: config.SESSION_REDIS_PORT,
    password: config.SESSION_REDIS_PASSWORD,
    retry_strategy: (options) => {
      if (options.total_retry_time > 1000 * 60 * 60) {
        return 5000;
      }

      return Math.min(options.attempt * 100, 3000);
    }
  });

  const RedisStore = redisConnector(session);

  redisStoreInstance = new RedisStore({ client: redisClient });
}

// Use express session support since OAuth2orize requires it.
// Also, connect redis store to enable multi-instance support.
app.use(session({
  ...(redisStoreInstance ? { store: redisStoreInstance } : {}),
  secret: config.SESSION_SECRET,
  saveUninitialized: true,
  resave: true,
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

/* Routes */

// OAuth2 routes
app.use(config.OAUTH_ENDPOINT, oauthRouter);

// Authentication routes (Shraga)
app.use(config.AUTH_ENDPOINT, authRouter);

// Well known routes
app.use(config.WELLKNOWN_ENDPOINT, wellKnownRouter);

// Error handler
app.use(errorHandler);

// Health check for Load Balancer
app.get('/health', (req, res) => res.send('alive'));

// Handling all unknown route request with 404
app.all('*', (req, res) => {
  log(
    LOG_LEVEL.INFO,
    parseLogData(
      'Unknown Route Request',
      `Received from ${req.headers['x-forwarded-for']}, Operation - ${req.method}. ${'\r\n'
      }Route Name: ${req.originalUrl}`,
      404,
      null,
    ),
  );
  res.status(404).send({ message: `Page not found` });
});

export default app;
