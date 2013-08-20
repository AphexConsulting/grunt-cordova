/*
TODO:
  - instead of copying just one graphics, we should copy all ldpi/mdpi/hdpi graphics to their respective folders.
    so that the user can create icon.png, icon-ldpi.png, icon-mdpi.png, icon-hdpi.png, etc. they work.
*/

'use strict';

var path = require('path');
var fs = require('fs');
var im = require('node-imagemagick');
var mkdirp = require('mkdirp');

module.exports = function(directory, buildDir, options, grunt, config) {
  var platform = {
    name: 'android',
    contentDir: 'www',
    repoUrl: 'git://github.com/apache/cordova-ios.git',
    repoPath: ''
  };

  var converting = 0;
  var done;

  platform.saveGraphics = function(name, filename, width, height, info) {
    converting++;

    var subdir = path.join(grunt.util._.classify(config.widget.name), 'Resources/icons');
    var dir = path.resolve(buildDir, subdir);
    mkdirp.sync(dir);

    im.resize({
      srcPath: info.path,
      dstPath: path.join(dir, filename),
      width: width,
      height: height,
      format: 'png'
    }, function(err, stdout, stderr) {
      if (err) {
        console.log("Might 'brew install imagemagick' help?");
        throw err;
      }
      console.log('Done converting ' + filename + ' to ' + width + 'x' + height + ' ' + path.join(dir, filename));
      converting--;
      if (converting === 0 && done) done();
    });
    return info;
  }

  platform.waitResources = function(next) {
    if (converting === 0) {
      console.log('all resources done already');
      next(); // call next immediately since we're not waiting for anyone
    } else {
      console.log('waiting for resources');
      done = next; // sign up for async call when everything is done
    }
  }

  return platform;
}
