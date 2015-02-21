var app = angular.module('JsQuiz', ['ngSanitize', 'ngCookies']);

app.controller('QuizCtrl', ng(function($scope, $http, $cookies, $location) {

  $scope.questions     = null;
  $scope.answers       = {};
  $scope.questionIndex = 0;
  $scope.step          = 'intro';

  let STATE_FIELDS = ['answers', 'questionIndex', 'step'];

  // Function to save the current state in a cookie. This ensures that
  // someone can't just reload the page to start again.
  function saveState() {
    let saved = {};
    for (let k of STATE_FIELDS) {
      saved[k] = $scope[k]
    }

    $cookies.state = JSON.stringify(saved);

    console.log(`Newly saved state: ${JSON.stringify($cookies.state)}`);
  }

  // Function to restore the state from a cookie. Called during initialization.
  function restoreState() {

    let queryParams = $location.search();

    if (queryParams['reset']) {
      console.log("Resetting...");
      saveState();
    }

    else if ($cookies.state) {
      let state = JSON.parse($cookies.state);
      for (let k of STATE_FIELDS) {
        $scope[k] = state[k];
      }
    }
  }

  // Load the questions and decode them. Once that's done, fire up the
  // initialization logic to get it all going.
  $http.get("questions.base64").success((data) => {
    let decodedData = JSON.parse(window.atob(data));
    initialize(decodedData.questions);
  });

  // Called when the NEXT button is pressed on the Introduction page.
  $scope.startQuiz = () => {
    $scope.step = "questions";
    setQuestion(0);
    saveState();
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
    }
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

    $scope.answers[$scope.questionIndex] = answer;

    setScore();

    let questionIndex = $scope.questionIndex + 1;
    if (questionIndex >= $scope.questions.length) {
      wrapUp();
    }
    else {
      setQuestion(questionIndex);
    }

    saveState();
  }

  function setScore() {
    $scope.correctAnswers = _.filter($scope.answers, (a) => {
      return a.correct;
    }).length;

    let pct = ($scope.correctAnswers * 100) / $scope.questions.length;
    $scope.score = Math.floor(pct);
  }

  // Called to wrap things up.
  function wrapUp() {
    $scope.step = 'wrap-up';
    saveState();

    // Filter the list of incorrect answers and augment it with information
    // more suitable to the view.

    let incorrectAnswers = _.filter($scope.answers, (a) => { return !a.correct; });
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

  function setQuestion(index) {
    $scope.currentQuestion = $scope.questions[index];
    $scope.questionIndex   = index;
  }

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
        console.log(a);
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

  // Initialization

  function initialize(questions) {
    restoreState();
    $scope.questions = validateAndProcessQuestions(questions);
    $scope.currentQuestion = null;

    switch ($scope.step) {
      case 'intro':
        break;

      case 'questions':
        if ($scope.questionIndex >= $scope.questions.length) {
          wrapUp();
        }
        else {
          console.log(`setting question to ${$scope.questionIndex}`);
          setQuestion($scope.questionIndex);
        }
        break;

      case 'wrap-up':
        wrapUp();
        break;
    }

    setScore();
  }

}));
