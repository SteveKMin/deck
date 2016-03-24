'use strict';

describe('awsServerGroupTransformer', function () {

  var transformer, vpcReader, $q, $scope;

  beforeEach(
    window.module(
      require('./serverGroup.transformer.js')
    )
  );

  beforeEach(function () {
    window.inject(function (_awsServerGroupTransformer_, _vpcReader_, _$q_, $rootScope) {
      transformer = _awsServerGroupTransformer_;
      vpcReader = _vpcReader_;
      $q = _$q_;
      $scope = $rootScope.$new();
    });
  });

  describe('normalize server group', function () {
    beforeEach(function() {
      spyOn(vpcReader, 'listVpcs').and.returnValue($q.when([
        {account: 'test', region: 'us-east-1', id: 'vpc-1', name: 'main'}
      ]));
    });

    it('adds vpc name to server group', function () {
      var serverGroup = {
        account: 'test',
        region: 'us-east-1',
        vpcId: 'vpc-1',
        instances: [],
      };
      transformer.normalizeServerGroup(serverGroup);
      $scope.$digest();
      expect(serverGroup.vpcName).toBe('main');
    });

    it('adds empty vpc name when no vpcId found on server group', function () {
      var serverGroup = {
        account: 'test',
        region: 'us-east-1',
        instances: [],
      };
      transformer.normalizeServerGroup(serverGroup);
      $scope.$digest();
      expect(serverGroup.vpcName).toBe('');
    });
  });

  describe('command transforms', function () {

    it('removes subnetType property when null', function () {
      var command = {
        viewState: {
          mode: 'create',
          useAllImageSelection: true,
          allImageSelection: 'something-packagebase',
        },
        subnetType: null,
        application: { name: 'theApp'}
      };

      var transformed = transformer.convertServerGroupCommandToDeployConfiguration(command);
      expect(transformed.subnetType).toBe(undefined);

      command.subnetType = 'internal';
      transformed = transformer.convertServerGroupCommandToDeployConfiguration(command);
      expect(transformed.subnetType).toBe('internal');
    });

  });

  describe('normalize server group details', function () {

    it('adds appropriate comparator to alarm', function () {
      var serverGroup = {
        scalingPolicies: [{
            alarms: [
              { comparisonOperator: 'LessThanThreshold' },
              { comparisonOperator: 'GreaterThanThreshold' },
              { comparisonOperator: 'LessThanOrEqualToThreshold' },
              { comparisonOperator: 'GreaterThanOrEqualToThreshold' },
              { comparisonOperator: 'WhatIsThis' },
            ]
          }]
      };
      transformer.normalizeServerGroupDetails(serverGroup);
      var alarms = serverGroup.scalingPolicies[0].alarms;
      expect(alarms.map(a => a.comparator)).toEqual(['&lt;', '&gt;', '&le;', '&ge;', undefined]);
    });

    it('adds operator, absAdjustment to simple policies', function () {
      var serverGroup = {
        scalingPolicies: [
            { scalingAdjustment: 10 },
            { scalingAdjustment: 0 },
            { scalingAdjustment: -5 }
          ]
      };
      transformer.normalizeServerGroupDetails(serverGroup);
      var policies = serverGroup.scalingPolicies;
      expect(policies.map(a => a.absAdjustment)).toEqual([10, 0, 5]);
      expect(policies.map(a => a.operator)).toEqual(['increase', 'increase', 'decrease']);
    });

    it('adds operator, absAdjustment to step policies', function () {
      var serverGroup = {
        scalingPolicies: [
          {
            stepAdjustments: [
              { scalingAdjustment: 10 },
              { scalingAdjustment: 0 },
              { scalingAdjustment: -5 }
          ]}
        ]
      };
      transformer.normalizeServerGroupDetails(serverGroup);
      var steps = serverGroup.scalingPolicies[0].stepAdjustments;
      expect(steps.map(a => a.absAdjustment)).toEqual([10, 0, 5]);
      expect(steps.map(a => a.operator)).toEqual(['increase', 'increase', 'decrease']);
    });
  });
});
