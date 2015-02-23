# NewCircle JavaScript proficiency quiz

The intent of this interactive, HTML+AngularJS quiz is to allow AngularJS
JavaScript students to assess their abilities, as a precursor to taking
the course.

## Features

Among the features this software offers:


* The quiz engine is an AngularJS application. (There’s no back-end server.)
  The quiz is self-grading; no instructor intervention is required. The engine
  walks the student through the quiz, and it supports both multiple choice
  questions and “enter some JavaScript code” questions. It gives feedback
  throughout the process, and it provides a summary page that shows the missed
  questions along with the correct answers. Thus, it can serve as both a
  self-assessment and a review. Preliminary feedback from last night’s class was
  mostly positive.

* The quiz engine is intended to be generic. The quiz questions, introductory
  text, and wrap-up summary are stored in a separate YAML file. Thus, you can
  change the questions in the quiz simply by editing the YAML file and
  rebuilding. Thus, the engine should (in theory) be easily adapted for other
  quizzes.

* The AngularJS code uses ECMAScript 6 capabilities and must be translated
  (“transpiled”) with the Google traceur transpiler. (AngularJS 2.0 is being
  built with traceur.)

* Because it’s a JavaScript quiz, I used Gulp, not make(1), as the build tool.
  Gulp’s tooling easily supports the various things I needed to run. Building
  the quiz requires Node.js and npm. Running “npm install” suffices to install
  everything except Gulp.

* The quiz remembers where the student left off (via a cookie). It’s not
  possible to go back and re-do a question. If you’re playing with it, and you
  want to reset the cookie, there’s a special URL (“/reset”) that’ll clear out
  the cookie.

## Building

First, install [Node.js][]. Next, install [Gulp][]:

    $ npm install -g gulp

Then, within this source directory, install the local packages necessary
to run Gulp:

    $ npm install

Finally, just run `gulp`:

    $ gulp

Everything will be built and copied into the `dist` subdirectory.

[Node.js]: http://nodejs.org/
[Gulp]: http://gulpjs.com/

## Deploying

Deploy all the files in the `dist` directory, and tell the students to
point their browsers at the `index.html` file.

## Writing or Modifying the Quiz

The quiz engine, itself, is intended to be generic. Unless you're modifying
the look-and-feel of the quiz, you should not need to change the CSS (in
`quiz.less`), the HTML files, or the JavaScript (in `quiz.js`).

The contents of the quiz, itself, are entirely contained within the `quiz.yml`
in the `src` directory. This YAML file contains introductory front matter,
wrap-up (final page) text, and the list of questions (with answers).

The JavaScript Quiz `quiz.yml` file is extensively documented. Consult the
documentation before modifying the quiz data.

The Gulp logic converts the YAML to JSON; then, it encodes it as Base64,
writing the output to `quiz.dat`. This approach provides a simple anti-cheating
roadblock. (A developer who's smart enough to download `quiz.dat`, figure out
that it's Base64, and decode it is probably smart enough to do reasonably
well on the quiz.)

## Testing the Quiz

When you're working on the quiz, you may need to test it in a browser. Because
the quiz engine remembers where you are, it's not possible to go backward and
re-visit a previously answered question. For that reason, there's a special
`/reset` URL that resets the state cookie. For instance, if the quiz is
deployed at `http://www.example.org/jsquiz/`, you can reset the cookie (and
the quiz's state) by visiting `http://www.example.org/jsquiz/#/reset`.
