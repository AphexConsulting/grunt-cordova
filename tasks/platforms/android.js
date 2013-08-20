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

module.exports = function(directory, buildDir, options) {
  var platform = {
    name: 'android',
    contentDir: 'assets/www',
    repoUrl: 'git://github.com/apache/cordova-android.git',
    repoPath: ''
  };

  var converting = 0;
  var done;
  var sizes = {
    'ldpi':0.5,
     'mdpi':1,
     'hdpi':1.5,
     'xhdpi':2,
     'xxhdpi':3,
     'nodpi':0};

  platform.saveGraphics = function(name, filename, width, height, info, res) {
    converting++;

    var generic = true;
    for(var k in sizes) {
      if (name.indexOf(k) !== -1) {
        generic = false;
        break;
      }
    }
    console.log('filename: ' + filename);
    info.name = filename.split('.')[0];

    // Generate all other sizes as well.
    if (generic) {
      console.log('GENERATING ALL SIZES!');
      for(var size in sizes) {
        if (size === 'mdpi' || size === 'nodpi') continue;

        res.getGraphics(name + '-' + size, info.name + '.' + filename.split('.')[1], width * sizes[size], height * sizes[size]);
      }
    }

    var subdir = 'res/drawable';
    for(var size in sizes) if (name.indexOf(size) !== -1 || info.name.indexOf(size) !== -1) subdir = 'res/drawable-' + size;
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
      console.log('Done converting ' + filename + ' to ' + width + 'x' + height);
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
