'use strict';
const gulp = require('gulp');
const colors = require('colors/safe');

gulp.task('package', (done) => {
  let Packager = require('./libs/packager').Packager;
  let p = new Packager();
  p.pack().then((dir) => {
    console.log('Extension is packed in: ', dir);
    done();
  }).catch((err) => {
    console.log(colors.red(err));
  });

});

gulp.task('default', ['package']);
