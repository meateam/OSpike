import * as winston from 'winston';
const winstonRotateFile = require('winston-daily-rotate-file');
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { Client } from '@elastic/elasticsearch';

const client = new Client({ node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' });
const serviceName = 'OSpike';
const hostname = 'HOSTNAME';

// log levels
export enum LOG_LEVEL {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

const esTransportOpts = {
  level: 'info',
  index: 'ospike',
  client: client
};

const esTransport = new ElasticsearchTransport(esTransportOpts);

const logger = winston.createLogger({
  defaultMeta: { hostname, service: serviceName },
  transports: [
    esTransport
  ]
});

const format = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.json());

logger.add(new winstonRotateFile({
  format,
  level: LOG_LEVEL.INFO,
  datePattern: 'YYYY-MM-DD',
  maxSize: '3g',
  maxFiles: 3,
  filename: process.env.LOG_FILE_NAME,
  dirname: process.env.LOG_DIR || '.',
}));

export const log = (severity: string, meta: any) => {
  const { message, ...other } = meta;
  logger.log(severity, message, other);
};

export const parseLogData = (name?: string | null,
                             message?: string | null,
                             code?: string | number | null,
                             stack?: string | null) => {
  return {
    hostname,
    name: name || 'No name provided',
    message: message || 'No message provided',
    code: String(code || 'No code provided'),
    stack: stack || 'No stack trace provided',
    service: serviceName,
  };
};
