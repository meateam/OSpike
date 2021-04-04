// db_config

import mongoose from 'mongoose';
import config from './config';
import { LOG_LEVEL, log, parseLogData } from './utils/logger';

const connect = () => {
  const options = {
                    autoReconnect: true,
                    useNewUrlParser: true,
                    reconnectTries: Number.MAX_VALUE,
                    reconnectInterval: 60 * 1000,
                    connectTimeoutMS: 10 * 1000,
                    useCreateIndex: true,
                  };
  mongoose.connect(config.mongoUrl, options).catch((err) => {
      console.log(err);
  });
}

connect();

mongoose.connection.on('connected', () => {
  console.log('Connected to mongo');

  log(
      LOG_LEVEL.INFO,
      parseLogData(
        'MongoDB Connection Established',
        `MongoDB connection established`,
        '',
        '',
      ),
  );
});

mongoose.connection.on('error', (err) => {
  log(
      LOG_LEVEL.ERROR,
      parseLogData(
          err.name || 'Error MongoDB Connection',
          `Error connecting to mongo server, received: ${err.message || err}`,
          '',
          err.stack,
      ),
  );

  console.error('Error Connecting to mongo.');
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB Connection Disconnected!');

  log(
      LOG_LEVEL.ERROR,
      parseLogData(
        'MongoDB Connection Disconnected',
        `MongoDB connection Disconnected - received: Connection Destroyed`,
        '',
         '',
      ),
  );

  connect();
});
