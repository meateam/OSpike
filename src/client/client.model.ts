// client.model

import { Schema, model } from 'mongoose';
import { URL } from 'url';
import { IClient, collectionName } from './client.interface';
import { hostUrisRegexValidator, redirectUrisValidator } from './client.validator';
import { scopeRefValidator } from '../scope/scope.validator';
import { InvalidRedirectUri, InvalidHostUri } from './client.error';

// TODO: Need to change 'scopes' to virtual field for better handling of scopes management
const clientSchema = new Schema({
  name: {
    type: String,
    unique: true,
    required: true,
  },
  id: {
    type: String,
    unique: true,
    required: true,
  },
  secret: {
    type: String,
    unique: true,
    required: true,
  },
  audienceId: {
    type: String,
    unique: true,
    required: true,
  },
  redirectUris: {
    type: [String],
    // unique: true,
    required: true,
    validate: redirectUrisValidator,
  },
  description: {
    type: String,
    default: 'No description provided.',
  },
  hostUris: {
    type: [String],
    unique: true,
    required: true,
    validate: hostUrisRegexValidator,
  },
  registrationToken: {
    type: String,
    unique: true,
    required: true,
  },
});

clientSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj._id;
  delete obj.__v;
  return obj;
};

// Checks if the redirect uri given belongs to the client
clientSchema.methods.isValidRedirectUri = function (this: IClient, redirectUri: string) {

  let urlFormatedRedirectUri = null;
  let extractedRedirectUri = null;
  let extractedHostUri = null;

  try {
    urlFormatedRedirectUri = new URL(redirectUri);
    extractedRedirectUri = urlFormatedRedirectUri.href.slice(urlFormatedRedirectUri.origin.length);
    extractedHostUri = urlFormatedRedirectUri.port === '' ?
     urlFormatedRedirectUri.origin + ':443' : urlFormatedRedirectUri.origin;
  } catch (err) {
    return false;
  }

  return (
    this.hostUris.indexOf(extractedHostUri) !== -1 &&
    this.redirectUris.indexOf(extractedRedirectUri) !== -1
  );
};

// Lowercase all the hostUris and redirectUris before validators and saving
clientSchema.pre<IClient>('validate', function validate(this: IClient, next: any) {

  let errorCatched = null;
  let validFormat = true;
  let index = 0;

  while (validFormat && index < this.hostUris.length) {

    try {
      const hostUrisAsURL = new URL(this.hostUris[index]);

      // Checking if the hostUri given is really hostUri and not full url
      if (hostUrisAsURL.origin === hostUrisAsURL.href.substring(0, hostUrisAsURL.href.length - 1)) {
        this.hostUris[index] = hostUrisAsURL.origin;

        if (!hostUrisAsURL.port) {
          this.hostUris[index] += ':443';
        }
      } else {
        errorCatched = new InvalidHostUri(`Invalid host uri given - ${this.hostUris[index]}${
                                          ''}, should be https://hostname and not full url`);
        validFormat = false;
      }
    } catch (err) {
      errorCatched = new InvalidHostUri(`Invalid host uri given - ${this.hostUris[index]}`);
      validFormat = false;
    }

    index += 1;
  }

  // Used for catching the invalid index when error occurred
  index = 0;

  while (validFormat && index < this.redirectUris.length) {

    try {
      this.redirectUris[index] = this.redirectUris[index].toLowerCase();
    } catch (err) {
      errorCatched =
        new InvalidRedirectUri(`Invalid redirect uri given - ${this.redirectUris[index]}`);
      validFormat = false;
    }

    index += 1;
  }

  next(errorCatched);
});

const clientModel = model<IClient>(collectionName, clientSchema);

export default clientModel;
