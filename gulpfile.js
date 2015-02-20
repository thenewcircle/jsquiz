var gulp            = require('gulp');
var traceur         = require('gulp-traceur');
var less            = require('gulp-less');
var concat          = require('gulp-concat');
var del             = require('del');
var runSequence     = require('run-sequence');
var sourcemaps      = require('gulp-sourcemaps');
var angularInjector = require('gulp-angular-injector');
var rename          = require('gulp-rename');

var paths = {
  scripts:   'src/*.js',
  resources: ['src/*.html', 'src/*.png', 'src/*.json'],
  less:      'src/*.less',
  build:     'dist'
}

gulp.task('default', function() {
  runSequence('clean', ['scripts', 'resources', 'css']);
});

gulp.task('scripts', function() {

  gulp.src(paths.scripts)
    .pipe(sourcemaps.init())
    // Convert from ES6 to ES5
    .pipe(traceur())
    // Automatically convert Angular injections to minifiable form.
    .pipe(angularInjector())
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
