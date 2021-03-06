// scope.model

import { Schema, model } from 'mongoose';
import { collectionName as ClientModelName } from '../client/client.interface';
import { IScope, collectionName, ScopeType } from './scope.interface';
import { clientRefValidatorByAudId, clientRefValidatorByClientId } from '../client/client.validator';

const scopeSchema = new Schema(
  {
    value: {
      type: String,
      required: true,
    },
    audienceId: {
      type: String,
      ref: ClientModelName,
      required: true,
      validate: clientRefValidatorByAudId as any,
    },
    permittedClients: {
      type: [{ type: String, ref: ClientModelName, validate: clientRefValidatorByClientId }],
      required: true,
      default: [],
    },
    description: {
      type: String,
      default: 'No description provided',
    },
    type: {
      type: String,
      enum: Object.keys(ScopeType),
      default: ScopeType.PRIVATE,
    },
  },
  {
    toObject: { virtuals: true },
    toJSON: { virtuals: true },
  },
);

// Ensures there's only one unique scope value for unique client (by audienceId field)
scopeSchema.index({ value: 1, audienceId: 1 }, { unique: true });

// Virtual field for audience client validations and population
scopeSchema.virtual('audienceClient', {
  ref: ClientModelName,
  localField: 'audienceId',
  foreignField: 'audienceId',
  justOne: true,
});

const scopeModel = model<IScope>(collectionName, scopeSchema);

export default scopeModel;
