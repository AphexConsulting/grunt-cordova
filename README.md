# grunt-cordova

## NOTE! This version is not ready yet. It does do what it needs to - kind of - but it is missing configuration and documentation.

> Build application packages with Cordova.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-cordova --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-cordova');
```

This plugin works on OSX, it might work on Linux and it just might work on Windows as well.

You need to have git on your path.

You also need to have the android command line utilities on your path. Try 'adb' on the command-line to see if it works. If it doesn't,
search the internet for now.

## The "cordova" task

### Overview
In your project's Gruntfile, add a section named `cordova` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  cordova: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
})
```

### Options

#### options.path
Type: `String`
Default value: `'.cordova'`

Path where the git/ and build/ directories will be created. They contain the git checkouts of different Cordova versions and
the actual projects - respectively.

#### options.package
Type: `String`
Default value: `'com.example'`

The application package path used in the build.

### Usage Examples

#### Default Options
In this example, the default options are used to do something with whatever. So if the `testing` file has the content `Testing` and the `123` file had the content `1 2 3`, the generated result would be `Testing, 1 2 3.`

```js
grunt.initConfig({
  cordova: {
    options: {},
    files: {
      'dest/default_options': ['src/testing', 'src/123'],
    },
  },
})
```

#### Custom Options
In this example, custom options are used to do something else with whatever else. So if the `testing` file has the content `Testing` and the `123` file had the content `1 2 3`, the generated result in this case would be `Testing: 1 2 3 !!!`

```js
grunt.initConfig({
  cordova: {
    options: {
      separator: ': ',
      punctuation: ' !!!',
    },
    files: {
      'dest/default_options': ['src/testing', 'src/123'],
    },
  },
})
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
