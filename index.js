'use strict';

var _ = require('underscore');
var async = require('async');
var EventEmitter = require('events').EventEmitter || require('events');
var fs = require('fs');
var path = require('path');
var request = require('request');

var debug = {
	error: require('debug')('data-sourcer:error'),
};

var DataSourcer = module.exports = function(options) {

	this.options = this.prepareOptions(options, {

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
			Use a queue to limit the number of simultaneous HTTP requests.
		*/
		requestQueue: {
			/*
				The maximum number of simultaneous requests. Set to 0 for unlimited.
			*/
			concurrency: 0,
			/*
				The time (in milliseconds) between each request. Set to 0 for no delay.
			*/
			delay: 0,
		},

		/*
			Default request module options. For example you could pass the 'proxy' option in this way.

			See for more info:
			https://github.com/request/request#requestdefaultsoptions
		*/
		defaultRequestOptions: null,
	});

	this.sources = {};

	if (this.options.sourcesDir) {
		this.loadSourcesFromDir(this.options.sourcesDir);
	}
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

	if (!source.getData || !_.isFunction(source.getData)) {
		throw new Error('Source missing required "getData" method.');
	}

	this.sources[name] = source;
};

DataSourcer.prototype.arrayToObjectHash = function(array) {
	return _.object(_.map(array, function(value) {
		return [value, true];
	}));
};

DataSourcer.prototype.filterData = function(data, options) {

	options || (options = {});

	var strict = options.mode === 'strict';

	return _.filter(data, function(item) {

		if (!item || !_.isObject(item)) {
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

DataSourcer.prototype.getData = function(options) {

	options = this.prepareOptions(options, this.options);

	var emitter = new EventEmitter();
	var sources = this.listSources(options);
	var asyncMethod = options.series === true ? 'eachSeries' : 'each';
	var onData = _.bind(emitter.emit, emitter, 'data');
	var onError = _.bind(emitter.emit, emitter, 'error');
	var onEnd = _.once(_.bind(emitter.emit, emitter, 'end'));

	async[asyncMethod](sources, _.bind(function(source, next) {

		try {
			var gettingData = this.getDataFromSource(source.name, options);
		} catch (error) {
			// Log the error (for debugging).
			debug.error(error);
			// Execute the callback without an error, to continue getting data from other sources.
			return next();
		}

		gettingData.on('data', onData);
		gettingData.on('error', onError);
		gettingData.on('end', _.once(_.bind(next, undefined, null)));

	}, this), onEnd);

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
			if (!options[name] || !_.isObject(options[name]) || !options[name][key]) {
				throw new Error('Missing required option (`option.' + name + '.' + key + '`): ' + message);
			}
		});
	}

	var emitter = new EventEmitter();
	var onData = _.bind(emitter.emit, emitter, 'data');
	var onError = _.bind(emitter.emit, emitter, 'error');
	var onEnd = _.once(_.bind(emitter.emit, emitter, 'end'));
	var sourceOptions = this.prepareSourceOptions(options);
	var filterOptions = this.prepareFilterOptions(options.filter);
	var gettingData = source.getData(sourceOptions);

	gettingData.on('data', function(data) {

		data || (data = []);
		data = this.filterData(data, filterOptions);

		// Add the 'source' attribute to every item.
		data = _.map(data, function(item) {
			item.source = name;
			return item;
		});

		onData(data);

	}.bind(this));

	gettingData.on('error', onError);
	gettingData.once('end', onEnd);

	return emitter;
};

DataSourcer.prototype.isValidSourceName = function(name) {
	return _.isString(name) && name.length > 0;
};

DataSourcer.prototype.listSources = function(options) {

	options || (options = {});

	var sourcesWhiteList = options.sourcesWhiteList && this.arrayToObjectHash(options.sourcesWhiteList);
	var sourcesBlackList = options.sourcesBlackList && this.arrayToObjectHash(options.sourcesBlackList);

	// Get an array of source names filtered by the options.
	var sourceNames = _.filter(_.keys(this.sources), function(name) {
		if (sourcesWhiteList) return sourcesWhiteList[name];
		if (sourcesBlackList) return !sourcesBlackList[name];
		return true;
	});

	return _.map(sourceNames, function(name) {

		var source = this.sources[name];

		return {
			name: name,
			homeUrl: source.homeUrl || '',
			requiredOptions: source.requiredOptions || {}
		};

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
	var source = require(filePath);
	var name = path.basename(filePath, '.js');
	this.addSource(name, source);
};

DataSourcer.prototype.prepareFilterOptions = function(options) {
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
	if (!_.isUndefined(defaultOptions.filter)) {
		options.filter = _.defaults(options.filter || {}, defaultOptions.filter || {});
		options.filter.include = _.defaults(options.filter.include || {}, defaultOptions.filter.include || {});
		options.filter.exclude = _.defaults(options.filter.exclude || {}, defaultOptions.filter.exclude || {});
	}
	if (!_.isUndefined(defaultOptions.requestQueue)) {
		options.requestQueue = _.defaults(options.requestQueue, defaultOptions.requestQueue);
	}
	return options;
};

DataSourcer.prototype.prepareRequestQueue = function(options) {
	options = _.defaults(options || {}, {
		concurrency: 0,
		delay: 0
	});
	return async.queue(function(task, next) {
		task.fn.apply(task.fn, task.arguments).on('response', function() {
			_.delay(next, options.delay);
		});
	}, options.concurrency);
};

DataSourcer.prototype.prepareSourceOptions = function(options) {

	options = (options || {});

	var sourceOptions = _.omit(options,
		'sourcesWhiteList',
		'sourcesBlackList',
		'requestQueue',
		'defaultRequestOptions'
	);

	// Deep clone the options object.
	// This prevents mutating the original options object.
	sourceOptions = JSON.parse(JSON.stringify(sourceOptions || {}));

	// Prepare request instance for the source.
	var requestInstance = request.defaults(options.defaultRequestOptions || {});

	if (options.requestQueue && options.requestQueue.concurrency) {
		var requestQueue = this.prepareRequestQueue(options.requestQueue);
		sourceOptions.request = function() {
			requestQueue.push({ fn: requestInstance, arguments: arguments });
		};
	} else {
		sourceOptions.request = requestInstance;
	}

	return sourceOptions;
};

DataSourcer.prototype.sourceExists = function(name) {
	return _.has(this.sources, name);
};
