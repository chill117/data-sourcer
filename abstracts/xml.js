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
			{
				url: '',
				itemAttributes: {
					// ipAddress: 'title',
				},
				parseAttributes: {
					// ipAddress: '(.+)',
				},
			}
		],
	},

	getData: function(options) {

		var emitter = new EventEmitter();

		_.defer(function() {

			options = options || {};

			var onData = _.bind(emitter.emit, emitter, 'data');
			var onError = _.bind(emitter.emit, emitter, 'error');
			var onEnd = _.bind(emitter.emit, emitter, 'end');

			async.each(this.config.feeds, function(feed, nextFeed) {
				var requestOptions = _.result(feed, 'requestOptions');
				async.seq(
					function(next) {
						options.request(requestOptions, function(error, response) {
							if (error) return next(error);
							next(null, response);
						});
					},
					function(response, next) {
						if (response.statusCode >= 400) {
							return next(new Error(response.statusMessage));
						}
						parseXml(response.body, next);
					},
					function(xml, next) {
						try {
							var groups = getValueAtPath(xml, feed.paths.group);
							_.each(groups, function(group) {
								var items = getValueAtPath(group, feed.paths.item);
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
					}
				)(function(error) {
					if (error) onError(error);
					nextFeed();
				});
			}, function(error) {
				if (error) onError(error);
				onEnd();
			});

		}.bind(this));

		return emitter;
	},
};
