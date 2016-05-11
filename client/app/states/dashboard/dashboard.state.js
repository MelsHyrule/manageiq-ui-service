(function() {
  'use strict';

  angular.module('app.states')
    .run(appRun);

  /** @ngInject */
  function appRun(routerHelper) {
    routerHelper.configureStates(getStates());
  }

  function getStates() {
    return {
      'dashboard': {
        parent: 'application',
        url: '/',
        templateUrl: 'app/states/dashboard/dashboard.html',
        controller: StateController,
        controllerAs: 'vm',
        title: N_('Dashboard'),
        data: {
          requireUser: true
        },
        resolve: {
          definedServiceIdsServices: resolveServicesWithDefinedServiceIds,
          retiredServices: resolveRetiredServices,
          expiringServices: resolveExpiringServices,
          pendingRequests: resolvePendingRequests,
          approvedRequests: resolveApprovedRequests,
          deniedRequests: resolveDeniedRequests
        }
      }
    };
  }

  /** @ngInject */
  function resolvePendingRequests(CollectionsApi, $state) {
    if (!$state.navFeatures.requests.show) {
      return undefined;
    }

    return [pendingRequestsForServiceTemplateProvisionRequest(CollectionsApi),
            pendingRequestsForServiceReconfigureRequest(CollectionsApi)];
  }

  function pendingRequestsForServiceTemplateProvisionRequest(CollectionsApi) {
    var filterValues = ['type=ServiceTemplateProvisionRequest', 'approval_state=pending_approval'];
    var options = {expand: false, filter: filterValues };

    return CollectionsApi.query('requests', options);
  }

  function pendingRequestsForServiceReconfigureRequest(CollectionsApi) {
    var filterValues = ['type=ServiceReconfigureRequest', 'approval_state=pending_approval'];
    var options = {expand: false, filter: filterValues };

    return CollectionsApi.query('requests', options);
  }

  /** @ngInject */
  function resolveApprovedRequests(CollectionsApi, $state) {
    if (!$state.navFeatures.requests.show) {
      return undefined;
    }

    return [approvedRequestsForServiceTemplateProvisionRequest(CollectionsApi),
            approvedRequestsForServiceReconfigureRequest(CollectionsApi)];
  }

  function approvedRequestsForServiceTemplateProvisionRequest(CollectionsApi) {
    var filterValues = ['type=ServiceTemplateProvisionRequest', 'approval_state=approved'];
    var options = {expand: false, filter: filterValues };

    return CollectionsApi.query('requests', options);
  }

  function approvedRequestsForServiceReconfigureRequest(CollectionsApi) {
    var filterValues = ['type=ServiceReconfigureRequest', 'approval_state=approved'];
    var options = {expand: false, filter: filterValues };

    return CollectionsApi.query('requests', options);
  }

  /** @ngInject */
  function resolveDeniedRequests(CollectionsApi, $state) {
    if (!$state.navFeatures.requests.show) {
      return undefined;
    }

    return [deniedRequestsForServiceTemplateProvisionRequest(CollectionsApi),
            deniedRequestsForServiceReconfigureRequest(CollectionsApi)];
  }

  function deniedRequestsForServiceTemplateProvisionRequest(CollectionsApi) {
    var filterValues = ['type=ServiceTemplateProvisionRequest', 'approval_state=denied'];
    var options = {expand: false, filter: filterValues };

    return CollectionsApi.query('requests', options);
  }

  function deniedRequestsForServiceReconfigureRequest(CollectionsApi) {
    var filterValues = ['type=ServiceReconfigureRequest', 'approval_state=denied'];
    var options = {expand: false, filter: filterValues };

    return CollectionsApi.query('requests', options);
  }

  /** @ngInject */
  function resolveExpiringServices(CollectionsApi, $filter, $state) {
    if (!$state.navFeatures.services.show) {
      return undefined;
    }
    var currentDate = new Date();
    var date1 = 'retires_on>=' + $filter('date')(currentDate, 'yyyy-MM-dd');

    var days30 = currentDate.setDate(currentDate.getDate() + 30);
    var date2 = 'retires_on<=' + $filter('date')(days30, 'yyyy-MM-dd');
    var options = {expand: false, filter: ['service_id=nil', date1, date2]};

    return CollectionsApi.query('services', options);
  }

  /** @ngInject */
  function resolveRetiredServices(CollectionsApi, $state) {
    if (!$state.navFeatures.services.show) {
      return undefined;
    }
    var options = {expand: false, filter: ['service_id=nil', 'retired=true'] };

    return CollectionsApi.query('services', options);
  }

  /** @ngInject */
  function resolveServicesWithDefinedServiceIds(CollectionsApi, $state) {
    if (!$state.navFeatures.services.show) {
      return undefined;
    }
    var options = {expand: false, filter: ['service_id=nil'] };

    return CollectionsApi.query('services', options);
  }

  function chainRequestPromises(promiseArray, vm, type) {
    var count = 0;
    if (promiseArray.length > 0) {
      promiseArray[0].then(function success(data) {
        count = data.subcount;
        promiseArray[1].then(function success(data) {
          count += data.subcount;
          vm.requestsCount[type] = count;
          vm.requestsCount.total += count;
        });
      });
    }
  }

  /** @ngInject */
  function StateController($state, RequestsState, ServicesState, definedServiceIdsServices, retiredServices,
    expiringServices, pendingRequests, approvedRequests, deniedRequests, lodash) {
    var vm = this;
    if (angular.isDefined(definedServiceIdsServices)) {
      vm.servicesCount = {};
      vm.servicesFeature = false;
      vm.servicesCount.total = 0;
      vm.servicesCount.current = 0;
      vm.servicesCount.retired = 0;
      vm.servicesCount.soon = 0;

      if (definedServiceIdsServices.subcount > 0) {
        vm.servicesCount.total = definedServiceIdsServices.subcount;

        vm.servicesCount.retired = retiredServices.subcount;

        vm.servicesCount.soon = expiringServices.subcount;
        
        vm.servicesCount.current = vm.servicesCount.total - vm.servicesCount.retired - vm.servicesCount.soon;
      }

      vm.servicesFeature = true;
    }

    vm.requestsFeature = false;

    if (angular.isDefined(pendingRequests) &&
        angular.isDefined(approvedRequests) &&
        angular.isDefined(deniedRequests)) {
      vm.requestsCount = {};
      vm.requestsCount.total = 0;

      var allRequests = [pendingRequests, approvedRequests, deniedRequests];
      var allRequestTypes = ['pending', 'approved', 'denied'];

      lodash.times(3, function(n) {
        chainRequestPromises(allRequests[n], vm, allRequestTypes[n]);
      });

      vm.requestsFeature = true;
    }

    vm.title = __('Dashboard');

    vm.navigateToRequestsList = function(filterValue) {
      RequestsState.setFilters([{'id': 'approval_state', 'title': __('Request Status'), 'value': filterValue}]);
      RequestsState.filterApplied = true;
      $state.go('requests.list');
    };

    vm.navigateToServicesList = function(filterValue) {
      ServicesState.setFilters([{'id': 'retirement', 'title': __('Retirement Date'), 'value': filterValue}]);
      ServicesState.filterApplied = true;
      $state.go('services.list');
    };
  }
})();
