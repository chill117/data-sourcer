'use strict';

var _ = require('underscore');
var async = require('async');
var EventEmitter = require('events').EventEmitter || require('events');

module.exports = {

	homeUrl: null,
	defaultOptions: {
		numPagesToScrape: 10,
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

		var emitter = new EventEmitter();

		_.defer(function() {

			options = options || {};
			options.newPage(function(error, page) {

				var onData = _.bind(emitter.emit, emitter, 'data');
				var onError = _.bind(emitter.emit, emitter, 'error');
				var onEnd = _.once(function() {
					page && page.close();
					emitter.emit('end');
				});

				if (error) {
					onError(error);
					return onEnd();
				}

				var scrapeFirstPage = this.goToStartPageAndScrapeData.bind(this, page);
				var scrapeNextPage = this.goToNextPageAndScrapeData.bind(this, page);
				var numPagesToScrape = options.sample ? 1 : options.sourceOptions.numPagesToScrape;

				scrapeFirstPage(function(error, data) {

					if (error) {
						onError(error);
						return onEnd();
					}

					onData(data);

					var numScraped = 1;
					var scrapedDataInLastPage = data.length > 0;

					async.until(function() {
						return !scrapedDataInLastPage || numScraped >= numPagesToScrape;
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
			this.scrapeData.bind(this, page)
		)(done);
	},

	goToNextPageAndScrapeData: function(page, done) {

		this.nextPaginationLinkExists(page, function(error, exists) {
			if (error) return done(error);
			if (!exists) return done();
			async.seq(
				this.goToNextPage.bind(this, page),
				this.scrapeData.bind(this, page)
			)(done);
		}.bind(this));
	},

	goToStartPage: function(page, done) {

		async.seq(
			this.navigate.bind(this, page, this.config.startPageUrl),
			this.waitForListElement.bind(this, page)
		)(done);
	},

	navigate: function(page, goToUrl, done) {

		page.goto(goToUrl).then(function() {
			done();
		}).catch(done);
	},

	goToNextPage: function(page, done) {

		async.seq(
			this.clickNextPaginationLink.bind(this, page),
			this.waitForListElement.bind(this, page)
		)(done);
	},

	nextPaginationLinkExists: function(page, done) {

		page.$(this.config.selectors.nextLink).then(function($el) {
			done(null, !!$el);
		}).catch(done);
	},

	clickNextPaginationLink: function(page, done) {

		page.click(this.config.selectors.nextLink).then(function() {
			done();
		}).catch(done);
	},

	waitForListElement: function(page, done) {

		page.waitFor(this.config.selectors.item).then(function() {
			done();
		}).catch(done);
	},

	scrapeData: function(page, done) {

		var config = this.config;

		page.evaluate(function(config) {
			var data = [];
			try {
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
				return Promise.reject(error);
			}
			return Promise.resolve(data);
		}, config).then(function(data) {
			data = _.chain(data).map(function(item) {
				try {
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
				} catch (error) {
					item = null;
				}
				return item;
			}).compact().value();
			done(null, data);
		}).catch(done);
	},
};
