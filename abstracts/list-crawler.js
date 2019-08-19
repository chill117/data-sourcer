'use strict';

var _ = require('underscore');
var async = require('async');

var queues = {
	sync: async.queue(function(task, next) {
		task.fn(function() {
			next();
		});
	}, 1/* concurrency */),
};

module.exports = {
	homeUrl: null,
	defaultOptions: {
		defaultTimeout: 2000,
		defaultNavigationTimeout: 30000,
		viewport: {
			width: 1280,
			height: 800,
		},
		scraping: {
			test: function(item) {
				return _.some(item, function(value) {
					return !_.isNull(value) && !_.isUndefined(value);
				});
			},
			frequency: 50,
			timeout: 2000,
		},
		pagination: {
			maxPages: 10,
		},
	},
	config: {
		// lists: [
		// 	// An array of lists to crawl.
		// 	{
		// 		link: {
		// 			// Hard-coded link URL.
		// 			// The browser will open the given URL in a new tab.
		// 			url: 'https://example.com/proxy-list-1.html',
		// 		},
		// 		items: {
		// 			// CSS selector to find a(n) HTML element(s) in the page.
		// 			selector: 'pre',
		// 			// Parse the text content of the selected element.
		// 			// Return an array of items.
		// 			parse: function(text) {
		// 				return text.trim().split('\n').map(function(item) {
		// 					var match = item.trim().match(/^([0-9\.]+):([0-9]+)/);
		// 					if (!match || !match[1] || !match[2]) return null;
		// 					return {
		// 						ipAddress: match[1],
		// 						port: parseInt(match[2]),
		// 					};
		// 				}).filter(Boolean);
		// 			},
		// 		},
		// 		lists: [
		// 			// Crawl deeper with sub-list pages.
		// 			{
		// 				link: {
		// 					// CSS selector to find an HTML link element.
		// 					// The browser will simulate a click on the link element then wait for navigation.
		// 					selector: '#nav a',
		// 				},
		// 				items: [
		// 					{
		// 						// CSS selector to find a(n) HTML element(s) in the page.
		// 						selector: '#proxies table tr',
		// 						// Instead of parse, provide an array of attribute selectors and parsing functions.
		// 						attributes: [
		// 							{
		// 								name: 'ipAddress',
		// 								selector: 'td:nth-child(1)',
		// 								parse: function(text) {
		// 									// Do additional processing on this attribute.
		// 									return text;
		// 								},
		// 							},
		// 						],
		// 					},
		// 				],
		// 				pagination: {
		// 					next: {
		// 						selector: '.pagination a.next',
		// 					},
		// 				},
		// 			},
		// 		],
		// 	},
		// ],
	},

	getData: function(options) {

		var emitter = options.newEventEmitter();

		_.defer(function() {

			options = options || {};

			var onData = _.bind(emitter.emit, emitter, 'data');
			var onError = _.bind(emitter.emit, emitter, 'error');
			var onEnd = _.once(_.bind(emitter.emit, emitter, 'end'));
			var startLists = this.config.lists || [];

			if (options.sample) {
				startLists = startLists.slice(0, 2);
			}

			var scrapeFirstPage = function(page, list, options, done) {
				async.seq(
					prepareToCrawlList.bind(undefined, page, list, options),
					doScraping.bind(undefined, page, list)
				)(done);
			};

			var scrapeNextPage = function(page, list, done) {
				doPagination(page, list, function(error) {
					if (error) {
						var match = error.message.match(/failed: timeout [0-9]+[a-z]+ exceeded/i);
						if (match) {
							// Next link does not exist - stop here without an error.
							return done();
						}
						// Some other error occurred.
						return done(error);
					}
					doScraping(page, list, done);
				});
			};

			var prepareToCrawlList = function(page, list, options, done) {
				async.seq(
					function(next) {
						if (!options.beforeEach) return next();
						options.beforeEach(next);
					},
					this.navigateToList.bind(this, page, list, options)
				)(done);
			}.bind(this);

			var doScraping = function(page, list, done) {
				async.seq(
					this.waitForItemsRelatedElements.bind(this, page, list),
					this.scrape.bind(this, page, list, options)
				)(done);
			}.bind(this);

			var doPagination = function(page, list, done) {
				var selector = list.pagination.next.selector;
				this.navigateByClicking(page, selector, done);
			}.bind(this);

			var preparePage = function(page, options, done) {
				if (page) return done(null, page);
				options.newPage(function(error, page) {
					if (error) return done(error);
					try {
						page.setDefaultTimeout(options.sourceOptions.defaultTimeout);
						page.setDefaultNavigationTimeout(options.sourceOptions.defaultNavigationTimeout);
						page.setViewport(options.sourceOptions.viewport);
					} catch (error) {
						return done(error);
					}
					done(null, page);
				});
			};

			var navigateToList = this.navigateToList.bind(this);
			var validateListDefinition = this.validateListDefinition.bind(this);

			(function crawlLists(page, lists, options, done) {
				var asyncMethodName = options.series === true ? 'eachSeries' : 'each';
				async[asyncMethodName](lists, function(list, next) {
					try {
						validateListDefinition(list);
					} catch (error) {
						onError(error);
						return next();
					}
					preparePage(page, options, function(error, page) {
						if (error) {
							onError(error);
							return next();
						}
						scrapeFirstPage(page, list, options, function(error, data) {
							if (error) {
								onError(error);
							} else if (!_.isEmpty(data)) {
								onData(data);
							}
							if (list.pagination && list.lists) {
								onError(new Error('Cannot specify both list.pagination and list.lists - use one or the other'));
								return next();
							}
							try {
								if (list.pagination) {
									var maxPages = options.sample === true ? 2 : options.sourceOptions.pagination.maxPages;
									var numPagesScraped = 1;
									var scrapedDataInLastPage = data && data.length > 0;
									async.whilst(function(cb) {
										cb(null, !!scrapedDataInLastPage && numPagesScraped < maxPages);
									}, function(cb) {
										scrapeNextPage(page, list, function(error, data) {
											if (error) {
												onError(error);
											} else if (!_.isEmpty(data)) {
												onData(data);
											}
											scrapedDataInLastPage = !!(data && data.length > 0);
											numPagesScraped++;
											cb();
										});
									}, next);
								} else if (list.lists) {
									options = _.extend({}, options, {
										series: true,
									});
									if (list.link.url) {
										options.beforeEach = function(cb) {
											// Navigate back to the list's start URL.
											navigateToList(page, list, options, cb);
										};
									}
									crawlLists(page, list.lists, options, next);
								} else {
									next();
								}
							} catch (error) {
								onError(error);
								return next();
							}
						});
					});
				}, done);
			})(null/* page */, startLists, options, function(error) {
				if (error) onError(error);
				onEnd();
			});

		}.bind(this));

		return emitter;
	},

	navigateToList: function(page, list, options, done) {
		if (list.link.url) {
			this.navigateByHardCodedUrl(page, list.link.url, options, done);
		} else if (list.link.selector) {
			this.navigateByClicking(page, list.link.selector, done);
		}
	},

	navigateByClicking: function(page, selector, done) {
		var doNavigateByClicking = async.seq(
			this.bringPageToFront.bind(this, page),
			this.waitForElement.bind(this, page, selector),
			this.ensureLinkTargetSelf.bind(this, page, selector),
			this.clickElement.bind(this, page, selector)
		);
		queues.sync.push({
			fn: function(next) {
				doNavigateByClicking(function(error) {
					done(error);
					next();
				});
			},
		});
	},

	navigateByHardCodedUrl: function(page, uri, options, done) {
		var cb = _.once(function(error) {
			clearTimeout(timeout);
			page.off('response', onResponse);
			done(error);
		});
		var timeout;
		if (options.sourceOptions.defaultNavigationTimeout) {
			timeout = setTimeout(function() {
				cb(new Error('Navigation Timeout Exceeded (' + uri + '): ' + options.sourceOptions.defaultNavigationTimeout + 'ms exceeded'));
			}, options.sourceOptions.defaultNavigationTimeout);
		}
		page.goto(uri).catch(function(error) {
			var match = error.message.match(/Navigation Timeout Exceeded: ([0-9]+[a-z]+) exceeded/i);
			if (match) {
				return cb(new Error('Navigation Timeout Exceeded (' + uri + '): ' + match[1] + ' exceeded'));
			}
			cb(error);
		});
		var onResponse = function(response) {
			if (response.url() === uri) {
				if (response.status() >= 400) {
					if (this.isCloudFlareResponse(response)) {
						// Wait for the JavaScript anti-bot feature of CloudFlare to finish...
						return;
					}
					return cb(new Error('HTTP ' + response.status() + ' (' + uri + '): ' + response.statusText()));
				}
				cb();
			}
		}.bind(this);
		page.on('response', onResponse);
	},

	isCloudFlareResponse: function(response) {
		var headers = response.headers();
		return headers && /cloudflare/i.test(headers.server);
	},

	ensureLinkTargetSelf: function(page, selector, done) {
		page.evaluate(function(selector) {
			return new Promise(function(resolve, reject) {
				try {
					var linkEl = document.querySelector(selector);
					if (linkEl) {
						var target = linkEl.getAttribute('target');
						if (target) {
							linkEl.setAttribute('target', '_self');
						}
					}
				} catch (error) {
					return reject(error.message);
				}
				resolve();
			});
		}, selector).then(function() {
			done();
		}).catch(done);
	},

	bringPageToFront: function(page, done) {
		page.bringToFront().then(function() {
			done();
		}).catch(done);
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

	waitForItemsRelatedElements: function(page, list, done) {
		async.parallel([
			this.waitForAnyItemsElements.bind(this, page, list),
			this.waitForAnyItemAttributesElements.bind(this, page, list),
		], function(error) {
			if (error) return done(error);
			done();
		});
	},

	waitForAnyItemsElements: function(page, list, done) {
		try {
			var tasks = _.map(list.items, function(items) {
				var selector = items.selector;
				return function(next) {
					page.waitFor(selector).then(function() {
						next();
					}).catch(next);
				};
			});
			async.race(tasks, done);
		} catch (error) {
			return done(error);
		}
	},

	waitForAnyItemAttributesElements: function(page, list, done) {
		try {
			var selectors = _.chain(list.items).map(function(items) {
				if (!items.attributes) return null;
				return _.map(items.attributes, function(attribute) {
					return items.selector + ' ' + attribute.selector;
				});
			}).compact().value();
			selectors = [].concat.apply([], selectors);
			var tasks = _.map(selectors, function(selector) {
				return function(next) {
					page.waitFor(selector).then(function() {
						next();
					}).catch(next);
				};
			});
			async.race(tasks, done);
		} catch (error) {
			return done(error);
		}
	},

	scrape: function(page, list, options, done) {
		try {
			if (!list.items) {
				// No items to scrape on this list page.
				return done();
			}
			var startTime = Date.now();
			var scrapedData;
			async.until(function(next) {
				try {
					var elapsedTime = Date.now() - startTime;
					if (elapsedTime >= options.sourceOptions.scraping.timeout) {
						return next(new Error('Timed out while waiting for valid data'));
					}
					this.tryToScrape(page, list, function(error, data) {
						if (error) return next(error);
						try {
							var hasValidData = _.some(data, function(item) {
								return options.sourceOptions.scraping.test(item);
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
					_.delay(next, options.sourceOptions.scraping.frequency);
				} catch (error) {
					return next(error);
				}
			}.bind(this), function(error) {
				if (error) return done(error);
				done(null, scrapedData);
			});	
		} catch (error) {
			return done(error);
		}
	},

	tryToScrape: function(page, list, done) {
		async.mapSeries(list.items, function(listItem, next) {
			page.evaluate(function(listItem) {
				return new Promise(function(resolve, reject) {
					try {
						var data = [];
						if (listItem.selector) {
							var itemEls = document.querySelectorAll(listItem.selector);
							if (!itemEls) {
								throw new Error('Could not find item element(s) with selector "' + listItem.selector + '"');
							}
							for (var index = 0; index < itemEls.length; index++) {
								(function(itemEl) {
									if (listItem.attributes) {
										var item = {};
										listItem.attributes.forEach(function(attribute) {
											var attrEl = itemEl.querySelector(attribute.selector);
											if (!attrEl) return;
											var value = attrEl.textContent;
											item[attribute.name] = value || '';
										});
										if (Object.keys(item).length > 0) {
											data.push(item);
										}
									} else {
										data.push(itemEl.textContent);	
									}
								})(itemEls[index]);
							}
						}
					} catch (error) {
						return reject(error.message);
					}
					return resolve(data);
				});
			}, listItem).then(function(data) {
				try {
					if (listItem.parse) {
						data = _.chain(data).map(listItem.parse).compact().value();
						// Collapse the data array into an array of objects.
						data = [].concat.apply([], data);
					} else if (listItem.attributes) {
						data = _.chain(data).map(function(item) {
							item = _.mapObject(item, function(value, key) {
								var attribute = _.findWhere(listItem.attributes, { name: key });
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
					return next(error);
				}
				next(null, data);
			}).catch(next);
		}, function(error, results) {
			if (error) return done(error);
			try {
				// Collapse the results array into an array of objects.
				var data = [].concat.apply([], results);
			} catch (error) {
				return done(error);
			}
			done(null, data);
		});
	},

	validateListDefinition: function(list) {
		if (_.isUndefined(list) || _.isNull(list) || !_.isObject(list)) {
			throw new Error('Must be a normal object');
		}
		if (!list.link) {
			throw new Error('Missing required attribute: "link"');
		}
		if (!list.link.url && !list.link.selector) {
			throw new Error('Must provide "link.url" or "link.selector"');
		}
		if (list.link.url && list.link.selector) {
			throw new Error('Must provide either "link.url" or "link.selector" (not both)');
		}
		if (!_.isUndefined(list.items)) {
			if (!_.isArray(list.items)) {
				throw new Error('If provided, "items" must be an array');
			}
			_.each(list.items, function(item) {
				if (!item.selector) {
					throw new Error('Missing required item attribute: "selector"');
				}
				if (!item.parse && !item.attributes) {
					throw new Error('Must provide "item.parse" or "item.attributes"');
				}
				if (item.parse && item.attributes) {
					throw new Error('Must provide either "item.parse" or "item.attributes" (not both)');
				}
			});
		}
	},
};
