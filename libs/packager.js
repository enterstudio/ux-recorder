'use strict';

const zipFolder = require('zip-folder');
const fsensure = require('fsensure');
const path = require('path');

class Packager {

  constructor() {
    this.src = 'extension';
    this.dist = 'build';
    this.distFile = this.dist + '/' + this.distFileName;
  }

  get distFileName() {
    const manifest = require(path.join('..', this.src, '/manifest.json'));
    return 'ux-recorder-' + manifest.version + '.zip';
  }

  ensureDirs() {
    return new Promise((resolve, reject) => {
      fsensure.dir.exists(this.dist, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  pack() {
    return this.ensureDirs()
    .then(() => this.zip());
  }

  zip() {
    return new Promise((resolve, reject) => {
      zipFolder(this.src, this.distFile, (err) => {
        if (err) {
          console.error('Creating package file error', err);
          reject(err);
        }
        resolve(this.distFile);
      });
    });
  }
}
module.exports.Packager = Packager;
