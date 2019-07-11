'use strict';

var _ = require('underscore');
var async = require('async');

module.exports = {

	homeUrl: null,
	defaultOptions: {
		numPagesToScrape: 10,
		defaultTimeout: 20000,
		viewport: {
			width: 1280,
			height: 800,
		},
		nextPageDelay: 0,
	},
	config: {
		startPageUrl: null,
		selectors: {
			item: null,
			itemAttributes: {
				ipAddress: null,
			},
			nextLink: null,
		},
		parseAttributes: {
			// ipAddress: '(.+)',
		},
	},

	getData: function(options) {

		var emitter = options.newEventEmitter();

		_.defer(function() {

			options = options || {};
			options.newPage(function(error, page) {

				var onData = _.bind(emitter.emit, emitter, 'data');
				var onError = _.bind(emitter.emit, emitter, 'error');
				var onEnd = _.once(_.bind(emitter.emit, emitter, 'end'));

				if (error) {
					onError(error);
					return onEnd();
				}

				try {
					page.setDefaultTimeout(options.sourceOptions.defaultTimeout);
					page.setViewport(options.sourceOptions.viewport);
				} catch (error) {
					onError(error);
				}

				var scrapeFirstPage = this.goToStartPageAndScrapeData.bind(this, page);
				var scrapeNextPage = this.goToNextPageAndScrapeData.bind(this, page, options);
				var numPagesToScrape = options.sourceOptions.numPagesToScrape;
				if (options.sample) {
					numPagesToScrape = Math.min(numPagesToScrape, 2);
				}

				scrapeFirstPage(function(error, data) {

					if (error) {
						onError(error);
						return onEnd();
					}

					onData(data);

					var numScraped = 1;
					var scrapedDataInLastPage = data.length > 0;
					var doContinueScraping = function() {
						return !!scrapedDataInLastPage && numScraped < numPagesToScrape;
					};

					if (!doContinueScraping()) {
						return onEnd();
					}

					async.whilst(function(next) {
						next(null, doContinueScraping());
					}, function(next) {
						scrapeNextPage(function(error, data) {
							if (error) return next(error);
							scrapedDataInLastPage = data.length > 0;
							numScraped++;
							onData(data);
							next();
						});
					}, function(error) {
						if (error) onError(error);
						onEnd();
					});
				});

			}.bind(this));
		}.bind(this));

		return emitter;
	},

	goToStartPageAndScrapeData: function(page, done) {
		async.seq(
			this.goToStartPage.bind(this, page),
			this.waitForElement.bind(this, page, this.config.selectors.item),
			this.scrapeData.bind(this, page)
		)(done);
	},

	goToNextPageAndScrapeData: function(page, options, done) {
		done = _.once(done);
		async.seq(
			this.goToNextPage.bind(this, page),
			function(next) {
				_.delay(next, options.sourceOptions.nextPageDelay);
			},
			this.waitForElement.bind(this, page, this.config.selectors.item),
			this.scrapeData.bind(this, page)
		)(done);
	},

	goToStartPage: function(page, done) {
		this.navigate(page, this.config.startPageUrl, done);
	},

	goToNextPage: function(page, done) {
		async.seq(
			this.waitForElement.bind(this, page, this.config.selectors.nextLink),
			this.clickElement.bind(this, page, this.config.selectors.nextLink),
		)(done);
	},

	waitForElement: function(page, selector, done) {
		page.waitFor(selector).then(function() {
			done();
		}).catch(done);
	},

	clickElement: function(page, selector, done) {
		page.click(selector).then(function() {
			done();
		}).catch(done);
	},

	navigate: function(page, goToUrl, done) {
		page.goto(goToUrl).then(function() {
			done();
		}).catch(done);
	},

	scrapeData: function(page, done) {
		var config = this.config;
		done = _.once(done || _.noop);
		page.evaluate(function(config) {
			return new Promise(function(resolve, reject) {
				try {
					var data = [];
					var itemEls = document.querySelectorAll(config.selectors.item);
					if (itemEls) {
						for (var index = 0; index < itemEls.length; index++) {
							(function(itemEl) {
								var item = {};
								Object.keys(config.selectors.itemAttributes).forEach(function(key) {
									var selector = config.selectors.itemAttributes[key];
									var attrEl = itemEl.querySelector(selector);
									if (!attrEl) return;
									var value = attrEl.textContent;
									if (value) {
										item[key] = value;
									}
								});
								if (Object.keys(item).length > 0) {
									data.push(item);
								}
							})(itemEls[index]);
						}
					}
				} catch (error) {
					return reject(error);
				}
				return resolve(data);
			});
		}, config).then(function(data) {
			try {
				data = _.map(data, function(item) {
					item = _.mapObject(item, function(value, key) {
						var parse = config.parseAttributes[key];
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
					return item;
				});
			} catch (error) {
				return done(error);
			}
			done(null, data);
		}).catch(done);
	},
};
