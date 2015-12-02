/*
 ------------------------------------------------------------------------
 AngularJS logic for the quiz.

 NOTE This file uses some features of ECMAScript 6 (ES6) and must be
 transpiled by the Google traceur preprocessor before being deployed to
 a browser.
 ------------------------------------------------------------------------
 */

var app = angular.module('JsQuiz', ['ngSanitize', 'ngCookies', 'ngRoute']);

// ------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------

var DEFAULT_TITLE  = "Quiz";

var STEP_QUESTIONS = 'questions';
var STEP_INTRO     = 'intro';
var STEP_WRAP_UP   = 'wrap-up';
var MAX_CODE_TRIES = 3;

// Change this to modify the logging level.
var LOG_LEVEL      = log4javascript.Level.DEBUG;

// Aliases
var LOG_TRACE      = log4javascript.Level.TRACE;
var LOG_DEBUG      = log4javascript.Level.DEBUG;
var LOG_INFO       = log4javascript.Level.INFO;
var LOG_WARN       = log4javascript.Level.WARN;
var LOG_ERROR      = log4javascript.Level.ERROR;
var LOG_FATAL      = log4javascript.Level.FATAL;

// ------------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------------

app.config(function($routeProvider) {

  $routeProvider.when("/intro", {
    templateUrl: "_intro.html",
    controller:  "IntroCtrl",
    step:        STEP_INTRO,
    resolve:     {
      "quizData": function(quizDataService) { return quizDataService(); }
    }
  })
  .when("/quiz/:num", {
    templateUrl: "_quiz.html",
    controller:  "QuizCtrl",
    step:        STEP_QUESTIONS,
    resolve:     {
      "quizData": function(quizDataService) { return quizDataService(); }
      }
  })
  .when("/wrap-up", {
    templateUrl: "_wrapUp.html",
    controller:  "WrapUpCtrl",
    step:        STEP_WRAP_UP,
    resolve:     {
    "quizData": function(quizDataService) { return quizDataService(); }
    }
  })
  .when("/reset", {
    controller: "ResetCtrl",
    template:   "<div></div>"
  })
  .otherwise({
    redirectTo: "/intro"
  });

});

// ------------------------------------------------------------------------
// Services
// ------------------------------------------------------------------------

// Manage the current state.
app.factory('stateService', function($cookies, $location, $route) {

  var state           = {};
  var stepToRoutePath = {}; // Lookup table

  function initState() {
    state = {
      step:           STEP_INTRO,
      questionIndex:  null,
      tries:          0, // only applicable to certain kinds of questions
      answers:        {}
    }
  }

  function lookupRoutes() {
    var routeKeys = _.keys($route.routes);
    var stepKeys  = _.filter(routeKeys, function(key) {
      return 'step' in $route.routes[key];
    });
    var stepRoutes = _.map(stepKeys, function(path) {
      var r = $route.routes[path];
      stepToRoutePath[r.step] = path;
    });

    console.log('stepRoutes=', stepToRoutePath);
  }

  initState();
  lookupRoutes();

  if ($cookies.savedState) {
    try {
      state = JSON.parse($cookies.savedState);
      console.log("Restored state ", state);
    }
    catch (e) {
      console.log("Unable to parse saved state: " + e.message);
    }
  }

  function saveState(state) {
    $cookies.savedState = JSON.stringify(state);
  }

  function saveStep(step, questionIndex) {
    if (questionIndex === undefined) questionIndex = 0;
    state.step          = step;
    state.questionIndex = questionIndex;

    saveState(state);
  }

  function pathForStep(step, questionIndex) {
    if (questionIndex === undefined) questionIndex = 0;
    var path = stepToRoutePath[step];
    if (path) {
      path = path.replace(":num", questionIndex + 1);
    }

    return path;
  }

  return {
    saveStep: function (step, questionIndex) {
      if (questionIndex === undefined) questionIndex = 0;
      saveStep(step, questionIndex);
    },

    saveAnswer: function(answer) {
      var index = answer.questionIndex;
      state.answers["q" + index] = answer;
      saveState(state, index);
    },

    saveTries: function(tries) {
      state.tries = tries;
      saveState(state, state.questionIndex);
      console.log("Saved tries " + tries, state);
    },

    getAnswer: function(questionIndex) {
      return state.answers["q" + questionIndex];
    },

    getState: function() {
      return state;
    },

    resetState: function() {
      initState();
      saveState(state);
      console.log("Reset state to ", state);
    },

    pathForStep: function(step, questionIndex) {
      if (questionIndex === undefined) questionIndex = 0;
      return pathForStep(step, questionIndex);
    },

    redirectToStep: function(step, questionIndex) {
      if (questionIndex === undefined) questionIndex = 0;
      var path = pathForStep(step, questionIndex);
      if (path) {
        saveStep(step, questionIndex);
        console.log("Redirecting to " + path);
        $location.path(path);
      }
      else {
        console.log("(BUG) No path for step " + step);
      }
    }
  }
});

