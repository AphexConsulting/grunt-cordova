/*
 * grunt-cordova
 * https://github.com/AphexConsulting/grunt-cordova
 *
 * Copyright (c) 2013 Rolf Sormo
 * Licensed under the MIT license.
 */

// TODO:
// - support config.xml
// - check for android being in the path (when building for android), or at least show errors correctly
// - support build.phonegap.com -style config.xml (https://build.phonegap.com/docs/config-xml)
//  - use the phonegap-version information when checking out cordova (if possible)
// - detect possible target platforms (check if 'android --help' works, check to see if Xcode binaries work, check if we are on Windows, etc.)
// - user-specific settings in ~/.grunt-cordova/settings, like keystore passwords etc.

'use strict';

var versionRegex = /^([^#])#(.*)$/;
var sys = require('sys');
var child_process = require('child_process');
var path = require('path');
var fs = require('fs');
var fse = require('fs-extra');
var xml2js = require('xml2js');
var _s = require('underscore.string');

// android, ios, winphone, blackberry, webos,
// ios, android, blackberry10, wp7, wp8 (plugman supported)
// var oldPlatformList = ['android', 'ios', 'wp8', 'windows/windows8', 'blackberry/blackberry', 'blackberry/blackberry10'];

var platforms = {
  android: {
    contentDir: 'assets/www',
    repoUrl: 'git://github.com/apache/cordova-android.git',
    repoPath: ''
  },
  ios: {
    contentDir: 'www',
    repoUrl: 'git://github.com/apache/cordova-ios.git',
    repoPath: ''
  },
  wp8: {
    contentDir: 'www',
    repoUrl: 'git://github.com/apache/cordova-wp8.git',
    repoPath: ''
  }
};

function expect(cmd, match, options, next) {
  if (!next && typeof match === 'function') {
    next = match;
    match = {};
  }
  if (!next && typeof options === 'function') {
    next = options;
    options = {};
  }
  if (typeof cmd === 'string') {
    cmd = cmd.split(' ');
  }
  console.log('CMD: ' + cmd.join(' '));
  // console.log('match', match);
  // console.log('options', options);
  // console.log('next', next);
  
  var p = child_process.spawn(cmd[0], cmd.slice(1, cmd.length), options);
  p.stdout.on('data', function(line) {
    var m, error;
    for(var re in match) {
      m = line.toString().match(re);
      if (m) {
        error = match[re].apply(null, m);
        if (error) {
          console.log('error', error);
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
    console.log('error: ' + error);
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
    if (typeof platforms[platform] === 'undefined') {
      grunt.log.warn('Unknown platform: ' + platform);
      return false;
    }
    
    var res = {};

    console.log('Building for ' + platform);

    var config;
    var repoUrl;
    var cordovaVersion;
    var cordovaDir;
    var cordovaRepoDir;
    var subdir = '';
    
    var versionMatch = platform.match(versionRegex);
    if (versionMatch) {
      platform = versionMatch[1];
      cordovaVersion = versionMatch[2];
      
    } else {
      cordovaVersion = 'master';
    }
    var platformPath = platform.split('/');
    if (platformPath.length > 1) {
      platform = platformPath.shift();
      subdir = platformPath.join('/');
    }
    repoUrl = platforms[platform].repoUrl;
    cordovaRepoDir = path.resolve(options.path, 'git', platform);
    cordovaDir = path.resolve(cordovaRepoDir, platforms[platform].repoPath);
    
    var buildDir = path.resolve(options.path, 'builds', platform);
    var assetsDir = path.join(buildDir, platforms[platform].contentDir);

    function cloneOrPullStep() {
      if (!grunt.file.isDir(cordovaDir)) {
        grunt.file.mkdir(cordovaRepoDir);
        console.log('Clone url: ' + repoUrl);
        console.log('  - to: ' + cordovaDir);
        console.log('Cloning...');

        expect('git clone ' + repoUrl + ' ' + cordovaRepoDir, {}, function(err) {
          if (err) {
            console.log('Error:', err);
            next(err);
          } else {
            checkoutStep();
          }
        });
      } else {
        console.log('Pulling...');
        expect('git pull', {}, {cwd: cordovaRepoDir}, function(err) {
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

      expect('git checkout ' + cordovaVersion, {}, {cwd: cordovaRepoDir}, function(err) {
        
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
        expect([cordovaDir + '/bin/create', buildDir, config.widget.$.id, grunt.util._.classify(config.widget.name)], function(err) {
          if (err) {
            console.log('err: ' + JSON.stringify(err));
            next(err);
          } else {
            console.log('Done creating!');
            cleanupStep();
          }
        });
      } else {
        // Just presume cleanup has been done previously and just overwrite the assets.
        collectStep();
      }
    }
    
    function cleanupStep() {
      var cordovaJs = fs.readFileSync(path.resolve(assetsDir, 'cordova.js'));
      fse.remove(assetsDir, function(err) { // TODO: except cordova.js
        if (err) {
          console.log('Error', err);
          next(err);
        } else {
          grunt.file.mkdir(assetsDir);
          fs.writeFileSync(path.resolve(assetsDir, 'cordova.js'), cordovaJs);
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
          renderTemplatesStep();
        }
      });
    }
    
    function renderTemplatesStep() {
      console.log('render templates step');
      var metafile = path.resolve(__dirname, '../templates', platform, 'meta.json');
      var meta = grunt.file.exists(metafile)?grunt.file.readJSON(metafile):{};
      var data = {
        config:config,
        preferences:{},
        grunt:grunt,
        res:res,
        meta:meta
      };

      if (config.widget.preference) {
        for(var i = 0; i < config.widget.preference.length; i++) {
          console.log(i, config.widget.preference[i]);
          data.preferences[config.widget.preference[i].$.name] = config.widget.preference[i].$.value;
        }        
      }
      console.log('preferences', data.preferences);
      
      var buildPath = path.resolve(buildDir);
      var templatePath = path.resolve(__dirname, '../templates', platform);

      function renderTemplates(relativePath, sourcePath, targetPath, next) {
        var dir = fs.readdirSync(sourcePath);
        for(var i = 0; i < dir.length; i++) {
          var source = path.resolve(sourcePath, dir[i]);
          var target = path.resolve(targetPath, dir[i]);
          var relative = path.join(relativePath, dir[i]);
          
          console.log('relativePath: ' + relative);

          if (meta[relative]) {
            if (meta[relative].filename) {
              target = path.resolve(buildPath, grunt.template.process(meta[relative].filename, {data:data}));
            }
          }

          console.log('source: ' + source);
          if (grunt.file.isDir(source)) {
            renderTemplates(path.join(relativePath, dir[i]), path.join(sourcePath, dir[i]), path.join(targetPath, dir[i]));
          } else if (dir[i] === 'meta.json') {
            console.log('Ignoring: ' + dir[i]);
          } else {
            console.log('Template', source, '=>', target);
            var template = fs.readFileSync(source).toString();
            var result = grunt.template.process(template, {data:data});
            // console.log(result);
            fs.writeFileSync(target, result);
          }
        }
        if (next) {
          next();
        }
      }
      renderTemplates('', templatePath, buildPath, buildStep);
    }
    
    function buildStep() {
      console.log('build step');
      expect([buildDir + '/cordova/build', '--' + options.mode], {
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

    // TODO: function generateDefaultConfig(): load package.json and run templates/config.xml with it
    
    function loadConfig() {
      var parser = new xml2js.Parser();
      fs.readFile(path.resolve(directory, 'config.xml'), function(err, data) {
        if (err) {
          console.log('Error loading config.xml. Make sure it is in the root of the data folder.');
          return;
        }
        parser.parseString(data, function (err, result) {
          config = result;
          console.dir(config);
          cloneOrPullStep();
        });
      });
    }
    loadConfig();
  }

  grunt.registerMultiTask('cordova', 'Wrap an application package with Cordova.', function() {
    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      path: '.cordova',
      package: 'com.example',
      name: 'Example',
      mode: 'debug',
      // platforms: ['android', 'ios', 'wp8']
      platforms: ['android', 'ios'],
      icons: 'icons',
      content: 'content'
    });
    
    // Allow usage like this: grunt cordova:main:android
    if (this.args.length) {
      var platform = this.args[this.args.length - 1];
      console.log('Last argument ' + platform);
      if (platform === 'detect' || platform in platforms) {
        console.log('Found ' + platform + ' in arguments!');
        options.platforms = platform;
      }
    }
    if (typeof options.platforms === 'string') {
      options.platforms = [options.platforms];
    }

    console.log('Platforms: ' + options.platforms);

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
      function next(err) {
        if (err) {
          console.log('Cordova build error!', JSON.stringify(err));          
        }
        
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
