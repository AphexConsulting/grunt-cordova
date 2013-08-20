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

var sys = require('sys');
var child_process = require('child_process');
var path = require('path');
var fs = require('fs');
var fse = require('fs-extra');
var xml2js = require('xml2js');
var _ = require('underscore');
var _s = require('underscore.string');
var PNG = require('png-js');

// android, ios, winphone, blackberry, webos,
// ios, android, blackberry10, wp7, wp8 (plugman supported)
// var oldPlatformList = ['android', 'ios', 'wp8', 'windows/windows8', 'blackberry/blackberry', 'blackberry/blackberry10'];

// var platforms = {
//   android: require('./platforms/android')(directory),
//   ios: {
//     contentDir: 'www',
//     repoUrl: 'git://github.com/apache/cordova-ios.git',
//     repoPath: ''
//   },
//   wp8: {
//     contentDir: 'www',
//     repoUrl: 'git://github.com/apache/cordova-wp8.git',
//     repoPath: ''
//   }
// };

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

  function build(directory, platformName, options, next) {

    if (!grunt.file.isDir(directory)) {
      grunt.log.warn('Source file "' + directory + '" is not a directory.');
      return false;
    }
    
    var res = {};

    var versionMatch = platformName.split('#');
    platformName = versionMatch[0];
    var cordovaVersion = versionMatch[1] || 'master';
    console.log('Building for ' + platformName + ' (' + cordovaVersion + ')');

    var config;
    var repoUrl;
    var cordovaDir;
    var cordovaRepoDir;
    
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
          initVariables();
        });
      });
    }
    var buildDir;
    var platform;
    var assetsDir;

    function initVariables() {
      buildDir = path.resolve(options.path, 'builds', platformName);
      // platform = platforms[platformName];
      platform = require('./platforms/' + platformName)(directory, buildDir, options, grunt, config);
      assetsDir = path.join(buildDir, platform.contentDir);

      var files = [];
      
      function readdir(directory) {
        console.log('--------- ' + directory);
        try {
          files = files.concat(_.map(fs.readdirSync(directory), function(file) { return path.resolve(directory, file); }));
        } catch(e) { }
      }
      readdir(path.resolve(options.graphics, platform.name));
      readdir(path.resolve(options.graphics, 'common'));

      console.log('Found graphics: ', files);

      var graphics = [];
      for(var i = 0; i < files.length; i++) {
        var png = PNG.load(files[i]);
        png.filename = path.basename(files[i]);
        png.path = files[i];
        graphics.push(png);
        console.log(files[i] + ':', png);
      }
      function findExact(name, filename, width, height) {
        return _.find(graphics, function(g) {
          console.log('G:' + g);
          return _s.startsWith(g.filename, name) &&
            (!filename || g.filename === filename) &&
            (!width || g.width === width) &&
            (!height || g.height === height);
        });
      }
      res.hasExactGraphics = function(name, filename, width, height) {
        console.log('hasExactGraphics: ' + Array.prototype.toString.apply(arguments));
        return findExact.apply(this, arguments);
      }
      res.getGraphics = function(name, filename, width, height) {
        if (!filename) filename = name + '.png';

        var info = findExact.apply(this, arguments);

        if (!info) {
          var secondary, fallback;
          // Fallback is to pick any graphics.
          fallback = graphics[0];
          for(var i = 0; i < graphics.length; i++) {
            var g = graphics[i];
            if (_s.startsWith(g.filename, filename)) {
              // Better fallback is to pick any graphics with at least similar name.
              fallback = g;
              if (filename && g.filename === filename) {
                info = g;
                break;
              }
              // Primary method is to pick the smallest graphics that is larger or equal to what was requested.
              if ((!width || g.width >= width) && (!height || g.height >= height)) {
                if (!info || ((g.width < info.width) && (g.height < info.height))) info = g;
              }
              // Secondary method is to pick the largest graphics that is smaller than what was requested.
              if ((!width || g.width < width) && (!height || g.height < height)) {
                if (!secondary || ((g.width > secondary.width) && (g.height > secondary.height))) secondary = g;
              }
            }
          }
          info = info || secondary || fallback;
        }
        if (info) {
          info.name = name;
          return platform.saveGraphics(name, filename, width, height, info, res);
        }
        return null;
      }

      repoUrl = platform.repoUrl;
      cordovaRepoDir = path.resolve(options.path, 'git', platformName);
      cordovaDir = path.resolve(cordovaRepoDir, platform.repoPath);

      cloneOrPullStep();
    }

    
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
        expect('git pull origin ' + cordovaVersion, {}, {cwd: cordovaRepoDir}, function(err) {
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
      var cordovaJs = fs.readFileSync(path.resolve(assetsDir, 'cordova.js')); // save cordova.js
      fse.remove(assetsDir, function(err) {
        function done() {
          grunt.file.mkdir(assetsDir);
          fs.writeFileSync(path.resolve(assetsDir, 'cordova.js'), cordovaJs);
          collectStep();          
        }

        // Android specific. TODO: move to platforms/android.js
        var res = fs.readdirSync(path.resolve(buildDir, 'res'));
        console.log('res:' + res);

        var cleaning = 0;
        for(var i = 0; i < res.length; i++) {
          if (_s.startsWith(res[i], 'drawable')) {
            cleaning++;
            fse.remove(path.resolve(buildDir, 'res', res[i]), function(err) {
              if (err) {
                console.log('Error', err);
                next(err);
              } else {
                cleaning--;
                if (cleaning === 0) done();
              }
            });
          }
        }
        if (!cleaning) {
          done();
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
      var metafile = path.resolve(__dirname, '../templates', platformName, 'meta.json');
      var meta = grunt.file.exists(metafile)?grunt.file.readJSON(metafile):{};
      var data = {
        config:config,
        preferences:{},
        grunt:grunt,
        res:res,
        meta:meta,
        platform:platform
      };

      if (config.widget.preference) {
        for(var i = 0; i < config.widget.preference.length; i++) {
          console.log(i, config.widget.preference[i]);
          data.preferences[config.widget.preference[i].$.name] = config.widget.preference[i].$.value;
        }        
      }
      console.log('preferences', data.preferences);
      
      var buildPath = path.resolve(buildDir);
      var templatePath = path.resolve(__dirname, '../templates', platformName);

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
      renderTemplates('', templatePath, buildPath, waitResourcesStep);
    }

    function waitResourcesStep() {
      if (platform.waitResources) {
        platform.waitResources(buildStep);
      } else {
        buildStep();
      }
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
      platforms: ['android#2.9.0', 'ios'],
      icons: 'icons',
      content: 'content',
      graphics: './graphics'
    });
    
    // Allow usage like this: grunt cordova:main:android
    if (this.args.length) {
      var platform = this.args[this.args.length - 1];
      console.log('Last argument ' + platform);
      // if (platform === 'detect' || platform in platforms)
      {
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

      // for(var j = 0; j < options.platforms.length; j++) {
      //   if (!options.platforms[i] in platforms) {
      //     grunt.log.warn('Unknown platform: ' + options.platforms[i]);
      //     return false;
      //   }
      // }

      for(var i = 0; i < src.length; i++) {
        for(var j = 0; j < options.platforms.length; j++) {
          count++;
          build(src[i], options.platforms[j], options, next);
        }
      }

    });
  });

};
