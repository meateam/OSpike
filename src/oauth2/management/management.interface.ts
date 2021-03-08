// management.interface

import { IClient } from '../../client/client.interface';
import { propertyOf } from '../../utils/objectUtils';

// Client information given by the user
export interface IClientBasicInformation {
  name: IClient['name'];
  redirectUris: IClient['redirectUris'];
  hostUris: IClient['hostUris'];
  description?: IClient['description'];
}

export const numIClientBasicInformationLength = 4;

// Type guard for client basic information
export const isIClientBasicInformation = (obj: any): obj is IClientBasicInformation => {
  return (
    obj &&
    (
      obj[propertyOf<IClientBasicInformation>('name')] &&
      typeof obj[propertyOf<IClientBasicInformation>('name')] === 'string'
    ) &&
    (
      obj[propertyOf<IClientBasicInformation>('redirectUris')] &&
      Array.isArray(obj[propertyOf<IClientBasicInformation>('redirectUris')]) &&
      obj[propertyOf<IClientBasicInformation>('redirectUris')].length > 0 &&
      typeof obj[propertyOf<IClientBasicInformation>('redirectUris')][0] === 'string'
    ) &&
    (
      obj[propertyOf<IClientBasicInformation>('hostUris')] &&
      Array.isArray(obj[propertyOf<IClientBasicInformation>('hostUris')]) &&
      obj[propertyOf<IClientBasicInformation>('hostUris')].length > 0 &&
      typeof obj[propertyOf<IClientBasicInformation>('hostUris')][0] === 'string'
    ) &&
    (
      (
        obj[propertyOf<IClientBasicInformation>('description')] &&
        typeof obj[propertyOf<IClientBasicInformation>('description')] === 'string' &&
        Object.keys(obj).length === numIClientBasicInformationLength    
      ) ||
      (
        Object.keys(obj).length === numIClientBasicInformationLength - 1
      )
    )
    // Uncomment this when scopes feature ready
    // obj[propertyOf<IClientBasicInformation>('scopes')] &&
    // Object.keys(obj).length === numIClientBasicInformationLength
  );
};

export const isPartialIClientBasicInformation =
  (obj: any): obj is Partial<IClientBasicInformation> => {
    const props = [
      propertyOf<IClientBasicInformation>('name'),
      propertyOf<IClientBasicInformation>('redirectUris'),
      propertyOf<IClientBasicInformation>('hostUris'),
      // Uncomment this when scopes feature ready
      // propertyOf<IClientBasicInformation>('scopes'),
    ];
    let numPropsFound = 0;

    if (!obj) {
      return false;
    }

    for (const prop of props) {
      numPropsFound += (obj.hasOwnProperty(prop)) ? 1 : 0;
    }

    // Checks if the properties of the object are only from the props array and
    // if the properties given is only from the props without any other properties
    return (numPropsFound === Object.keys(obj).length && numPropsFound <= props.length);
  };

// Whole client information needed in db
export interface IClientInformation extends IClientBasicInformation {
  id: IClient['id'];
  secret: IClient['secret'];
  audienceId: IClient['audienceId'];
  registrationToken: IClient['registrationToken'];
}
