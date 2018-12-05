'use strict';

var _ = require('underscore');
var async = require('async');
var EventEmitter = require('events').EventEmitter || require('events');
var fs = require('fs');
var path = require('path');
var puppeteer = require('puppeteer');
var request = require('request');

var debug = {
	error: require('debug')('data-sourcer:error'),
};

var DataSourcer = module.exports = function(options) {

	this.options = this.prepareOptions(options, this.defaultOptions);
	this.sources = {};
	this.preparingBrowser = false;
	this.prepareInternalQueues();

	if (this.options.sourcesDir) {
		this.loadSourcesFromDir(this.options.sourcesDir);
	}
};

DataSourcer.prototype.defaultOptions = {

	/*
		Directory from which abstracts will be loaded.
	*/
	abstractsDir: path.join(__dirname, 'abstracts'),

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
		The maximum number of data items (while sampling) to emit via the 'data' event.
	*/
	sampleDataLimit: 10,

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

DataSourcer.prototype.addSource = function(name, source) {

	if (!this.isValidSourceName(name)) {
		throw new Error('Invalid source name: "' + name + '"');
	}

	if (this.sourceExists(name)) {
		throw new Error('Source already exists: "' + name + '"');
	}

	if (!_.isObject(source) || _.isNull(source)) {
		throw new Error('Expected "source" to be an object.');
	}

	if (source.abstract) {
		var abstract = this.loadAbstract(source.abstract);
		source = _.defaults(source, abstract);
	}

	var getData = source[this.options.getDataMethodName];
	if (!getData || !_.isFunction(getData)) {
		throw new Error('Source missing required method: "' + this.options.getDataMethodName + '"');
	}

	this.sources[name] = source;
};

DataSourcer.prototype.close = function(done) {

	if (this.browser) {
		this.browser.close().then(function() {
			done();
		}).catch(done);
	} else {
		_.defer(done);
	}
};

DataSourcer.prototype.loadAbstract = function(name) {

	if (!this.options.abstractsDir) {
		throw new Error('Cannot load abstract because the "abstractsDir" option is not set');
	}

	var abstractFilePath = path.join(this.options.abstractsDir, name);
	var abstract = _.clone(require(abstractFilePath));
	if (this.options.getDataMethodName !== 'getData') {
		abstract[this.options.getDataMethodName] = abstract.getData;
		abstract = _.omit(abstract, 'getData');
	}
	return abstract;
};

DataSourcer.prototype.arrayToObjectHash = function(array) {

	return _.object(_.map(array, function(value) {
		return [value, true];
	}));
};

DataSourcer.prototype.filterData = function(data, options) {

	options = options || {};

	var strict = options.mode === 'strict';

	return _.filter(data, function(item) {

		if (!item || !_.isObject(item) || _.isEmpty(item)) {
			return false;
		}

		var passedInclude = !options.include || _.every(options.include, function(test, field) {

			if (!test || (!strict && !item[field])) {
				// Ignore this test.
				return true;
			}

			if (_.isArray(item[field])) {
				return _.some(item[field], function(value) {
					return !!test[value];
				});
			}
			return !!test[item[field]];
		});

		if (!passedInclude) {
			return false;
		}

		var passedExclude = !options.exclude || _.every(options.exclude, function(test, field) {

			if (!test || (!strict && !item[field])) {
				// Ignore this test.
				return true;
			}

			if (_.isArray(item[field])) {
				return _.every(item[field], function(value) {
					return !test[value];
				});
			}

			return !test[item[field]];
		});

		if (!passedExclude) {
			return false;
		}

		return true;
	});
};

DataSourcer.prototype.processData = function(data, fn) {

	return _.chain(data).map(function(item) {
		item = _.clone(item);
		item = fn(item);
		if (!item || !_.isObject(item) || _.isEmpty(item)) return null;
		return item;
	}).compact().value();
};

DataSourcer.prototype.getData = function(options) {

	var emitter = new EventEmitter();

	_.defer(function() {

		options = this.prepareOptions(options, this.options);

		var sources = this.listSources(options);
		var asyncMethod = options.series === true ? 'eachSeries' : 'each';
		var onData = emitter.emit.bind(emitter, 'data');
		var onError = emitter.emit.bind(emitter, 'error');
		var onEnd = _.once(emitter.emit.bind(emitter, 'end'));
		var getDataFromSource = this.getDataFromSource.bind(this);

		async[asyncMethod](sources, function(source, next) {

			var sourceEmitter;

			var onSourceError = function(error) {
				// Add the source's name to the error messages.
				error.message = '[' + source.name + '] ' + error.message;
				onError(error);
			};

			var onSourceEnd = function() {
				if (sourceEmitter) {
					sourceEmitter.removeAllListeners();
					sourceEmitter = null;
				}
				next();
			};

			try {
				sourceEmitter = getDataFromSource(source.name, options)
					.on('data', onData)
					.on('error', onSourceError)
					.once('end', onSourceEnd);
			} catch (error) {
				onSourceError(error);
				onSourceEnd();
			}

		}, onEnd);

	}.bind(this));

	return emitter;
};

// Get data from a single source.
DataSourcer.prototype.getDataFromSource = function(name, options) {

	if (!this.sourceExists(name)) {
		throw new Error('Data source does not exist: "' + name + '"');
	}

	options = this.prepareOptions(options, this.options);

	var source = this.sources[name];

	if (source.requiredOptions) {
		_.each(source.requiredOptions, function(message, key) {
			if (
				_.isEmpty(options.sourceOptions) ||
				!options.sourceOptions[name] ||
				!_.isObject(options.sourceOptions[name]) ||
				_.isUndefined(options.sourceOptions[name][key])
			) {
				throw new Error('Missing required option (`option.sourceOptions.' + name + '.' + key + '`): ' + message);
			}
		});
	}

	var sourceOptions = this.prepareSourceOptions(name, options);
	var getData = source[this.options.getDataMethodName].bind(source);
	var gettingDataEmitter = getData(sourceOptions);

	if (!(gettingDataEmitter instanceof EventEmitter)) {
		throw new Error('Expected source\'s ("' + name + '") ' + this.options.getDataMethodName + ' method to return an instance of the event emitter class.');
	}

	var filterOptions = this.prepareFilterOptions(options.filter);
	var filterData = this.filterData.bind(this);
	var processData = this.processData.bind(this);
	var emitter = new EventEmitter();

	var processFn = function(item) {
		if (options.process) {
			item = options.process(item) || {};
		}
		// Add the 'source' attribute to every item:
		item.source = name;
		return item;
	};

	var onData = function(data) {
		data || (data = []);
		data = processData(data, processFn);
		data = filterData(data, filterOptions);
		if (data.length > 0) {
			if (options.sample && options.sampleDataLimit) {
				data = data.slice(0, options.sampleDataLimit);
			}
			emitter.emit('data', data);
		}
	};

	var onError = emitter.emit.bind(emitter, 'error');
	var onEnd = _.once(function() {
		if (gettingDataEmitter) {
			gettingDataEmitter.removeAllListeners();
			gettingDataEmitter = null;
		}
		emitter.emit('end');
	});

	gettingDataEmitter
		.on('data', onData)
		.on('error', onError)
		.once('end', onEnd);

	return emitter;
};

DataSourcer.prototype.listSources = function(options) {

	options = options || {};

	var sourcesWhiteList = options.sourcesWhiteList && this.arrayToObjectHash(options.sourcesWhiteList);
	var sourcesBlackList = options.sourcesBlackList && this.arrayToObjectHash(options.sourcesBlackList);

	var names = _.chain(this.sources).keys().filter(function(name) {
		if (sourcesWhiteList) return sourcesWhiteList[name];
		if (sourcesBlackList) return !sourcesBlackList[name];
		return true;
	}).value();

	return _.map(names, function(name) {
		var source = this.sources[name];
		return _.defaults(_.pick(source, 'defaultOptions', 'homeUrl', 'requiredOptions'), {
			defaultOptions: {},
			homeUrl: '',
			name: name || '',
			requiredOptions: {},
		});
	}, this);
};

DataSourcer.prototype.loadSourcesFromDir = function(dirPath) {

	var files = fs.readdirSync(dirPath);
	_.each(files, function(file) {
		var filePath = path.join(dirPath, file);
		this.loadSourceFromFile(filePath);
	}, this);
};

DataSourcer.prototype.loadSourceFromFile = function(filePath) {

	try {
		var name = path.basename(filePath, '.js');
		var source = require(filePath);
		this.addSource(name, source);
	} catch (error) {
		debug.error(error);
		return false;
	}

	return true;
};

DataSourcer.prototype.prepareFilterOptions = function(options) {

	options = JSON.parse(JSON.stringify(options || {}));

	var filterOptions = _.defaults(options || {}, {
		mode: 'strict'
	});

	var arrayToObjectHash = this.arrayToObjectHash.bind(this);

	_.each(['include', 'exclude'], function(type) {
		filterOptions[type] = _.mapObject(filterOptions[type], function(values) {
			return arrayToObjectHash(values);
		});
	});

	return filterOptions;
};

DataSourcer.prototype.prepareOptions = function(options, defaultOptions) {

	defaultOptions = (defaultOptions || {});
	options = _.defaults(options || {}, defaultOptions);

	if (!_.isUndefined(defaultOptions.browser)) {
		options.browser = _.defaults(options.browser || {}, defaultOptions.browser);
	}

	if (!_.isUndefined(defaultOptions.filter)) {
		options.filter = _.defaults(options.filter || {}, defaultOptions.filter || {});
		options.filter.include = _.defaults(options.filter.include || {}, defaultOptions.filter.include || {});
		options.filter.exclude = _.defaults(options.filter.exclude || {}, defaultOptions.filter.exclude || {});
	}

	if (!_.isUndefined(defaultOptions.requestQueue)) {
		options.requestQueue = _.defaults(options.requestQueue || {}, defaultOptions.requestQueue);
	}

	return options;
};

DataSourcer.prototype.prepareSourceOptions = function(name, options) {

	if (!this.sourceExists(name)) {
		throw new Error('Data source does not exist: "' + name + '"');
	}

	options = options || {};

	var source = this.sources[name];

	var sourceOptions = _.omit(options,
		'browser',
		'defaultRequestOptions',
		'requestQueue',
		'sourcesBlackList',
		'sourcesWhiteList'
	);

	// Deep clone the options object.
	// This prevents mutating the original options object.
	sourceOptions = JSON.parse(JSON.stringify(sourceOptions || {}));

	// Only include the sourceOptions for this source.
	sourceOptions.sourceOptions = _.defaults(
		sourceOptions.sourceOptions && sourceOptions.sourceOptions[name] || {},
		source.defaultOptions || {}
	);

	// Prepare request method.
	sourceOptions.request = this.prepareRequestMethod(options);

	// Prepare wrapper for getting new puppeteer page instance.
	sourceOptions.newPage = this.preparePage.bind(this);

	return sourceOptions;
};

DataSourcer.prototype.prepareRequestMethod = function(options) {

	options = options || {};
	var defaultRequestOptions = _.defaults(options.defaultRequestOptions || {}, this.defaultOptions.defaultRequestOptions);
	var fn = request.defaults(defaultRequestOptions);
	var requestQueue = this.prepareRequestQueue(options.requestQueue);

	return function() {
		requestQueue.push({ fn: fn, arguments: arguments });
	};
};

DataSourcer.prototype.prepareRequestQueue = function(options) {

	options = _.defaults(options || {}, this.defaultOptions.requestQueue);

	return async.queue(function(task, next) {
		task.fn.apply(undefined, task.arguments).on('response', function() {
			_.delay(next, options.delay);
		});
	}, options.concurrency);
};

DataSourcer.prototype.isValidSourceName = function(name) {

	return _.isString(name) && name.length > 0;
};

DataSourcer.prototype.sourceExists = function(name) {

	return _.has(this.sources, name);
};

DataSourcer.prototype.preparePage = function(done) {

	this.onBrowserReady(function() {
		this.browser.newPage().then(function(page) {
			done(null, page);
		}).catch(done);
	}.bind(this));
	this.prepareBrowser();
};

DataSourcer.prototype.prepareBrowser = function(done) {

	done = done || _.noop;

	if (this.browser || this.preparingBrowser) {
		this.onBrowserReady(done);
		return;
	}

	this.preparingBrowser = true;

	var options = _.clone(this.options.browser);

	/*
		See:
		https://github.com/GoogleChrome/puppeteer/blob/master/docs/troubleshooting.md#running-puppeteer-on-travis-ci
	*/
	if (process.env.TRAVIS_CI) {
		options.args = [].concat(options.args || [], ['--no-sandbox']);
	}

	puppeteer.launch(options).then(function(browser) {
		this.browser = browser;
		this.queues.onBrowserReady.resume();
		done();
	}.bind(this)).catch(done);
};

DataSourcer.prototype.onBrowserReady = function(fn) {

	if (this.browser) {
		_.defer(fn);
	} else {
		this.queues.onBrowserReady.push({ fn: fn });
	}
};

DataSourcer.prototype.prepareInternalQueues = function() {

	var queues = this.queues = {
		onBrowserReady: async.queue(function(task, next) {
			task.fn();
			next();
		}, 1),
	};

	// Pause all queues.
	// This prevents execution of queued items until queue.resume() is called.
	_.invoke(queues, 'pause');
};