// Check the current state, redirecting if it isn't correct.
app.factory('checkState', function(stateService, $location) {
  return function() {
    var state = stateService.getState();

    function conditionallyRedirect(path) {
      if ($location.path() !== path) {
        console.log("Redirecting to " + path);
        $location.path(path);
        return true;
      }

      return false;
    }

    switch (state.step) {
      case STEP_INTRO:
        return conditionallyRedirect(stateService.pathForStep(STEP_INTRO));
        break;

      case STEP_QUESTIONS:
        var path = stateService.pathForStep(STEP_QUESTIONS, state.questionIndex);
        return conditionallyRedirect(path);

      case 'wrap-up':
        return conditionallyRedirect(stateService.pathForStep(STEP_WRAP_UP));

      default:
        stateService.resetState();
        stateService.redirectToStep(STEP_INTRO);
        return true;
    }
  }
});

// Intended to be used by routing. Loads the quiz data (once) and makes it
// available as a function returning a promise. The routing logic will then
// take the result of that promise and inject it into any controller that
// asks for it.
app.factory('quizDataService', function($http, $q, logging) {

  var log = logging.logger('questions');

  function validateAndProcessQuestions(questions) {

    function validateRequiredKeys(question, index, keys) {
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        if (! question[k])
          throw new Error("Missing required " + k + " key in question " + index);
      }
    }

    function validateAndAugmentCodeQuestion(q) {
      validateRequiredKeys(q, i, ['question', 'wrapper', 'token',
                                  'correctCode', 'expectedAnswer']);

      q.tries = 0;
      q.maxTries = MAX_CODE_TRIES;
      q.triesLeft = function() {
        return q.maxTries - q.tries;
      };

      return q;
    }

    function validateAndAugmentChoiceQuestion(q) {
      validateRequiredKeys(q, i, ['question', 'answers']);
      for (var i = 0; i < q.answers.length; i++) {
        var a = q.answers[i];
        if (! (a.answer && (typeof a.correct === 'boolean'))) {
          throw new Error("Malformed answers section in question " + i);
        }
      }

      return q;
    }

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      if (! q.type) {
        throw new Error("Missing " + type + " field in question " + i);
      }

      switch (q.type) {
        case 'jscode':
          validateAndAugmentCodeQuestion(q);
          break;

        case 'choice':
          validateAndAugmentChoiceQuestion(q);
          break;
      }
    }

    return questions;
  }

  function loadQuestions() {
    var deferred = $q.defer();

    log.debug("Loading questions from server.");
    $http
      .get("quiz.txt")
      .success(function(data) {
        var decodedData = JSON.parse(window.atob(data));
        var questions = validateAndProcessQuestions(decodedData.questions);
        log.debug("Loaded " + questions.length +  "questions.");
        decodedData.questions = questions;
        deferred.resolve(decodedData);
      })
      .error(function(data) {
        log.error("Failed to load questions.");
        deferred.reject("Failed to load questions.");
      });

    return deferred.promise;
  }

  var promise = loadQuestions();

  return function() {
    return promise;
  }
});

