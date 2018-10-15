'use strict';

var _ = require('underscore');
var async = require('async');
var EventEmitter = require('events').EventEmitter || require('events');
var parseXml = require('xml2js').parseString;

var getValueAtPath = function(objectOrArray, path) {
	var value = objectOrArray;
	path = path.split('/');
	while (path.length) {
		value = value[path.shift()] || [];
	}
	return value;
};

module.exports = {

	homeUrl: null,
	config: {
		feeds: [
			// {
			// 	requestOptions: {
			// 		url: 'https://example.com/',
			// 		headers: {
			// 			'Host': 'example.com',
			// 		}
			// 	},
			// 	paths: {
			// 		group: 'rss/channel',
			// 		item: 'item',
			// 		attributes: {
			// 			ipAddress: 'title/0',
			// 			port: 'title/0',
			// 		},
			// 	},
			// 	parseAttributes: {
			// 		ipAddress: '(.+):[0-9]+',
			// 		port: function(port) {
			// 			return parseInt(port);
			// 		},
			// 	},
			// }
		],
	},

	getData: function(options) {

		var emitter = new EventEmitter();

		_.defer(function() {

			options = options || {};

			var onData = _.bind(emitter.emit, emitter, 'data');
			var onError = _.bind(emitter.emit, emitter, 'error');
			var onEnd = _.bind(emitter.emit, emitter, 'end', null);
			var getDataFromFeed = _.bind(this.getDataFromFeed, this);
			var feeds = this.config.feeds || [];

			if (options.sample && feeds.length > 0) {
				feeds = feeds.slice(0, 1);
			}

			var asyncMethod = options.series === true ? 'eachSeries' : 'each';
			async[asyncMethod](feeds, function(feed, next) {
				getDataFromFeed(feed, options, onData, function(error) {
					// Emit the error, but don't stop the async.each() loop.
					if (error) onError(error);
					next();
				});
			}, onEnd);

		}.bind(this));

		return emitter;
	},

	getDataFromFeed: function(feed, options, onData, done) {

		var requestOptions = _.result(feed, 'requestOptions');

		async.seq(
			function(next) {
				options.request(requestOptions, function(error, response) {
					if (error) return next(error);
					if (response.statusCode >= 400) {
						return next(new Error(response.statusMessage));
					}
					next(null, response.body);
				});
			},
			function(responseBody, next) {
				parseXml(responseBody, next);
			},
			function(xml, next) {
				try {
					var groups = getValueAtPath(xml, feed.paths.group) || [];
					if (options.sample && groups.length > 0) {
						// When sampling, only include the first few groups.
						groups = groups.slice(0, 5);
					}
					_.each(groups, function(group) {
						var items = getValueAtPath(group, feed.paths.item) || [];
						if (options.sample && items.length > 0) {
							// When sampling, only include the first few items.
							items = items.slice(0, 10);
						}
						items = _.chain(items).map(function(item) {
							return _.chain(feed.paths.attributes).mapObject(function(path, key) {
								return getValueAtPath(item, path);
							}).mapObject(function(value, key, context) {
								var parse = feed.parseAttributes[key];
								if (parse) {
									if (_.isString(parse)) {
										var parseRegExp = new RegExp(parse);
										if (parseRegExp) {
											var match = value.match(parseRegExp);
											value = match && match[1] || null;
										}
									} else if (_.isFunction(parse)) {
										value = parse.call(context, value);
									}
								}
								return value;
							}).value();
						}).filter(function(item) {
							return !_.isEmpty(item);
						}).value();
						onData(items);
					});
				} catch (error) {
					return next(error);
				}
				next();
			}
		)(done);
	},
};
