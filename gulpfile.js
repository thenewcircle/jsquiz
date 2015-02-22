var gulp            = require('gulp');
var traceur         = require('gulp-traceur');
var less            = require('gulp-less');
var concat          = require('gulp-concat');
var del             = require('del');
var runSequence     = require('run-sequence');
var sourcemaps      = require('gulp-sourcemaps');
var angularInjector = require('gulp-angular-injector');
var rename          = require('gulp-rename');
var through2        = require('through2');
var gutil           = require('gulp-util');
var PluginError     = gutil.PluginError;
var yaml            = require('gulp-yaml');

var paths = {
  scripts:      'src/*.js',
  resources:    ['src/*.html', 'src/*.png'],
  less:         'src/*.less',
  questions:    'src/questions.yml',
  questionsOut: 'questions.base64',
  build:        'dist'
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

gulp.task('default', function() {
  runSequence('clean', ['scripts', 'resources', 'css', 'encode-questions']);
});

gulp.task('encode-questions', function() {
  gulp.src(paths.questions)
    .pipe(yaml({ space: 2 }))
    .pipe(encodeQuestions())
    .pipe(rename(paths.questionsOut))
    .pipe(gulp.dest(paths.build));
});

gulp.task('scripts', function() {

  gulp.src(paths.scripts)
    .pipe(sourcemaps.init())
    // Convert from ES6 to ES5
    .pipe(traceur())
    // Minify the file, rename it, write the source map and save the
    // minified file.
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest(paths.build));
});

gulp.task('resources', function() {
  gulp.src(paths.resources)
    .pipe(gulp.dest(paths.build));
});

gulp.task('css', function() {
  gulp.src(paths.less)
    .pipe(less())
    .pipe(gulp.dest(paths.build));
});

gulp.task('clean', function() {
  del(paths.build);
});

gulp.task('watch', function() {
  gulp.watch(paths.scripts, ['scripts']);
  gulp.watch(paths.questions, ['encode-questions']);
  gulp.watch(paths.resources, ['resources']);
  gulp.watch(paths.less, ['css']);
});

// ---------------------------------------------------------------------------
// Local Plugins
// ---------------------------------------------------------------------------

function encodeQuestions(opts) {
  return through2.obj(function(file, enc, cb) {
    if (file.isNull()) {
      this.push(file);
      return cb();
    }

    if (file.isStream()) {
      this.emit('error', new PluginError({
        plugin:  'encodeQuestions',
        message: 'streams are not supported'
      }));
      return cb();
    }

    if (file.isBuffer()) {
      var contents = file.contents;
      var encoded = contents.toString('base64');
      var questions = JSON.parse(contents.toString());
      gutil.log("Encoded " + questions.questions.length + " questions.");
      file.contents = new Buffer(encoded);
      this.push(file);
      return cb();
    }
  });
}
