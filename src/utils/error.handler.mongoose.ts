// error.handler.mongoose

import { Error as MongooseError } from 'mongoose';
import { MongoError } from 'mongodb';

export class MongooseErrorHandler {

  private static readonly REGEX_UNIQUE_KEY = /E11000\sduplicate\skey\serror\scollection\:.+(clients|accesstokens|refreshtokens|authcodes|users).+key.+\{(.+)\}/;
  private static readonly DUP_KEY_SEP = 'dup key: { :';
  private static readonly DUP_KEY_TEMPLATE_MESSAGE =
    `There's already {%VALUE%} for {%COLLECTION%}`;
  private static readonly DUP_KEY_TEMPLATE_MESSAGE_SHORT =
    `There's already {%VALUE%}`;
  private static readonly DUP_KEY_TEMPLATE_MESSAGE_TINY =
    `Duplicate value given.`;
  private static readonly COLLECTION_NAMES = [
    'clients', 'accesstokens', 'refreshtokens', 'authcodes', 'users',
  ];
  private static readonly COLLECTION_NAMES_VIEW = [
    'Client', 'Access-Token', 'Refresh-Token', 'Authorization-Code', 'User',
  ];

  /**
   * Returns if the error is Mongoose/Mongo error or not
   * @param error - Error to check
   */
  static instanceOf(error: any): boolean {
    return error instanceof MongooseError || error instanceof MongoError;
  }

  /**
   * Parses error occurred by mongoose to readable error for the client
   * @param error - Error occurred by mongoose
   */
  static parseError(error: MongooseError | MongoError): { status: number, message: string } {

    switch (error.name) {

      // Any validation errors or casting error occurred by user input
      case 'ValidationError':
      case 'ValidatorError':
      case 'CastError':
        return {
          status: 400,
          message: error.message,
        };

      // Checks duplicate key error
      // TODO: Make more beautiful error message
      case 'MongoError':
        if ((<any>error).code === 11000 || (<any>error).code === 11001) {
          return {
            status: 400,
            message: MongooseErrorHandler.parseDuplicateKeyMessage(error.message, (<any>error).keyValue),
          };
        }

      // Any other unusual errors
      default:
        return {
          status: 500,
          message: error.message || 'Internal Server Error',
        };
    }

  }

  private static parseDuplicateKeyMessage(message: string, keyValue: any) {

    // Extract the property, name and collection of the unique index violation
    const regexMatches = message.match(MongooseErrorHandler.REGEX_UNIQUE_KEY);

    // All the values extracted successfully from the regex
    if (regexMatches && regexMatches.length === 3) {
      const collectionIndex = MongooseErrorHandler.COLLECTION_NAMES.indexOf(regexMatches[1]);
      const dupValue = regexMatches[2];
      let collectionView =
        collectionIndex !== -1 ?
          MongooseErrorHandler.COLLECTION_NAMES_VIEW[collectionIndex]
          :
          null;


      if (dupValue && collectionView) {
        return MongooseErrorHandler.DUP_KEY_TEMPLATE_MESSAGE
          .replace(`{%VALUE%}`, dupValue)
          .replace(`{%COLLECTION%}`, collectionView);
      }

      if (dupValue) {
        return MongooseErrorHandler.DUP_KEY_TEMPLATE_MESSAGE_SHORT
          .replace(`{%VALUE%}`, dupValue);
      }
    }

    // Unique index was not found in the error
    if (!keyValue) {
      return MongooseErrorHandler.DUP_KEY_TEMPLATE_MESSAGE_TINY;
    }

    const propKeys = Object.keys(keyValue);

    // Unique index values not found in the error
    if (propKeys.length === 0) {
      return MongooseErrorHandler.DUP_KEY_TEMPLATE_MESSAGE_TINY;
    }

    const prop = propKeys[0];
    const value = keyValue[propKeys[0]];

    return MongooseErrorHandler.DUP_KEY_TEMPLATE_MESSAGE_SHORT
      .replace('{%VALUE%}', `${prop}: ${value}`);
  }
}
