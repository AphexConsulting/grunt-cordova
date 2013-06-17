/*
 * grunt-cordova
 * https://github.com/AphexConsulting/grunt-cordova
 *
 * Copyright (c) 2013 Rolf Sormo
 * Licensed under the MIT license.
 */

// TODO:
// - check for android being in the path (when building for android), or at least show errors correctly

'use strict';

var versionRegex = /^([^#])#(.*)$/;
var sys = require('sys');
var child_process = require('child_process');
var path = require('path');
var fse = require('fs-extra');

function expect(cmd, options, next) {
  if (!next && typeof options === 'function') {
    next = options;
    options = {};
  }
  console.log('=== ' + cmd);
  var args = cmd.split(' ');
  var p = child_process.spawn(args[0], args.slice(1, args.length));
  p.stdout.on('data', function(line) {
      var m, error;
      for(var re in options) {
        m = line.toString().match(re);
        if (m) {
          error = options[re].apply(null, m);
          if (error) {
            return next(error);
          }
        }
      }
  });
  p.stderr.on('data', function(line) {
    next(line);
  });
  p.on('close', function(code) {
    console.log('code: ' + code);
    if (code) {
      next(code);
    } else {
      next();
    }
  });
}

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  function pullRepo(repoUrl, dir, options, next) {
    console.log('Url: ' + repoUrl);
    console.log('  - to: ' + dir);
    console.log('Cloning...');
    
    expect('git clone ' + repoUrl + ' ' + dir, {
      '^fatal: (.*)': function(line, error) {
        return error;
      },
      '^Cloning into': function(line) {
        next();
      }
    }, function(err) {
      if (err) {
        console.log('err: ' + err);
        next(err);
      } else {
        console.log('Done!');
        next();
      }
    });
  }

  function build(directory, platform, options, next) {
    if (!grunt.file.isDir(directory)) {
      grunt.log.warn('Source file "' + directory + '" is not a directory.');
      return false;
    }
    
    console.log('Building: ' + platform);

    var versionMatch = platform.match(versionRegex);
    var repoUrl;
    var cordovaDir;
    
    if (versionMatch) {
      repoUrl = 'git://github.com/apache/cordova-' + versionMatch[1] + '.git#' + versionMatch[2];
      cordovaDir = path.resolve(options.path, 'git', 'cordova-' + versionMatch[1] + '.git');
    } else {
      repoUrl = 'git://github.com/apache/cordova-' + platform + '.git';
      cordovaDir = path.resolve(options.path, 'git', 'cordova-' + platform + '.git');
    }
    var buildDir = path.resolve(options.path, 'builds', platform);
    var assetsDir = path.join(buildDir, 'assets/www');

    function pullStep() {
      if (!grunt.file.isDir(cordovaDir)) {
        grunt.file.mkdir(cordovaDir);
        pullRepo(repoUrl, cordovaDir, options, createStep);
      } else {
        console.log('Repo already exists, so no need to pull anything');
        createStep();
      }
    }

    function createStep() {
      grunt.file.mkdir(path.dirname(buildDir));
      
      console.log('running create?');
      if (!grunt.file.isDir(buildDir)) {
        // (conditionally) run create
        expect(cordovaDir + '/bin/create ' + buildDir + ' ' + options.package + ' ' + options.name, function(err) {
          if (err) {
            console.log('err: ' + err);
            next(err);
          } else {
            console.log('Done creating!');
            cleanupStep();
          }
        });
      } else {
        // Just presume cleanup has been done previously and just
        // overwrite.
        collectStep();
      }
    }
    
    function cleanupStep() {
      fse.remove(assetsDir, function(err) {
        if (err) {
          console.log('Error', err);
          next(err);
        } else {
          collectStep();
        }
      });
    }
    
    function collectStep() {
      console.log('collect', directory);
      fse.copy(directory, assetsDir, function(err) {
        if (err) {
          console.log('Error', err);
          next(err);
        } else {
          buildStep();
        }
      });
    }
    
    function buildStep() {
      // TODO: run build
      console.log('building?');
      expect(buildDir + '/cordova/build --' + options.mode, {
        '.*': function(line) {
          console.log('BUILD: ' + line);
        }
      }, function(err) {
        if (err) {
          console.log('err: ' + err);
          next(err);
        } else {
          console.log('Done building!');
          next();
        }
      });
    }

    pullStep();
  }

  grunt.registerMultiTask('cordova', 'Wrap an application package with Cordova.', function(target, platform) {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      path: '.cordova',
      package: 'com.example',
      name: 'Example',
      mode: 'debug',
      // platforms: ['android', 'ios', 'wp8']
      platforms: ['android']
    });
    
    // Allow usage like this: grunt cordova:main:android
    if (platform) {
      options.platforms = [platform];
    }

    var done = this.async();
    
    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      // Concat specified files.
      var src = f.src.filter(function(filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else if (!grunt.file.isDir(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" is not a directory.');
          return false;
        } else {
          return true;
        }
      });
      
      var count = 0;
      function next() {
        count--;
        if (!count) {
          grunt.log.writeln('Done wrapping with Cordova.');
          done();
        }
      }
      
      for(var i = 0; i < src.length; i++) {
        for(var j = 0; j < options.platforms.length; j++) {
          count++;
          build(src[i], options.platforms[j], options, next);
        }
      }

    });
  });

};
