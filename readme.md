# data-sourcer

Get (and filter) data from multiple different data sources quickly and efficiently.

[![Build Status](https://travis-ci.org/chill117/data-sourcer.svg?branch=master)](https://travis-ci.org/chill117/data-sourcer) [![Status of Dependencies](https://david-dm.org/chill117/data-sourcer.svg)](https://david-dm.org/chill117/data-sourcer)

* [Installation](#installation)
* [API](#api)
  * [getData](#getdata)
  * [listSources](#listsources)
* [Defining Sources](#defining-sources)
* [Contributing](#contributing)
* [Tests](#tests)


## Installation

Add `data-sourcer` to your existing node application like this:
```
npm install data-sourcer --save
```
This will install `data-sourcer` and add it to your application's `package.json` file.


## API

Public methods of this module are listed here.

### getData

`getData([options])`

Gets data from all sources.

Usage:
```js
var DataSourcer = require('data-sourcer');

var myDataSourcer = new DataSourcer({
	sourcesDir: 'path-to-your-sources-directory'
});

// getData() returns an event emitter object.
myDataSourcer.getData({
	series: true,
	filter: {
		mode: 'stict',
		include: {
			someField: ['1']
		}
	}
})
	.on('data', function(data) {
		// Received some data.
		console.log(data);
	})
	.on('error', function(error) {
		// Some error has occurred.
		console.error(error);
	})
	.once('end', function() {
		// Done getting data.
		console.log('Done!');
	});
```


All available options:
```js
var options = {


	/*
		Options to pass to puppeteer when creating a new browser instance.
	*/
	browser: {
		headless: true,
		slowMo: 0,
		timeout: 10000,
	},

	/*
		Default request module options. For example you could pass the 'proxy' option in this way.

		See for more info:
		https://github.com/request/request#requestdefaultsoptions
	*/
	defaultRequestOptions: null,

	filter: {
		/*
			The filter mode determines how some options will be used to exclude data.

			For example when using the following filter option: `someField: ['1', '2']`:
				'strict' mode will only allow data that has the 'someField' property equal to '1' or '2'; ie. data that is missing the 'someField' property will be excluded.
				'loose' mode will allow data that has the 'someField' property of '1' or '2' as well as those that are missing the 'someField' property.
		*/
		mode: 'strict',

		/*
			Include items by their property values. Examples:

			`something: ['1', '2']`:
				Each item's 'something' property must equal '1' or '2'.
		*/
		include: {
		},

		/*
			Exclude items by their property values. Examples:

			`something: ['3']`:
				All items where 'something' equals '3' will be excluded.
		*/
		exclude: {
		}
	},

	/*
		The method name used to get data from a source. Required for each source.
	*/
	getDataMethodName: 'getData',

	/*
		Use a queue to limit the number of simultaneous HTTP requests.
	*/
	requestQueue: {
		/*
			The maximum number of simultaneous requests. Must be greater than 0.
		*/
		concurrency: 10,
		/*
			The time (in milliseconds) between each request. Set to 0 for no delay.
		*/
		delay: 0,
	},

	/*
		Set to TRUE to have all asynchronous operations run in series.
	*/
	series: false,

	/*
		Exclude data sources by name.

		All data sources except 'somewhere-else':
		['somewhere-else']
	*/
	sourcesBlackList: null,

	/*
		Directory from which sources will be loaded.
	*/
	sourcesDir: null,

	/*
		Include data sources by name.

		Only 'somewhere':
		['somewhere']
	*/
	sourcesWhiteList: null,
};
```


### listSources

`listSources([options])`

Get list of all data sources.

Usage:
```js
var DataSourcer = require('data-sourcer');

var myDataSourcer = new DataSourcer({
	sourcesDir: 'path-to-your-sources-directory'
});

console.log(myDataSourcer.listSources());
```

Sample `sources`:
```js
[
	{
		name: 'somewhere',
		homeUrl: 'http://somewhere.com',
		requiredOptions: {}
	},
	{
		name: 'somewhere-else',
		homeUrl: 'http://www.somewhere-else.com',
		requiredOptions: {}
	}
]
```

All available options:
```js
var options = {

	/*
		Exclude data sources by name.

		All data sources except 'somewhere-else':
		['somewhere-else']
	*/
	sourcesBlackList: null,

	/*
		Include data sources by name.

		Only 'somewhere':
		['somewhere']
	*/
	sourcesWhiteList: null,
};
```


## Defining Sources

Each of your data sources should be a separate JavaScript file to be included via node's `require()` method. You are only required to define a `getData(options)` method, which should return an event emitter. See the following sample for more details:
```js
// Core nodejs module.
// See https://nodejs.org/api/events.html
var EventEmitter = require('events').EventEmitter || require('events');

module.exports = {
	/*
		The home URL for this source. Used as a reference only.

		[optional]
	*/
	homeUrl: 'https://somewhere.com',

	/*
		Defines the options that are required to use this source.

		This source is skipped and warnings are displayed if any of these required options are missing.

		Example usage with required options:

			var DataSourcer = require('data-sourcer');

			var myDataSourcer = new DataSourcer({
				sourcesDir: 'path-to-your-sources-directory'
			});

			myDataSourcer.getData({
				sourceOptions: {
					somewhere: {
						apiKey: 'some-api-key'
					}
				}
			});

		[optional]
	*/
	requiredOptions: {
		apiKey: 'You can get an API key for this service by creating an account at https://somewhere.com'
	},

	/*
		The method that is called whenever `dataSourcer.getData()` is called.

		[required]
	*/
	getData: function(options) {

		var emitter = new EventEmitter();

		// Defer emitting events until the emitter has been returned.
		_.defer(function() {
			// When an error occurs, use the 'error' event.
			// The 'error' event can be emitted more than once.
			emitter.emit('error', new Error('Something bad happened!'));

			// When data is ready, use the 'data' event.
			// The 'data' event can be emitted more than once.
			emitter.emit('data', data);

			// When done getting data, emit the 'end' event.
			// The 'end' event should be emitted once.
			emitter.emit('end');
		});

		// Must return an event emitter.
		return emitter;
	}
};
```

Options that are passed to your sources:
* __filter__ - `object` - Passed through from the options that you provide the `getData` function.
* __newPage__ - `function` with signature `newPage(cb)` - Get a new puppeteer page instance. See the [puppeteer docs](https://pptr.dev/#?product=Puppeteer&version=v1.6.2&show=api-class-page) for more details. Use as follows:
* __request__ - `function` - Wrapper function for the [request](https://github.com/request/request#super-simple-to-use) module with the default options you provided via `defaultRequestOptions`. Requests made via the `options.request` instance are queued if using the `requestQueue` option.
* __series__ - `boolean` - Passed through from the options that you provide the `getData` function.
* __sourceOptions__ `object` - These are custom source options which are passed through to your source by name. You can use the `requiredOptions` source attribute to define which options are required for your source to run properly. Some example of a required option would be an API key or secret for some third-party web API.


## Contributing

There are a number of ways you can contribute:

* **Improve or correct the documentation** - All the documentation is in this `readme.md` file. If you see a mistake, or think something should be clarified or expanded upon, please [submit a pull request](https://github.com/chill117/data-sourcer/pulls/new)
* **Report a bug** - Please review [existing issues](https://github.com/chill117/data-sourcer/issues) before submitting a new one; to avoid duplicates. If you can't find an issue that relates to the bug you've found, please [create a new one](https://github.com/chill117/data-sourcer/issues).
* **Request a feature** - Again, please review the [existing issues](https://github.com/chill117/data-sourcer/issues) before posting a feature request. If you can't find an existing one that covers your feature idea, please [create a new one](https://github.com/chill117/data-sourcer/issues).
* **Fix a bug** - Have a look at the [existing issues](https://github.com/chill117/data-sourcer/issues) for the project. If there's a bug in there that you'd like to tackle, please feel free to do so. I would ask that when fixing a bug, that you first create a failing test that proves the bug. Then to fix the bug, make the test pass. This should hopefully ensure that the bug never creeps into the project again. After you've done all that, you can [submit a pull request](https://github.com/chill117/data-sourcer/pulls/new) with your changes.


## Tests

To run the tests, you will need to install the following:
* [mocha](https://mochajs.org/) - `npm install -g mocha`
* [eslint](https://eslint.org/) - `npm install -g eslint`

To run all tests:
```
npm test
```


## License

This software is [MIT licensed](https://tldrlegal.com/license/mit-license):
> A short, permissive software license. Basically, you can do whatever you want as long as you include the original copyright and license notice in any copy of the software/source.  There are many variations of this license in use.
