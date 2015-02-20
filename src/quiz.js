var app = angular.module('JsQuiz', ['ngSanitize']);

app.controller('QuizCtrl', ng(function($scope, $http, $sce) {
  $scope.step = 'intro';

  $scope.questions = null;
  let question = 0;

  $http.get("questions.json").success((data) => {
    $scope.questions = data.questions;
  });

  $scope.startQuiz = () => {
    $scope.step = "questions";
    $scope.currentQuestion = $scope.questions[question]
  }
}));

 /*
 jQuery(document).ready(function($) {

 // Load the configuration.

 var config = $("#quiz-config");
  if (config.length === 0) {
    throw new Error("Missing #quiz-config");
  }

  var currentQuestion = null;
  var sum             = 0;
  var sumElement      = $(config.data('score-element'));
  var showDuration    = config.data('show-transition-duration');
  var sShowDuration   = config.data('show-transition-duration');
  var showDuration    = 0;
  var showEffect      = config.data('show-transition-effect');
  var showEasing      = config.data('show-transition-easing');
  var sHideDuration   = config.data('hide-transition-duration');
  var hideDuration    = 0;
  var hideEffect      = config.data('hide-transition-effect');
  var hideEasing      = config.data('hide-transition-easing');

  if (sShowDuration)
    showDuration = parseInt(sShowDuration);
  if (sHideDuration)
    hideDuration = parseInt(sHideDuration);

  var prefix = config.data('prefix');
  if (prefix.length === 0) prefix = "quiz";


  var hideOptions = null
  if (hideDuration > 0) {
    hideOptions = {
      effect:   hideEffect,
      easing:   hideEasing,
      duration: hideDuration
    }
  }

  var showOptions = null;
  if (showDuration > 0) {
    showOptions = {
      effect:   showEffect,
      easing:   showEasing,
      duration: showDuration
    }
  }

  var intro = $("#" + prefix + "-intro");
  if (intro.length > 0) {
    console.log("Showing intro: " + intro.attr('id'));
    intro.show();
  }


});
*/
