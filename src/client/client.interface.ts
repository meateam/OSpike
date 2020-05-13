// client.interface

import { IBaseModel } from '../generic/generic.interface';

export interface IClient extends IBaseModel {
  name: string; // Client name
  id: string; // Client id
  secret: string; // Client secret
  audienceId: string | IClient; // Audience id used for mention the client in access token
  redirectUris: string[]; // Redirect URIs of the client
  hostUris: string[]; // Host URIs of the client
  description: string; // Description of client
  registrationToken: string; // Registration token for the client for managing it
  isValidRedirectUri: (redirectUri: string) => boolean; // Model method for validating redirectUri
}

export const collectionName = 'Client';
