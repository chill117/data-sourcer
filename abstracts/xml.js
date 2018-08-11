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
				async.each(feed.urls, function(feedUrl, nextUrl) {
					async.seq(
						function(next) {
							options.request({
								url: feedUrl,
								headers: {
									'User-Agent': 'Mozilla/5.0 Chromium/70.0.3000.60',
								},
							}, function(error, response) {
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
								var items = getValueAtPath(xml, feed.itemsPath)
								items = _.map(items, function(item) {
									return _.mapObject(feed.itemAttributePaths, function(path, key) {
										var value = getValueAtPath(item, path);
										var parse = feed.parseAttributes[key];
										if (parse) {
											if (_.isString(parse)) {
												var parseRegExp = new RegExp(parse);
												if (parseRegExp) {
													var match = value.match(parseRegExp);
													value = match && match[1] || null;
												}
											} else if (_.isFunction(parse)) {
												value = parse(value);
											}
										}
										return value;
									});
								});
								onData(items);
							} catch (error) {
								return next(error);
							}
						}
					)(function(error) {
						if (error) onError(error);
						nextUrl();
					});
				}, nextFeed);
			}, function(error) {
				if (error) onError(error);
				onEnd();
			});

		}.bind(this));

		return emitter;
	},
};
