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

// `gettingData` is an event emitter object.
var gettingData = myDataSourcer.getData({
	series: true,
	filter: {
		mode: 'stict',
		include: {
			someField: ['1']
		}
	}
});

gettingData.on('data', function(data) {
	// Received some data.
	console.log(data);
});

gettingData.on('error', function(error) {
	// Some error has occurred.
	console.error(error);
});

gettingData.once('end', function() {
	// Done getting data.
	console.log('Done!');
});
```


All available options:
```js
var options = {
	/*
		Directory from which sources will be loaded.
	*/
	sourcesDir: null,

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
		Include data sources by name.

		Only 'somewhere':
		['somewhere']
	*/
	sourcesWhiteList: null,

	/*
		Exclude data sources by name.

		All data sources except 'somewhere-else':
		['somewhere-else']
	*/
	sourcesBlackList: null,

	/*
		Set to TRUE to have all asynchronous operations run in series.
	*/
	series: false,

	/*
		Default request module options. For example you could pass the 'proxy' option in this way.

		See for more info:
		https://github.com/request/request#requestdefaultsoptions
	*/
	defaultRequestOptions: null,
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
		homeUrl: 'http://somewhere.com'
	},
	{
		name: 'somewhere-else',
		homeUrl: 'http://www.somewhere-else.com'
	}
]
```

All available options:
```js
var options = {
	/*
		Include data sources by name.

		Only 'somewhere':
		['somewhere']
	*/
	sourcesWhiteList: null,

	/*
		Exclude data sources by name.

		All data sources except 'somewhere-else':
		['somewhere-else']
	*/
	sourcesBlackList: null
};
```


## Defining Sources

Each of your data sources should be a separate JavaScript file. You are only required to define a `getData(options)` method, which should return an event emitter. See the following sample for more details:
```js
// Core nodejs module.
// See https://nodejs.org/api/events.html
var EventEmitter = require('events').EventEmitter || require('events');

module.exports = {
	homeUrl: 'https://somewhere.com',
	getData: function(options) {

		var emitter = new EventEmitter();

		// When an error occurs, use the 'error' event.
		// The 'error' event can be emitted more than once.
		emitter.emit('error', new Error('Something bad happened!'));

		// When data is ready, use the 'data' event.
		// The 'data' event can be emitted more than once.
		emitter.emit('data', data);

		// When done getting data, emit the 'end' event.
		// The 'end' event should be emitted once.
		emitter.emit('end');

		// Must return an event emitter.
		return emitter;
	}
};
```

Please note that there are a couple options that you should respect in within your data sources:
* **sample** - `boolean` If `options.sample` is `true` then you should do your best to make the fewest number of HTTP requests to the data source but still get at least some real data. The purpose of this option is to reduce the strain caused by this module's unit tests on each data sources' servers.
* **series** - `boolean` If `options.series` is `true` you should make sure that all asynchronous code in your source is run in series, NOT parallel. The purpose is to reduce the memory usage of the module so that it can be run in low-memory environments such as a VPS with 256MB of RAM.


## Contributing

There are a number of ways you can contribute:

* **Improve or correct the documentation** - All the documentation is in this `readme.md` file. If you see a mistake, or think something should be clarified or expanded upon, please [submit a pull request](https://github.com/chill117/data-sourcer/pulls/new)
* **Report a bug** - Please review [existing issues](https://github.com/chill117/data-sourcer/issues) before submitting a new one; to avoid duplicates. If you can't find an issue that relates to the bug you've found, please [create a new one](https://github.com/chill117/data-sourcer/issues).
* **Request a feature** - Again, please review the [existing issues](https://github.com/chill117/data-sourcer/issues) before posting a feature request. If you can't find an existing one that covers your feature idea, please [create a new one](https://github.com/chill117/data-sourcer/issues).
* **Fix a bug** - Have a look at the [existing issues](https://github.com/chill117/data-sourcer/issues) for the project. If there's a bug in there that you'd like to tackle, please feel free to do so. I would ask that when fixing a bug, that you first create a failing test that proves the bug. Then to fix the bug, make the test pass. This should hopefully ensure that the bug never creeps into the project again. After you've done all that, you can [submit a pull request](https://github.com/chill117/data-sourcer/pulls/new) with your changes.


## Tests

To run all tests:
```
grunt test
```
