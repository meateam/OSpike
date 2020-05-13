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
   * @param scopeId - the scope's object id
   * @param scopeInformation - the scope update information
   */
  static async updateScope(scopeId: string, scopeInformation: IScopeUpdateInformation) {
    if (isIScopeUpdateInformation(scopeInformation)) {
      const currentScope = await scopeModel.updateOne({ _id: scopeId }, { $set: scopeInformation });
      return currentScope;
    }

    throw new InvalidScopeInformation('Invalid scope update information given.');
  }

  /**
   * Deleting existing scope
   * @param scopeId - the scope's object id
   */
  static async deleteScope(scopeId: string) {
    const deletedScope = await scopeModel.findOneAndRemove({ _id: scopeId });

    if (deletedScope) {
      return true;
    }

    return false;
  }

}
