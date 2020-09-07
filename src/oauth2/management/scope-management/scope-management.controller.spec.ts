// scope-management.controller.spec

import { expect } from 'chai';
import * as mongoose from 'mongoose';
import { URL } from 'url';
import { ScopeManagementController } from './scope-management.controller';
import { IScopeBasicInformation } from './scope-management.interface';
import { propertyOf, generateObjectSubsets } from '../../../utils/objectUtils';
import { deleteCollections } from '../../../test';
import clientModel from '../../../client/client.model';
import {
  collectionName as scopeCollectionName,
  ScopeType,
  IScope,
} from '../../../scope/scope.interface';
import config from '../../../config';


describe('Scope Management Operations Functionality', () => {

  const clientEx = new clientModel({
    name: 'clientEx',
    audienceId: 'clientExAudienceId',
    id: 'clientExId',
    secret: 'clientExSecret',
    registrationToken: 'clientExRegistrationToken',
    hostUris: ['https://clientEx.com'],
    redirectUris: ['/callback'],
  });

  const clientEx2 = new clientModel({
    name: 'clientEx2',
    audienceId: 'clientExAudienceId2',
    id: 'clientExId2',
    secret: 'clientExSecret2',
    registrationToken: 'clientExRegistrationToken2',
    hostUris: ['https://clientEx2.com'],
    redirectUris: ['/callback2'],
  });

  before(async () => {
    await deleteCollections();

    await clientEx.save();
    await clientEx2.save();
  });

  after(async () => {
    await deleteCollections();
  });

  describe.only('createScope()', () => {

    beforeEach(async () => {
      await deleteCollections([`${scopeCollectionName}s`]);
    });

    afterEach(async () => {
      await deleteCollections([`${scopeCollectionName}s`]);
    });

    it('Should create new scope', () => {
      const scopeValue = 'scopeValue';
      const descriptionValue = 'something';

      const createdScope = ScopeManagementController.createScope({
        value: scopeValue,
        audienceId: clientEx.audienceId,
        type: ScopeType.PRIVATE,
        description: descriptionValue,
        permittedClients: [clientEx2._id],
      });

      return Promise.all([
        expect(createdScope).to.eventually.exist,
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('value'))
        .that.equal(scopeValue),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('audienceId'))
        .that.equal(clientEx.audienceId),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('type'))
        .that.equal(ScopeType.PRIVATE),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('description'))
        .that.equal(descriptionValue),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('permittedClients'))
        .that.have.members([clientEx2._id]),
      ]);
    });

    it('Should create scope without optional params', () => {
      const scopeValue = 'scopeValue2';

      const createdScope = ScopeManagementController.createScope({
        value: scopeValue,
        audienceId: clientEx.audienceId,
        type: ScopeType.PRIVATE,
      });

      return Promise.all([
        expect(createdScope).to.eventually.exist,
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('value'))
        .that.equal(scopeValue),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('audienceId'))
        .that.equal(clientEx.audienceId),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('type'))
        .that.equal(ScopeType.PRIVATE),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('description'))
        .that.equal(config.DEFAULT_DESCRIPTION),
        expect(createdScope).to.eventually.have.property(propertyOf<IScope>('permittedClients'))
        .that.is.an('array').and.empty,
      ]);
    });

    it('Should ', () => {

    });

  });
});
