'use strict';

var _ = require('underscore');
var async = require('async');

module.exports = {
	homeUrl: null,
	defaultOptions: {
		numPagesToScrape: 10,
		defaultTimeout: 2000,
		defaultNavigationTimeout: 30000,
		viewport: {
			width: 1280,
			height: 800,
		},
		nextPageDelay: 0,
		waitForValidData: {
			test: function(item) {
				return _.some(item, function(value) {
					return !_.isNull(value) && !_.isUndefined(value);
				});
			},
			checkFrequency: 50,
			timeout: 2000,
		},
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
					page.setDefaultNavigationTimeout(options.sourceOptions.defaultNavigationTimeout);
					page.setViewport(options.sourceOptions.viewport);
				} catch (error) {
					onError(error);
					return onEnd();
				}

				var scrapeFirstPage = this.goToStartPageAndScrapeData.bind(this, page, options);
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
							scrapedDataInLastPage = data && data.length > 0;
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

	goToStartPageAndScrapeData: function(page, options, done) {
		async.seq(
			this.goToStartPage.bind(this, page),
			this.waitForAllItemRelatedElements.bind(this, page),
			this.waitForValidData.bind(this, page, options)
		)(done);
	},

	goToNextPageAndScrapeData: function(page, options, done) {
		page.$(this.config.selectors.nextLink).then(function(el) {
			// Next link does not exist - stop here.
			if (!el) return done();
			async.seq(
				this.goToNextPage.bind(this, page),
				function(next) {
					_.delay(next, options.sourceOptions.nextPageDelay);
				},
				this.waitForAllItemRelatedElements.bind(this, page),
				this.waitForValidData.bind(this, page, options)
			)(done);
		}.bind(this)).catch(done);
	},

	goToStartPage: function(page, done) {
		this.navigate(page, this.config.startPageUrl, done);
	},

	goToNextPage: function(page, done) {
		async.seq(
			this.waitForElement.bind(this, page, this.config.selectors.nextLink),
			this.clickElement.bind(this, page, this.config.selectors.nextLink)
		)(done);
	},

	waitForAllItemRelatedElements: function(page, done) {
		async.parallel([
			this.waitForItemElements.bind(this, page),
			this.waitForItemAttributeElements.bind(this, page),
		], function(error) {
			if (error) return done(error);
			done();
		});
	},

	waitForItemElements: function(page, done) {
		this.waitForElement(page, this.config.selectors.item, done);
	},

	waitForItemAttributeElements: function(page, done) {
		var tasks = _.map(this.config.selectors.itemAttributes, function(attributeSelector) {
			return function(next) {
				var selector = this.config.selectors.item + ' ' + attributeSelector;
				page.waitFor(selector).then(function() {
					next();
				}).catch(next);
			}.bind(this);
		}, this);
		async.race(tasks, done)
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
		done = _.once(done);
		page.goto(goToUrl).catch(function(error) {
			var match = error.message.match(/Navigation Timeout Exceeded: ([0-9]+[a-z]+) exceeded/i);
			if (match) {
				return done(new Error('Navigation Timeout Exceeded (' + goToUrl + '): ' + match[1] + ' exceeded'));
			}
			done(error);
		});
		page.once('response', function(response) {
			if (response.status() >= 400) {
				return done(new Error('HTTP ' + response.status() + ' (' + goToUrl + '): ' + response.statusText()));
			}
			done();
		});
	},

	waitForValidData: function(page, options, done) {
		var startTime = Date.now();
		var scrapedData;
		async.until(function(next) {
			try {
				var elapsedTime = Date.now() - startTime;
				if (elapsedTime >= options.sourceOptions.waitForValidData.timeout) {
					return next(new Error('Timed out while waiting for valid data'));
				}
				this.scrapeData(page, function(error, data) {
					if (error) return next(error);
					try {
						var hasValidData = _.some(data, function(item) {
							return options.sourceOptions.waitForValidData.test(item);
						});
						if (hasValidData) {
							scrapedData = data;
						}
					} catch (error) {
						return next(error);
					}
					next(null, hasValidData);
				});
			} catch (error) {
				return next(error);
			}
		}.bind(this), function(next) {
			try {
				_.delay(next, options.sourceOptions.waitForValidData.checkFrequency);
			} catch (error) {
				return next(error);
			}
		}.bind(this), function(error) {
			if (error) return done(error);
			done(null, scrapedData);
		});
	},

	scrapeData: function(page, done) {
		var config = this.config;
		page.evaluate(function(config) {
			return new Promise(function(resolve, reject) {
				try {
					var data = [];
					var itemEls = document.querySelectorAll(config.selectors.item);
					if (!itemEls) {
						throw new Error('Could not find item elements (selector: "' + config.selectors.item + '")');
					}
					for (var index = 0; index < itemEls.length; index++) {
						(function(itemEl) {
							var item = {};
							Object.keys(config.selectors.itemAttributes).forEach(function(key) {
								var selector = config.selectors.itemAttributes[key];
								var attrEl = itemEl.querySelector(selector);
								if (!attrEl) {
									item[key] = null;
								} else {
									item[key] = attrEl.textContent || '';
								}
							});
							if (Object.keys(item).length > 0) {
								data.push(item);
							}
						})(itemEls[index]);
					}
				} catch (error) {
					return reject(error.message);
				}
				return resolve(data);
			});
		}, config).then(function(data) {
			try {
				if (config.parseAttributes) {
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
				}
			} catch (error) {
				return done(error);
			}
			done(null, data);
		}).catch(done);
	},
};
