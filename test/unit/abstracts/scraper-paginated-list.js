'use strict';

var _ = require('underscore');
var expect = require('chai').expect;
var express = require('express');
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../../index');
var abstractName = 'scraper-paginated-list';

describe('abstract.' + abstractName, function() {

	var dataSourcer;
	beforeEach(function() {
		dataSourcer = new DataSourcer({
			// browser: {
			// 	headless: false,
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
				res.send(contents.toString());
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

	describe('failure cases', function() {

		it('start page timeout', function(done) {
			var source = {
				name: 'scraper-paginated-list-start-page-timeout',
				definition: {
					homeUrl: baseUrl,
					abstract: 'scraper-paginated-list',
					config: {
						startPageUrl: baseUrl + '/timeout',
						selectors: {
							item: null,
							itemAttributes: {
								ipAddress: null,
							},
							nextLink: null,
						},
						parseAttributes: {},
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			done = _.once(done);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 50,
				defaultNavigationTimeout: 200,
			};
			var errorMessage;
			dataSourcer.getDataFromSource(source.name, options)
				.on('error', function(error) {
					errorMessage = error.message;
				})
				.once('end', function() {
					try {
						expect(errorMessage).to.equal('Navigation Timeout Exceeded (' + source.definition.config.startPageUrl + '): ' + options.sourceOptions[source.name].defaultNavigationTimeout + 'ms exceeded');
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('start page does not exist', function(done) {
			var source = {
				name: 'scraper-paginated-list-start-page-does-not-exist',
				definition: {
					homeUrl: baseUrl,
					abstract: 'scraper-paginated-list',
					config: {
						startPageUrl: baseUrl + '/does-not-exist.html',
						selectors: {
							item: null,
							itemAttributes: {
								ipAddress: null,
							},
							nextLink: null,
						},
						parseAttributes: {},
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			done = _.once(done);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 50,
			};
			var errorMessage;
			dataSourcer.getDataFromSource(source.name, options)
				.on('error', function(error) {
					errorMessage = error.message;
				})
				.once('end', function() {
					try {
						expect(errorMessage).to.equal('HTTP 404 (' + source.definition.config.startPageUrl + '): Not Found');
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});

	describe('item', function() {

		describe('failure cases', function() {

			it('item element does not exist', function(done) {
				var source = {
					name: 'scraper-paginated-list-list-element-does-not-exist',
					definition: {
						homeUrl: baseUrl,
						abstract: 'scraper-paginated-list',
						config: {
							startPageUrl: baseUrl + '/page-0.html',
							selectors: {
								item: '#does-not-exist',
								itemAttributes: {
									field1: 'td:nth-child(1)',
									field2: 'td:nth-child(2)',
									field3: 'td:nth-child(3)',
								},
								nextLink: '#pagination .next',
							},
						},
					},
				};
				dataSourcer.addSource(source.name, source.definition);
				done = _.once(done);
				var options = { sourceOptions: {} };
				options.sourceOptions[source.name] = {
					defaultTimeout: 50,
				};
				var errorMessage;
				dataSourcer.getDataFromSource(source.name, options)
					.on('error', function(error) {
						errorMessage = error.message;
					})
					.once('end', function() {
						try {
							expect(errorMessage).to.equal('waiting for selector "' + source.definition.config.selectors.item + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded');
						} catch (error) {
							return done(error);
						}
						done();
					});
			});
		});

		it('scrapes data from list page(s)', function(done) {

			var source = {
				name: 'scraper-paginated-list-scrapes-data-items',
				definition: {
					homeUrl: baseUrl,
					abstract: 'scraper-paginated-list',
					config: {
						startPageUrl: baseUrl + '/page-0.html',
						selectors: {
							item: '#list table tbody tr',
							itemAttributes: {
								field1: 'td:nth-child(1)',
								field2: 'td:nth-child(2)',
								field3: 'td:nth-child(3)',
							},
							nextLink: '#pagination .next',
						},
						parseAttributes: {
							field2: function(text) {
								return parseInt(text);
							},
						},
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			done = _.once(done);
			var options = { sourceOptions: {} };
			options.sourceOptions[source.name] = {
				defaultTimeout: 50,
			};
			var data = [];
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data.push.apply(data, _data);
				})
				.on('error', done)
				.once('end', function() {
					try {
						expect(data).to.not.be.undefined;
						expect(data).to.be.an('array');
						expect(data).to.have.length(6);
						_.each(data, function(item) {
							expect(item.field1).to.not.be.undefined;
							expect(item.field1).to.be.a('string');
							expect(item.field2).to.not.be.undefined;
							expect(item.field2).to.be.a('number');
							expect(item.field3).to.not.be.undefined;
							expect(item.field3).to.be.a('string');
						});
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});
});
