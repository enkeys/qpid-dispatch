/*
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
*/
'use strict';
/* global angular */
/**
 * @module QDR
 */
var QDR = (function(QDR) {

  /**
   * @method SettingsController
   * @param $scope
   * @param QDRServer
   *
   * Controller that handles the QDR settings page
   */

  QDR.module.controller('QDR.SettingsController', ['$scope', 'QDRService', 'QDRChartService', '$timeout', function($scope, QDRService, QDRChartService, $timeout) {

    $scope.connecting = false;
    $scope.connectionError = false;
    $scope.connectionErrorText = undefined;
    $scope.forms = {};

    $scope.formEntity = angular.fromJson(localStorage[QDR.SETTINGS_KEY]) || {
      address: '',
      port: '',
      username: '',
      password: '',
      autostart: false
    };
    $scope.formEntity.password = '';

    $scope.$watch('formEntity', function(newValue, oldValue) {
      if (newValue !== oldValue) {
        let pass = newValue.password;
        newValue.password = '';
        localStorage[QDR.SETTINGS_KEY] = angular.toJson(newValue);
        newValue.password = pass;
      }
    }, true);

    $scope.buttonText = function() {
      if (QDRService.management.connection.is_connected()) {
        return 'Disconnect';
      } else {
        return 'Connect';
      }
    };

    // connect/disconnect button clicked
    $scope.connect = function() {
      if (QDRService.management.connection.is_connected()) {
        $timeout( function () {
          QDRService.disconnect();
        });
        return;
      }

      if ($scope.settings.$valid) {
        $scope.connectionError = false;
        $scope.connecting = true;
        // timeout so connecting animation can display
        $timeout(function () {
          doConnect();
        });
      }
    };

    var doConnect = function() {
      QDR.log.info('doConnect called on connect page');
      if (!$scope.formEntity.address)
        $scope.formEntity.address = 'localhost';
      if (!$scope.formEntity.port)
        $scope.formEntity.port = 5673;

      var failed = function() {
        $timeout(function() {
          $scope.connecting = false;
          $scope.connectionErrorText = 'Unable to connect to ' + $scope.formEntity.address + ':' + $scope.formEntity.port;
          $scope.connectionError = true;
        });
      };
      let options = {address: $scope.formEntity.address, port: $scope.formEntity.port, reconnect: true};
      QDRService.connect(options)
        .then( function () {
          // register a callback for when the node list is available (needed for loading saved charts)
          QDRService.management.topology.addUpdatedAction('initChartService', function() {
            QDRService.management.topology.delUpdatedAction('initChartService');
            QDRChartService.init(); // initialize charting service after we are connected
          });
          // get the list of nodes
          QDRService.management.topology.startUpdating(false);
          // will have redirected to last known page or /overview
        }, function (e) {
          failed(e);
        });
    };
  }]);


  QDR.module.directive('posint', function() {
    return {
      require: 'ngModel',

      link: function(scope, elem, attr, ctrl) {
        // input type number allows + and - but we don't want them so filter them out
        elem.bind('keypress', function(event) {
          let nkey = !event.charCode ? event.which : event.charCode;
          let skey = String.fromCharCode(nkey);
          let nono = '-+.,';
          if (nono.indexOf(skey) >= 0) {
            event.preventDefault();
            return false;
          }
          // firefox doesn't filter out non-numeric input. it just sets the ctrl to invalid
          if (/[!@#$%^&*()]/.test(skey) && event.shiftKey || // prevent shift numbers
            !( // prevent all but the following
              nkey <= 0 || // arrows
              nkey == 8 || // delete|backspace
              nkey == 13 || // enter
              (nkey >= 37 && nkey <= 40) || // arrows
              event.ctrlKey || event.altKey || // ctrl-v, etc.
              /[0-9]/.test(skey)) // numbers
          ) {
            event.preventDefault();
            return false;
          }
        });
        // check the current value of input
        var _isPortInvalid = function(value) {
          let port = value + '';
          let isErrRange = false;
          // empty string is valid
          if (port.length !== 0) {
            let n = ~~Number(port);
            if (n < 1 || n > 65535) {
              isErrRange = true;
            }
          }
          ctrl.$setValidity('range', !isErrRange);
          return isErrRange;
        };

        //For DOM -> model validation
        ctrl.$parsers.unshift(function(value) {
          return _isPortInvalid(value) ? undefined : value;
        });

        //For model -> DOM validation
        ctrl.$formatters.unshift(function(value) {
          _isPortInvalid(value);
          return value;
        });
      }
    };
  });

  return QDR;
}(QDR || {}));
