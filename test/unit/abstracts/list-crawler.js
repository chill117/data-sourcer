'use strict';

var _ = require('underscore');
var expect = require('chai').expect;
var express = require('express');
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../../index');
var abstractName = 'list-crawler';

describe('abstract.' + abstractName, function() {

	var dataSourcer;
	beforeEach(function() {
		dataSourcer = new DataSourcer({
			// browser: {
			// 	headless: false,
			// 	slowMo: 5,
			// },
		});
	});

	var samplesDir;
	beforeEach(function() {
		samplesDir = path.join(__dirname, '..', '..', 'samples', 'abstracts', abstractName);
	});

	var host = 'localhost', port = 3000;
	var baseUrl = 'http://' + host + ':' + port;
	var app;
	beforeEach(function() {
		app = express();
		app.server = app.listen(port, host);
		// Uncomment the following to print HTTP requests.
		// app.use(function(req, res, next) {
		// 	console.log(req.method + ' ' + req.url);
		// 	next();
		// });
		app.get('/timeout', function(req, res, next) {
			// Never respond - to cause a timeout.
		});
		app.get('*.html', function(req, res, next) {
			var filePath = path.join(samplesDir, req.url);
			fs.readFile(filePath, function(error, contents) {
				if (error) {
					if (error.message.indexOf('no such file or directory') !== -1) {
						res.status(404);
					} else {
						res.status(500);
					}
					return res.send(error.message);
				}
				res.set('Content-type', 'text/html');
				res.status(200).send(contents.toString());
			});
		});
	});

	var pages;
	beforeEach(function() {
		pages = [];
	});

	afterEach(function() {
		app.server.close();
		app = null;
	});

	afterEach(function(done) {
		dataSourcer.close(done);
	});

	it('timeout while loading page', function(done) {

		var source = {
			name: 'list-crawler-timeout-while-loading-page',
			definition: {
				homeUrl: baseUrl,
				abstract: 'list-crawler',
				config: {
					lists: [
						{
							link: {
								url: baseUrl + '/timeout',
							},
						},
					],
				},
			},
		};
		dataSourcer.addSource(source.name, source.definition);
		var options = { sourceOptions: {} };
		options.sourceOptions[source.name] = {
			defaultTimeout: 80,
			defaultNavigationTimeout: 100,
			series: true,
			scraping: {
				frequency: 5,
				timeout: 80,
			},
		};
		var data = [];
		var errorMessages = [];
		dataSourcer.getDataFromSource(source.name, options)
			.on('data', function(_data) {
				data.push.apply(data, _data);
			})
			.on('error', function(error) {
				errorMessages.push(error.message);
			})
			.once('end', function() {
				try {
					expect(errorMessages).to.deep.equal([
						'Navigation Timeout Exceeded (' + source.definition.config.lists[0].link.url + '): ' + options.sourceOptions[source.name].defaultNavigationTimeout + 'ms exceeded',
					]);
					expect(data).to.deep.equal([]);
				} catch (error) {
					return done(error);
				}
				done();
			});
	});

	it('timeout while waiting for data', function(done) {

		var source = {
			name: 'list-crawler-timeout-while-waiting-for-data',
			definition: {
				homeUrl: baseUrl,
				abstract: 'list-crawler',
				config: {
					lists: [
						{
							link: {
								url: baseUrl + '/timeout-while-waiting-for-data.html',
							},
							items: [{
								selector: 'pre',
								parse: _.identity,
							}],
						},
					],
				},
			},
		};
		dataSourcer.addSource(source.name, source.definition);
		var options = { sourceOptions: {} };
		options.sourceOptions[source.name] = {
			defaultTimeout: 80,
			series: true,
			scraping: {
				frequency: 5,
				timeout: 80,
			},
		};
		var data = [];
		var errorMessages = [];
		dataSourcer.getDataFromSource(source.name, options)
			.on('data', function(_data) {
				data.push.apply(data, _data);
			})
			.on('error', function(error) {
				errorMessages.push(error.message);
			})
			.once('end', function() {
				try {
					expect(errorMessages).to.deep.equal([
						'Timed out while waiting for valid data',
					]);
					expect(data).to.deep.equal([]);
				} catch (error) {
					return done(error);
				}
				done();
			});
	});

	describe('items.parse', function() {

		it('missing items element', function(done) {

			var source = {
				name: 'list-crawler-missing-items-element',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.parse/start.html',
								},
								lists: [
									{
										link: {
											selector: '#sidebar a:nth-child(1)',
										},
										items: [{
											selector: '#does-not-exist',
											parse: _.identity,
										}],
									},
								],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'waiting for selector "' + source.definition.config.lists[0].lists[0].items[0].selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded',
						]);
						expect(data).to.deep.equal([]);
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('scrapes data', function(done) {

			var source = {
				name: 'list-crawler-items-parse',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.parse/start.html',
								},
								lists: (function() {
									var parseItems = function(text) {
										return text.trim().split('\n').map(function(item) {
											var parts = item.replace(/[\t ]/gi, '').split(',');
											return {
												key: parts[0],
												description: parts[1],
												value: parts[2],
											};
										}).filter(Boolean);
									};
									return _.map([
										'#sidebar a:nth-child(1)',
										'#sidebar a:nth-child(2)',
									], function(linkSelector) {
										return {
											link: {
												selector: linkSelector,
											},
											items: [{
												selector: '#items pre',
												parse: parseItems,
											}],
										};
									});
								})(),
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(6);
						_.each(data, function(item) {
							expect(item.key).to.not.be.undefined;
							expect(item.description).to.not.be.undefined;
							expect(item.value).to.not.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});

	describe('items.attributes', function() {

		it('missing all item attributes element', function(done) {

			var source = {
				name: 'list-crawler-missing-item-attributes-element',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.attributes/start.html',
								},
								lists: [
									{
										link: {
											selector: '#sidebar a:nth-child(1)',
										},
										items: [{
												selector: '#items table tbody tr',
												attributes: [
													{
														name: 'missing',
														selector: '#does-not-exist',
														parse: _.identity,
													},
												],
										}],
									},
								],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'waiting for selector "' + source.definition.config.lists[0].lists[0].items[0].selector + ' ' + source.definition.config.lists[0].lists[0].items[0].attributes[0].selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded',
						]);
						expect(data).to.deep.equal([]);
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('missing some item attributes elements', function(done) {

			var source = {
				name: 'list-crawler-missing-item-attributes-element',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.attributes/start.html',
								},
								lists: [
									{
										link: {
											selector: '#sidebar a:nth-child(1)',
										},
										items: [{
												selector: '#items table tbody tr',
												attributes: [
													{
														name: 'someText',
														selector: 'td:nth-child(1)',
													},
													{
														name: 'missing',
														selector: '#does-not-exist',
														parse: _.identity,
													},
												],
										}],
									},
								],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.someText).to.not.be.undefined;
							expect(item.missing).to.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('scrapes data', function(done) {

			var source = {
				name: 'list-crawler-items-attributes',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.attributes/start.html',
								},
								lists: (function() {
									return _.map([
										'#sidebar a:nth-child(1)',
										'#sidebar a:nth-child(2)',
									], function(linkSelector) {
										return {
											link: {
												selector: linkSelector,
											},
											items: [{
												selector: '#items table tbody tr',
												attributes: [
													{
														name: 'someText',
														selector: 'td:nth-child(1)',
													},
													{
														name: 'someInteger',
														selector: 'td:nth-child(2)',
														parse: function(text) {
															var port = parseInt(text);
															if (_.isNaN(port)) return null;
															return port;
														},
													},
												],
											}],
										};
									});
								})(),
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(6);
						_.each(data, function(item) {
							expect(item.someText).to.not.be.undefined;
							expect(item.someText).to.be.a('string');
							expect(item.someInteger).to.not.be.undefined;
							expect(item.someInteger).to.be.a('number');
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});

	describe('options', function() {

		describe('series', function() {

			it('FALSE', function(done) {

				var listUrls = [
					baseUrl + '/items.parse/start.html',
					baseUrl + '/items.parse/start.html',
				];

				var listDefinition = {
					lists: _.map([
						'#sidebar a:nth-child(1)',
						'#sidebar a:nth-child(2)',
					], function(linkSelector) {
						return {
							link: {
								selector: linkSelector,
							},
							items: [{
								selector: '#items pre',
								parse: function(text) {
									return text.trim().split('\n').map(function(item) {
										var parts = item.replace(/[\t ]/gi, '').split(',');
										return {
											key: parts[0],
											description: parts[1],
											value: parts[2],
										};
									}).filter(Boolean);
								},
							}],
						};
					}),
				};

				var source = {
					name: 'list-crawler-series-false',
					definition: {
						homeUrl: baseUrl,
						abstract: 'list-crawler',
						config: {
							lists: _.map(listUrls, function(listUrl) {
								return _.extend({}, listDefinition, {
									link: {
										url: listUrl,
									},
								});
							}),
						},
					},
				};
				dataSourcer.addSource(source.name, source.definition);
				var options = { sourceOptions: {} };
				options.sourceOptions[source.name] = {
					defaultTimeout: 80,
					series: false,
					scraping: {
						frequency: 5,
						timeout: 80,
					},
				};
				var data = [];
				var errorMessages = [];
				dataSourcer.getDataFromSource(source.name, options)
					.on('data', function(_data) {
						data.push.apply(data, _data);
					})
					.on('error', function(error) {
						errorMessages.push(error.message);
					})
					.once('end', function() {
						try {
							expect(errorMessages).to.deep.equal([]);
							expect(data).to.be.an('array');
							expect(data).to.have.length(12);
							_.each(data, function(item) {
								expect(item.key).to.not.be.undefined;
								expect(item.description).to.not.be.undefined;
								expect(item.value).to.not.be.undefined;
							});
						} catch (error) {
							return done(error);
						}
						done();
					});
			});
		});
	})

	describe('links', function() {

		it('missing link element', function(done) {

			var source = {
				name: 'list-crawler-missing-link-element',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.parse/start.html',
								},
								lists: [
									{
										link: {
											selector: '#does-not-exist',
										},
									},
								],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'waiting for selector "' + source.definition.config.lists[0].lists[0].link.selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded',
						]);
						expect(data).to.deep.equal([]);
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('missing link elements', function(done) {

			var source = {
				name: 'list-crawler-missing-link-elements',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.parse/start.html',
								},
								lists: [
									{
										link: {
											selector: '#does-not-exist',
										},
									},
									{
										link: {
											selector: '#does-not-exist2',
										},
									},
								],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'waiting for selector "' + source.definition.config.lists[0].lists[0].link.selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded',
							'waiting for selector "' + source.definition.config.lists[0].lists[1].link.selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded',
						]);
						expect(data).to.deep.equal([]);
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('target="_blank"', function(done) {

			var source = {
				name: 'list-crawler-links-target-blank',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [{
							link: {
								url: baseUrl + '/link-target-blank.html',
							},
							lists: [{
								link: {
									selector: '#sidebar a:nth-child(1)',
								},
								items: [{
									selector: '#items pre',
									parse: function(text) {
										return text.trim().split('\n').map(function(item) {
											var parts = item.replace(/[\t ]/gi, '').split(',');
											return {
												key: parts[0],
												description: parts[1],
												value: parts[2],
											};
										}).filter(Boolean);
									},
								}],
							}],
						}],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.key).to.not.be.undefined;
							expect(item.description).to.not.be.undefined;
							expect(item.value).to.not.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});

	describe('failing lists', function() {

		it('top-level', function(done) {

			var source = {
				name: 'list-crawler-failing-lists-top-level',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/does-not-exist.html',
								},
							},
							{
								link: {
									url: baseUrl + '/timeout-while-waiting-for-data.html',
								},
								items: [{
									selector: 'pre',
									parse: _.identity,
								}],
							},
							{
								link: {
									url: baseUrl + '/items.parse/simple.html',
								},
								items: [{
									selector: '#items pre',
									parse: function(text) {
										return text.trim().split('\n').map(function(item) {
											var parts = item.replace(/[\t ]/gi, '').split(',');
											return {
												key: parts[0],
												description: parts[1],
												value: parts[2],
											};
										}).filter(Boolean);
									},
								}],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'HTTP 404 (' + source.definition.config.lists[0].link.url + '): Not Found',
							'Timed out while waiting for valid data',
						]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.key).to.not.be.undefined;
							expect(item.description).to.not.be.undefined;
							expect(item.value).to.not.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('sub-list of failing list', function(done) {

			var source = {
				name: 'list-crawler-failing-lists-sub-list-of-failing-list',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/timeout-while-waiting-for-data.html',
								},
								items: [{
									selector: 'pre',
									parse: _.identity,
								}],
								lists: [{
									link: {
										selector: '#sidebar a:nth-child(1)',
									},
									items: [{
										selector: '#items pre',
										parse: function(text) {
											return text.trim().split('\n').map(function(item) {
												var parts = item.replace(/[\t ]/gi, '').split(',');
												return {
													key: parts[0],
													description: parts[1],
													value: parts[2],
												};
											}).filter(Boolean);
										},
									}],
								}],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'Timed out while waiting for valid data',
						]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.key).to.not.be.undefined;
							expect(item.description).to.not.be.undefined;
							expect(item.value).to.not.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('sub-list fail', function(done) {

			var source = {
				name: 'list-crawler-failing-lists-sub-list-fail',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/items.parse/start.html',
								},
								lists: [
									{
										link: {
											selector: '#sidebar a:nth-child(1)',
										},
										items: [{
											selector: '#items pre',
											parse: _.noop,
										}],
									},
									{
										link: {
											selector: '#sidebar a:nth-child(2)',
										},
										items: [{
											selector: '#items pre',
											parse: function(text) {
												return text.trim().split('\n').map(function(item) {
													var parts = item.replace(/[\t ]/gi, '').split(',');
													return {
														key: parts[0],
														description: parts[1],
														value: parts[2],
													};
												}).filter(Boolean);
											},
										}],
									},
								],
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([
							'Timed out while waiting for valid data',
						]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.key).to.not.be.undefined;
							expect(item.description).to.not.be.undefined;
							expect(item.value).to.not.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});

	describe('pagination', function() {

		it('follows next links until no more data', function(done) {

			var source = {
				name: 'list-crawler-pagination',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						lists: [
							{
								link: {
									url: baseUrl + '/pagination/page-0.html',
								},
								items: [{
									selector: '#list table tbody tr',
									attributes: [
										{
											name: 'field1',
											selector: 'td:nth-child(1)',
										},
										{
											name: 'field2',
											selector: 'td:nth-child(2)',
											parse: parseInt,
										},
										{
											name: 'field3',
											selector: 'td:nth-child(3)',
										},
									],
								}],
								pagination: {
									next: {
										selector: '#pagination .next',
									},
								},
							},
						],
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 80,
				defaultNavigationTimeout: 100,
				series: true,
				scraping: {
					frequency: 5,
					timeout: 80,
				},
			};
			var data = [];
			var errorMessages = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', function(error) {
					errorMessages.push(error.message);
				})
				.once('end', function() {
					try {
						expect(errorMessages).to.deep.equal([]);
						expect(data).to.be.an('array');
						expect(data).to.have.length(6);
						_.each(data, function(item) {
							expect(item.field1).to.not.be.undefined;
							expect(item.field1).to.be.a('string');
							expect(item.field2).to.not.be.undefined;
							expect(item.field2).to.be.a('number');
							expect(item.field3).to.not.be.undefined;
							expect(item.field3).to.be.a('string');
							expect(item.field4).to.be.undefined;
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});
});
