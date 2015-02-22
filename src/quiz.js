var app = angular.module('JsQuiz', ['ngSanitize', 'ngCookies', 'ngRoute']);

// ------------------------------------------------------------------------
// Constants
// ------------------------------------------------------------------------

var STEP_QUESTIONS = 'questions';
var STEP_INTRO     = 'intro';
var STEP_WRAP_UP   = 'wrap-up';

// ------------------------------------------------------------------------
// Configuration
// ------------------------------------------------------------------------

app.config(function($routeProvider) {

  function validateAndProcessQuestions(questions) {

    function validateRequiredKeys(question, index, keys) {
      for (let k of keys) {
        if (! question[k])
          throw new Error(`Missing required "${k}" key in question ${index}.`);
      }
    }

    function validateAndAugmentCodeQuestion(q) {
      validateRequiredKeys(q, i, ['question', 'wrapper', 'token',
                                  'correctCode', 'expectedAnswer']);

      q.tries = 0;
      q.maxTries = 3;
      q.triesLeft = function() {
        return q.maxTries - q.tries;
      };

      return q;
    }

    function validateAndAugmentChoiceQuestion(q) {
      validateRequiredKeys(q, i, ['question', 'answers']);
      for (let a of q.answers) {
        if (! (a.answer && (typeof a.correct === 'boolean'))) {
          throw new Error(`Malformed answers section in question ${i}.`);
        }
      }

      return q;
    }

    for (let i = 0; i < questions.length; i++) {
      let q = questions[i];
      if (! q.type) {
        throw new Error(`Missing "type" field in question ${i}.`);
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

  function loadQuestions($http, $q) {
    let deferred = $q.defer();

    $http
      .get("questions.base64")
      .success((data) => {
        let decodedData = JSON.parse(window.atob(data));
        let questions = validateAndProcessQuestions(decodedData.questions);
        deferred.resolve(questions);
      })
      .error((data) => {
        deferred.reject("Failed to load questions.");
      });

    return deferred.promise;
  }

  $routeProvider.when("/intro", {
    templateUrl: "_intro.html",
    controller:  "IntroCtrl",
    step:        STEP_INTRO
  })
  .when("/quiz/:num", {
    templateUrl: "_quiz.html",
    controller:  "QuizCtrl",
    step:        STEP_QUESTIONS,
    resolve:     {
      "questions": ($http, $q) => { return loadQuestions($http, $q); }
      }
  })
  .when("/wrap-up", {
    templateUrl: "_wrapUp.html",
    controller:  "WrapUpCtrl",
    step:        STEP_WRAP_UP
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

app.factory('stateService', function($cookies, $location, $route) {

  var state           = {};
  var stepToRoutePath = {}; // Lookup table

  function initState() {
    state = {
      step:           STEP_INTRO,
      questionIndex:  null,
      answers:        {}
    }
  }

  function lookupRoutes() {
    let routeKeys = _.keys($route.routes);
    let stepKeys  = _.filter(routeKeys, (key) => {
      return 'step' in $route.routes[key];
    });
    let stepRoutes = _.map(stepKeys, (path) => {
      let r = $route.routes[path];
      stepToRoutePath[r.step] = path;
    });

    console.log('stepRoutes=', stepToRoutePath);
  }

  initState();
  lookupRoutes();

  if ($cookies.savedState) {
    try {
      state = JSON.parse($cookies.savedState)
      console.log("Restored state ", state);
    }
    catch (e) {
      console.log(`Unable to parse saved state: ${e.message}`);
    }
  }

  function saveState(state) {
    $cookies.savedState = JSON.stringify(state);
  }

  function saveStep(step, questionIndex=0) {
    state.step          = step;
    state.questionIndex = questionIndex;

    saveState(state);
  }

  function pathForStep(step, questionIndex=0) {
    let path = stepToRoutePath[step];
    if (path) {
      path = path.replace(":num", questionIndex + 1);
    }

    return path;
  }

  return {
    saveStep: (step, questionIndex=0) => {
      saveStep(step, questionIndex);
    },

    saveAnswer: (answer) => {
      let index = answer.questionIndex;
      state.answers[`q${index}`] = answer;
      console.log("Recorded answer ", answer, " for index ", index);
      saveState(state, index);
      console.log("state is now", $cookies.savedState);
    },

    getAnswer: (questionIndex) => {
      return state.answers[`q${questionIndex}`];
    },

    getState: () => {
      return state;
    },

    resetState: () => {
      initState();
      saveState(state);
      console.log("Reset state to ", state);
    },

    pathForStep: (step, questionIndex=0) => {
      return pathForStep(step, questionIndex);
    },

    redirectToStep: (step, questionIndex=0) => {
      let path = pathForStep(step, questionIndex);
      if (path) {
        saveStep(step, questionIndex);
        console.log(`Redirecting to ${path}`);
        $location.path(path);
      }
      else {
        console.log(`(BUG) No path for step ${step}`);
      }
    }
  }
});

app.factory('checkState', function(stateService, $location) {
  return function() {
    let state = stateService.getState();

    console.log(`(checkState) ${$location.path()}`);
    console.log("(checkState) state=", state);

    function conditionallyRedirect(path) {
      if ($location.path() !== path) {
        console.log(`Redirecting to ${path}`);
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
        let path = stateService.pathForStep(STEP_QUESTIONS, state.questionIndex);
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

// ------------------------------------------------------------------------
// Controllers
// ------------------------------------------------------------------------

app.controller('ResetCtrl', function(stateService, $location) {
  stateService.resetState();
  $location.path('/');
});

app.controller('IntroCtrl',
  function($scope, $location, stateService, checkState) {
    if (checkState()) return;

    console.log("After checkState()");
    stateService.saveStep(STEP_INTRO);

    $scope.gotoFirstQuestion = () => {
      stateService.redirectToStep(STEP_QUESTIONS, 0);
    }
  }
);

app.controller('WrapUpCtrl',
  function($scope, $location, stateService, checkState) {
    if (checkState()) return checkState();

    let answers = stateService.getState().answers;
    console.log("WrapUpCtrl: answers=", answers);

    // Filter the list of incorrect answers and augment it with information
    // more suitable to the view.

    let incorrectAnswers = _.filter(answers, (a) => { return !a.correct; });
    if (incorrectAnswers.length == 0)
      $scope.incorrectAnswers = null;

    else {
      $scope.incorrectAnswers = _.filter(incorrectAnswers, function(a) {
        let i = a.questionIndex;
        let question = $scope.questions[i];
        a.question = question.question;
        a.questionType = question.type;

        switch (question.type) {
          case 'jscode':
            a.correctAnswer   = question.correctCode;
            a.incorrectAnswer = a.answer;
            break;

          case 'choice':
            let correctAnswer = _.filter(question.answers,
                                         (a) => { return a.correct; })[0];
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
  function($scope, $location, stateService, checkState, questions, $routeParams) {

    if (checkState()) return checkState();

    let questionNumber = $routeParams.num;
    let questionIndex  = questionNumber - 1;
    let testedValue    = null;

    if (questionIndex >= questions.length)
      stateService.redirectToStep(STEP_WRAP_UP);

    let state = stateService.getState();

    $scope.currentQuestion = questions[questionIndex];
    $scope.questionIndex   = questionIndex;

    let answer = stateService.getAnswer(questionIndex);
    console.log(`Answer for question ${questionIndex+1} = `, answer);

    if (answer) {
      // Restore the settings, so they're reflected in the view. (This might
      // be a reload.)
      $scope.currentQuestion.recorded = true;
      $scope.currentQuestion.correct  = answer.correct;
      $scope.currentQuestion.answer   = answer.answer;
    }

    function multipleChoiceIsCorrect(question) {
      // The answer to a multiple choice question is the index of the choice.
      let userAnswer = question.answers[question.answer];
      return userAnswer.correct;
    }

    function codeAnswerIsCorrect(question) {
      console.log(`answer is: ${question.answer}`);
      let code = question.wrapper.replace(question.token, question.answer);
      console.log(`Evaluating: ${code}`);
      try {
        let result = eval(code);
        return result === eval(question.expectedAnswer);
      }
      catch (e) {
        console.log(`Eval of question "${question.question}" failed: ${e.message}`);
        return false;
      }
    }

    // Called when the Test Answer button is pressed on a code question page.
    $scope.testCodeAnswer = (question) => {
      if (question.tries < question.maxTries) {
        question.tries++;
        question.isCorrect = codeAnswerIsCorrect(question);
        testedValue = question.answer;
      }
    }

    $scope.showTryResult = (question, correct) => {
      console.log('showTryResult question=', question);
      console.log('showTryResult: testValue=', testedValue);
      if ((question.type === 'choice') ||
          (question.tries === 0) ||
          (question.recorded) ||
          (question.isCorrect !== correct) ||
          (question.answer !== testedValue)) {
        return false;
      }

      return true;
    }

    // Record an answer.
    $scope.recordAnswer = () => {
      let question = $scope.currentQuestion;
      let correct = false;
      switch (question.type) {
        case 'choice':
          correct = multipleChoiceIsCorrect(question);
          break;

        case 'jscode':
          correct = codeAnswerIsCorrect(question);
          break;
      }

      let answer = {
        correct:       correct,
        questionIndex: $scope.questionIndex,
        answer:        question.answer
      };

      stateService.saveAnswer(answer);

      $scope.currentQuestion.recorded = true;
      $scope.currentQuestion.correct = correct;
    }

    $scope.next = () => {
      console.log(`next. questionIndex=${questionIndex}, total=${questions.length}`);
      if (questionIndex >= questions.length) {
        // Last question. Over to wrap-up.
        stateService.redirectToStep(STEP_WRAP_UP);
      }
      else {
        stateService.redirectToStep(STEP_QUESTIONS, questionIndex + 1);
      }
    }
  }
);