// Logging.
app.factory('logging', function() {

  var log      = log4javascript.getLogger();
  var appender = new log4javascript.BrowserConsoleAppender();

  log4javascript.setShowStackTraces(true);

  appender.setLayout(
    new log4javascript.PatternLayout("%d{HH:mm:ss} (%-5p) %c: %m")
  );
  log.addAppender(appender);

  appender.setThreshold(LOG_LEVEL);

  return {
    logger: function(name, level) {
      if (level === undefined) level = LOG_DEBUG;
      var logger = log4javascript.getLogger(name);
      logger.addAppender(appender);
      logger.setLevel(level);
      return logger;
    }
  }
});

// ------------------------------------------------------------------------
// Controllers
// ------------------------------------------------------------------------

// The head controller controls the substitutions in the <head> element
// (mostly just the <title> element). It must access the quizData service
// directly, rather than via the $routeProvider magic, because there's no
// no URL associated with this controller.
app.controller('HeadCtrl', function($scope, quizDataService) {
  // The data service is callable directly as a function. It returns a promise,
  // so we have to wait for the promise to complete.

  quizDataService().then(function(quizData) {
    $scope.title = quizData.title || DEFAULT_TITLE;
  })
});

// The body controller is an outer controller. It exists primarily to control
// the substitutions in the <body> element that aren't subject to other
// controllers. Like the HeadCtrl, BodyCtrl must access the quizData service
// directly, rather than via the $routeProvider magic, because there's no
// no URL associated with this controller.
app.controller('BodyCtrl', function($scope, quizDataService) {
  // The data service is callable directly as a function. It returns a promise,
  // so we have to wait for the promise to complete.

  quizDataService().then(function(quizData) {
    $scope.heading = quizData.title || DEFAULT_TITLE;
  });
});

app.controller('ResetCtrl', function(stateService, $location) {
  stateService.resetState();
  $location.path('/');
});

app.controller('IntroCtrl',
  function($scope, stateService, checkState, logging, quizData) {
    if (checkState()) return;

    var log = logging.logger('IntroCtrl');

    stateService.saveStep(STEP_INTRO);

    $scope.gotoFirstQuestion = function() {
      stateService.redirectToStep(STEP_QUESTIONS, 0);
    }

    var questions = quizData.questions;
    $scope.totalQuestions = questions.length;
    $scope.intro = quizData.intro;
  }
);

app.controller('WrapUpCtrl',
  function($scope, stateService, checkState, quizData, logging) {
    if (checkState()) return checkState();

    var log = logging.logger('WrapUpCtrl');

    var questions = quizData.questions;

    $scope.wrapUp = quizData.wrapUp;

    log.debug("WrapUpCtrl: questions=", questions);
    var answers = stateService.getState().answers;
    log.debug("WrapUpCtrl: answers=", answers);

    // Filter the list of incorrect answers and augment it with information
    // more suitable to the view.

    var incorrectAnswers = _.filter(answers, function(a) { return !a.correct; });
    log.debug("WrapUpCtrl: incorrectAnswers", incorrectAnswers);
    var totalAnswers = _.keys(answers).length;
    $scope.totalCorrect = totalAnswers - incorrectAnswers.length;
    log.debug('WrapUpCtrl: correct', $scope.totalCorrect);
    $scope.score = Math.round(($scope.totalCorrect * 100) / totalAnswers);
    log.debug('WrapUpCtrl: score', $scope.score);
    $scope.totalQuestions = questions.length;

    if (incorrectAnswers.length === 0)
      $scope.incorrectAnswers = null;

    else {
      $scope.incorrectAnswers = _.filter(incorrectAnswers, function(a) {
        var i = a.questionIndex;
        var question = questions[i];
        a.question = question.question;
        a.questionType = question.type;

        switch (question.type) {
          case 'jscode':
            a.correctAnswer   = question.correctCode;
            a.incorrectAnswer = a.answer;
            break;

          case 'choice':
            var correctAnswer = _.filter(question.answers,
                                         function(a) { return a.correct; })[0];
            a.correctAnswer   = correctAnswer.answer;
            a.incorrectAnswer = question.answers[parseInt(a.answer)].answer;
            break;
        }

        return a;
      });
    }
  }
);

