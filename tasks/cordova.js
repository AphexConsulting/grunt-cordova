/*
 * grunt-cordova
 * https://github.com/AphexConsulting/grunt-cordova
 *
 * Copyright (c) 2013 Rolf Sormo
 * Licensed under the MIT license.
 */

// TODO:
// - check for android being in the path (when building for android), or at least show errors correctly
// - support build.phonegap.com -style config.xml (https://build.phonegap.com/docs/config-xml)
//  - use the phonegap-version information when checking out cordova (if possible)
// - detect possible target platforms (check if 'android --help' works, check to see if Xcode binaries work, check if we are on Windows, etc.)
// 

'use strict';

var versionRegex = /^([^#])#(.*)$/;
var sys = require('sys');
var child_process = require('child_process');
var path = require('path');
var fse = require('fs-extra');

function expect(cmd, match, options, next) {
  if (!next && typeof match === 'function') {
    next = match;
    match = {};
  }
  if (!next && typeof options === 'function') {
    next = options;
    options = {};
  }
  console.log('=== ' + cmd);
  var args = cmd.split(' ');
  var p = child_process.spawn(args[0], args.slice(1, args.length), options);
  p.stdout.on('data', function(line) {
    var m, error;
    for(var re in match) {
      m = line.toString().match(re);
      if (m) {
        error = match[re].apply(null, m);
        if (error) {
          return next(error);
        }
      }
    }
  });
  var error = '';
  p.stderr.on('data', function(line) {
    error = error + line.toString();
  });
  p.on('close', function(code) {
    console.log('code: ' + code);
    if (code) {
      next({error:error, code:code});
    } else {
      next();
    }
  });
}

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  function build(directory, platform, options, next) {
    if (!grunt.file.isDir(directory)) {
      grunt.log.warn('Source file "' + directory + '" is not a directory.');
      return false;
    }
    
    console.log('Building: ' + platform);

    var repoUrl;
    var cordovaVersion;
    var cordovaDir;
    
    var versionMatch = platform.match(versionRegex);
    if (versionMatch) {
      platform = versionMatch[1];
      cordovaVersion = versionMatch[2];
      
    } else {
      cordovaVersion = 'master';
    }
    repoUrl = 'git://github.com/apache/cordova-' + platform + '.git';
    cordovaDir = path.resolve(options.path, 'git', 'cordova-' + platform + '.git');
    
    var buildDir = path.resolve(options.path, 'builds', platform);
    var assetsDir = path.join(buildDir, 'assets/www');

    function cloneOrPullStep() {
      if (!grunt.file.isDir(cordovaDir)) {
        grunt.file.mkdir(cordovaDir);
        console.log('Clone url: ' + repoUrl);
        console.log('  - to: ' + cordovaDir);
        console.log('Cloning...');

        expect('git clone ' + repoUrl + ' ' + cordovaDir, {}, function(err) {
          if (err) {
            console.log('Error:', err);
            next(err);
          } else {
            checkoutStep();
          }
        });
      } else {
        console.log('Pulling...');
        expect('git pull', {}, {cwd: cordovaDir}, function(err) {
          if (err) {
            console.log('Error:', err);
            next(err);
          } else {
            checkoutStep();
          }
        });
      }
    }
    
    var alreadyRe = /^Already on '/;
    function checkoutStep() {
      console.log('Checkout step:', cordovaVersion);

      expect('git checkout ' + cordovaVersion, {}, {cwd: cordovaDir}, function(err) {
        
        if (err && !err.match(alreadyRe)) {
          console.log('Error:', err);
          next(err);
        } else {
          createStep();
        }
      });
    }

    function createStep() {
      grunt.file.mkdir(path.dirname(buildDir));
      
      console.log('running create');
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

    cloneOrPullStep();
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
