# NewCircle JavaScript proficiency quiz

The intent of this interactive, HTML+AngularJS quiz is to allow AngularJS
JavaScript students to assess their abilities, as a precursor to taking
the course.

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