app.controller('QuizCtrl',
  function($scope, stateService, checkState, quizData, $routeParams, logging) {

    if (checkState()) return checkState();

    var log = logging.logger('QuizCtrl');

    var questions      = quizData.questions;
    var questionNumber = $routeParams.num;
    var questionIndex  = questionNumber - 1;
    var testedValue    = null;

    if (questionIndex >= questions.length)
      stateService.redirectToStep(STEP_WRAP_UP);

    var state = stateService.getState();

    $scope.currentQuestion = questions[questionIndex];
    $scope.questionIndex   = questionIndex;

    var answer = stateService.getAnswer(questionIndex);

    if (answer) {
      // Restore the settings, so they're reflected in the view. (This might
      // be a reload.)
      $scope.currentQuestion.recorded  = true;
      $scope.currentQuestion.isCorrect = answer.correct;
      $scope.currentQuestion.answer    = answer.answer;
    }

    if ($scope.currentQuestion.type === 'jscode')
      $scope.currentQuestion.tries = state.tries || 0;

    log.debug("currentQuestion", $scope.currentQuestion);

    function multipleChoiceIsCorrect(question) {
      // The answer to a multiple choice question is the index of the choice.
      var userAnswer = question.answers[question.answer];
      return userAnswer.correct;
    }

    function codeAnswerIsCorrect(question) {
      log.debug("answer is: ", question.answer);
      var code = question.wrapper.replace(question.token, question.answer);
      log.debug("Evaluating: ", code);
      try {
        var result = eval(code);
        return result === eval(question.expectedAnswer);
      }
      catch (e) {
        log.debug("Eval of question ", question.question, " failed.", e);
        return false;
      }
    }

    // Called when the Test Answer button is pressed on a code question page.
    $scope.testCodeAnswer = function(question) {
      if (question.tries < question.maxTries) {
        question.tries++;
        stateService.saveTries(question.tries);
        question.isCorrect = codeAnswerIsCorrect(question);
        testedValue = question.answer;
      }
    }

    var showTryResult = function(question, correct) {
      if ((question.type === 'choice') ||
          ((question.tries === 0) && (!question.recorded)) ||
          (question.isCorrect !== correct)) {
        return false;
      }

      return true;
    }

    var showAnswerStatus = function(question, correct) {
      switch (question.type) {
        case 'jscode':
          return showTryResult(question, correct);
        case 'choice':
          return question.recorded && (question.isCorrect === correct);
      }
    }

    $scope.showIncorrectAnswerStatus = function() {
      return showAnswerStatus($scope.currentQuestion, false);
    }

    $scope.showCorrectAnswerStatus = function() {
      return showAnswerStatus($scope.currentQuestion, true);
    }

    // Record an answer.
    $scope.recordAnswer = function() {
      var question = $scope.currentQuestion;
      var correct = false;
      switch (question.type) {
        case 'choice':
          correct = multipleChoiceIsCorrect(question);
          break;

        case 'jscode':
          correct = codeAnswerIsCorrect(question);
          break;
      }

      var answer = {
        correct:       correct,
        questionIndex: $scope.questionIndex,
        answer:        question.answer
      };

      stateService.saveAnswer(answer);

      $scope.currentQuestion.recorded = true;
      $scope.currentQuestion.isCorrect = correct;
    }

    $scope.next = function() {
      log.debug("next: questionIndex=" + questionIndex + ", total=" +
                questions.length);
      if (questionIndex >= questions.length) {
        // Last question. Over to wrap-up.
        stateService.redirectToStep(STEP_WRAP_UP);
      }
      else {
        stateService.saveTries(0);
        stateService.redirectToStep(STEP_QUESTIONS, questionIndex + 1);
      }
    }
  }
);
