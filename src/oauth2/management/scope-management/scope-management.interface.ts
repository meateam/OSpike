// scope-management.interface

import { IScope } from '../../../scope/scope.interface';
import { propertyOf } from '../../../utils/objectUtils';

// Scope information given by the user
export interface IScopeBasicInformation {
  value: IScope['value'];
  audienceId: IScope['audienceId'];
  type: IScope['type'];
  description?: IScope['description'];
  permittedClients?: IScope['permittedClients'];
}

// Scope update information given by the user
export interface IScopeUpdateInformation extends
Pick<IScopeBasicInformation, Exclude<keyof IScopeBasicInformation, 'audienceId'>> {}

// Type guard for scope basic information
export const isIScopeBasicInformation = (obj: any): obj is IScopeBasicInformation => {
  return (
    obj &&
    obj[propertyOf<IScopeBasicInformation>('value')] &&
    obj[propertyOf<IScopeBasicInformation>('audienceId')] &&
    obj[propertyOf<IScopeBasicInformation>('type')]
  );
};

// Type guard for scope update information
export const isIScopeUpdateInformation = (obj: any): obj is IScopeUpdateInformation => {
  return (
    obj &&
    (
      obj[propertyOf<IScopeUpdateInformation>('value')] ||
      obj[propertyOf<IScopeUpdateInformation>('description')] ||
      obj[propertyOf<IScopeUpdateInformation>('permittedClients')]
    ) &&
    !!obj[propertyOf<IScopeBasicInformation>('audienceId')]
  );
};
