// scope-management.controller

import {
  IScopeBasicInformation,
  IScopeUpdateInformation,
  isIScopeBasicInformation,
  isIScopeUpdateInformation,
} from './scope-management.interface';
import scopeModel from '../../../scope/scope.model';
import { propertyOf } from '../../../utils/objectUtils';
import { IScope } from '../../../scope/scope.interface';
import { collectionName as clientModelName } from '../../../client/client.interface';
import { InvalidScopeInformation } from './scope-management.error';

export class ScopeManagementController {

  /**
   * Getting scopes belongs to client by client id
   * @param clientId - the client id of the scope owner
   */
  static async getScopesByClientId(clientId: string) {
    return await scopeModel.aggregate(
      [
        {
          $lookup: {
            from: `${clientModelName.toLowerCase()}s`,
            localField: propertyOf<IScope>('audienceId'),
            foreignField: propertyOf<IScope>('audienceId'),
            as: propertyOf<IScope>('audienceId'),
          },
        },
        {
          $unwind: {
            path: `$${propertyOf<IScope>('audienceId')}`,
          },
        },
        {
          $match: {
            [`${propertyOf<IScope>('audienceId')}.id`]: clientId,
          },
        },
      ],
    );
  }

  /**
   * Getting scopes belongs to client by audience id
   * @param audienceId - the audience id of the scope owner
   */
  static async getScopesByAudienceId(audienceId: string) {
    return await scopeModel.find({ audienceId });
  }

  /**
   * Getting scope by object id
   * @param scopeId - object id of the scope
   */
  static async getScopeById(scopeId: string) {
    return await scopeModel.find({ _id: scopeId });
  }

  /**
   * Creates a new scope for specified client id and given information
   * @param scopeInformation - the scope information
   */
  static async createScope(scopeInformation: IScopeBasicInformation) {
    if (isIScopeBasicInformation(scopeInformation)) {
      const currentScope = await new scopeModel(scopeInformation).save();
      return currentScope;
    }

    throw new InvalidScopeInformation('Invalid scope information given.');
  }

  /**
   * Updating scope information for existing scope
   * @param audienceId - The audience id of the scope.
   * @param value - The value of the scope.   
   * @param scopeInformation - the scope update information
   */
  static async updateScope(audienceId: string, value: string, scopeInformation: IScopeUpdateInformation) {

    if (isIScopeUpdateInformation(scopeInformation)) {

      // Currently setting only the permitted clients and description (if passed)
      const currentScope = await scopeModel.updateOne(
        { audienceId, value },
        {
          $set: {
            permittedClients: [...new Set(scopeInformation.permittedClients as string[])],
            ...(scopeInformation.description ? { description: scopeInformation.description } : {}),
          },
        },
        { new: true },
      );

      return currentScope;
    }

    throw new InvalidScopeInformation('Invalid scope update information given.');
  }

  /**
   * Deleting existing scope
   * @param audienceId - the scope's audience id
   * @param value - the scope's value
   */
  static async deleteScope(audienceId: string, value: string) {
    const deletedScope = await scopeModel.findOneAndRemove({ audienceId, value });

    if (deletedScope) {
      return true;
    }

    return false;
  }

}
