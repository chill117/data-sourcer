'use strict';

var _ = require('underscore');
var async = require('async');
var EventEmitter = require('events').EventEmitter || require('events');

module.exports = {
	homeUrl: null,
	defaultOptions: {},
	config: {
		startUrls: [
			// 'https://example.com/proxy-list-1.html',
			// 'https://example.com/proxy-list-2.html',
		],
		listLinks: [
			// '#nav a',
			// '#header a.proxy-list-link',
		],
		// items: {
		// 	selector: '#proxies table tr',
		// 	attributes: [
		// 		{
		// 			name: 'ipAddress',
		// 			selector: 'td:nth-child(1)',
		// 			// Optional additional processing on the text content of the selected element.
		// 			parse: function(text) {
		// 				return text;
		// 			},
		// 		},
		// 	],
		// },
		// list: {
		// 	selector: 'pre',
		// 	// Parse the text content of the selected element.
		// 	// Return array of items.
		// 	parse: function(text) {
		// 		return text.trim().split('\n').map(function(item) {
		// 			var match = item.trim().match(/^([0-9\.]+):([0-9]+)/);
		// 			if (!match || !match[1] || !match[2]) return null;
		// 			return {
		// 				ipAddress: match[1],
		// 				port: parseInt(match[2]),
		// 			};
		// 		}).filter(Boolean);
		// 	},
		// },
	},

	getData: function(options) {

		var emitter = new EventEmitter();

		_.defer(function() {

			options = options || {};
			options.newPage(function(error, page) {

				var onData = _.bind(emitter.emit, emitter, 'data');
				var onError = _.bind(emitter.emit, emitter, 'error');
				var onEnd = _.once(function() {
					if (page && !page.isClosed()) {
						page.close().catch(onError);
						page = null;
					}
					emitter.emit('end');
				});

				if (error) {
					onError(error);
					return onEnd();
				}

				var navigate = this.navigate.bind(this, page);
				var scrapeListPage = this.scrapeListPage.bind(this, page);
				var startUrls = this.config.startUrls;
				var listLinks = this.config.listLinks;

				if (options.sample) {
					startUrls = startUrls.slice(0, 1);
					listLinks = listLinks.slice(0, 1);
				}

				async.eachSeries(listLinks, function(listLink, nextListLink) {
					async.eachSeries(startUrls, function(startUrl, nextStartUrl) {
						navigate(startUrl, function(error) {
							if (error) return nextStartUrl(error);
							scrapeListPage(listLink, function(error, data) {
								if (error) return nextStartUrl(error);
								if (!_.isEmpty(data)) onData(data);
								nextStartUrl();
							});
						});
					}, nextListLink);
				}, function(error) {
					if (error) onError(error);
					onEnd();
				});

			}.bind(this));
		}.bind(this));

		return emitter;
	},

	scrapeListPage: function(page, linkSelector, done) {
		async.seq(
			this.waitForElement.bind(this, page, linkSelector),
			this.extractLinkUrl.bind(this, page, linkSelector),
			this.navigate.bind(this, page),
			this.waitForListOrItemsElements.bind(this, page),
			this.scrapeListData.bind(this, page)
		)(done);
	},

	extractLinkUrl: function(page, selector, done) {
		page.evaluate(function(selector) {
			return new Promise(function(resolve, reject) {
				var linkUrl;
				try {
					var linkEl = document.querySelector(selector);
					if (!linkEl) {
						throw new Error('Could not find link element');
					}
					linkUrl = linkEl.href;
				} catch (error) {
					return reject(error.message);
				}
				resolve(linkUrl);
			});
		}, selector).then(function(linkUrl) {
			done(null, linkUrl);
		}).catch(done);
	},

	navigate: function(page, goToUrl, done) {
		page.goto(goToUrl).then(function() {
			done();
		}).catch(done);
	},

	waitForListOrItemsElements: function(page, done) {
		var selector;
		if (this.config.list) {
			selector = this.config.list.selector;
		} else if (this.config.items) {
			selector = this.config.items.selector;
		}
		this.waitForElement(page, selector, done);
	},

	waitForElement: function(page, selector, done) {
		page.waitFor(selector).then(function() {
			done();
		}).catch(done);
	},

	scrapeListData: function(page, done) {
		var config = this.config;
		done = _.once(done || _.noop);
		page.evaluate(function(config) {
			return new Promise(function(resolve, reject) {
				try {
					var data;
					if (config.list) {
						var listEl = document.querySelector(config.list.selector);
						if (!listEl) {
							throw new Error('Could not find list element');
						}
						data = listEl.textContent;
					} else if (config.items) {
						var itemEls = document.querySelectorAll(config.items.selector);
						if (!itemEls) {
							throw new Error('Could not find item elements');
						}
						data = [];
						for (var index = 0; index < itemEls.length; index++) {
							(function(itemEl) {
								var item = {};
								config.items.attributes.forEach(function(attribute) {
									var attrEl = itemEl.querySelector(attribute.selector);
									if (!attrEl) return;
									var value = attrEl.textContent;
									if (value) {
										item[attribute.name] = value;
									}
								});
								if (Object.keys(item).length > 0) {
									data.push(item);
								}
							})(itemEls[index]);
						}
					}
				} catch (error) {
					return reject(error.message);
				}
				return resolve(data);
			});
		}, config).then(function(data) {
			try {
				if (config.list && config.list.parse) {
					data = config.list.parse(data);
				} else if (config.items) {
					data = _.chain(data).map(function(item) {
						item = _.mapObject(item, function(value, key) {
							var attribute = _.findWhere(config.items.attributes, { name: key });
							if (attribute.parse) {
								if (_.isString(attribute.parse)) {
									var parseRegExp = new RegExp(attribute.parse);
									if (parseRegExp) {
										var match = value.match(parseRegExp);
										value = match && match[1] || null;
									}
								} else if (_.isFunction(attribute.parse)) {
									value = attribute.parse(value);
								}
							}
							return value;
						});
						return item;
					}).compact().value();
				}
			} catch (error) {
				return done(error);
			}
			done(null, data);
		}).catch(done);
	},
};
