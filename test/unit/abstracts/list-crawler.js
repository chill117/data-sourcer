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
				name: 'list-crawler-start-page-timeout',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						startUrls: [
							baseUrl + '/timeout',
						],
						listLinks: [
							'#does-not-exist',
						],
						list: {
							selector: '#does-not-exist',
							parse: function(text) {
								return [];
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
				defaultNavigationTimeout: 200,
			};
			var errorMessage;
			dataSourcer.getDataFromSource(source.name, options)
				.on('error', function(error) {
					errorMessage = error.message;
				})
				.once('end', function() {
					try {
						expect(errorMessage).to.equal('Navigation Timeout Exceeded (' + source.definition.config.startUrls[0] + '): ' + options.sourceOptions[source.name].defaultNavigationTimeout + 'ms exceeded');
					} catch (error) {
						return done(error);
					}
					done();
				});
		});

		it('start page does not exist', function(done) {
			var source = {
				name: 'list-crawler-start-page-does-not-exist',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						startUrls: [
							baseUrl + '/does-not-exist.html',
						],
						listLinks: [
							'#sidebar a:nth-child(1)',
						],
						items: {
							selector: '#does-not-exist',
							attributes: [],
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
						expect(errorMessage).to.equal('HTTP 404 (' + source.definition.config.startUrls[0] + '): Not Found');
					} catch (error) {
						return done(error);
					}
					done();
				});
		});
	});

	describe('list', function() {

		describe('failure cases', function() {

			it('list element does not exist', function(done) {
				var source = {
					name: 'list-crawler-list-element-does-not-exist',
					definition: {
						homeUrl: baseUrl,
						abstract: 'list-crawler',
						config: {
							startUrls: [
								baseUrl + '/start-page-0.html',
							],
							listLinks: [
								'#sidebar a:nth-child(1)',
							],
							list: {
								selector: '#does-not-exist',
								parse: function(text) {
									return [];
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
				var errorMessage;
				dataSourcer.getDataFromSource(source.name, options)
					.on('error', function(error) {
						errorMessage = error.message;
					})
					.once('end', function() {
						try {
							expect(errorMessage).to.equal('waiting for selector "' + source.definition.config.list.selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded');
						} catch (error) {
							return done(error);
						}
						done();
					});
			});
		});

		it('scrapes data from list page(s)', function(done) {
			var source = {
				name: 'list-crawler-scrapes-data-list',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						startUrls: [
							baseUrl + '/start-page-0.html',
						],
						listLinks: [
							'#sidebar a:nth-child(1)',
							'#sidebar a:nth-child(2)',
						],
						list: {
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
						},
					},
				},
			};
			dataSourcer.addSource(source.name, source.definition);
			done = _.once(done);
			var data;
			dataSourcer.getDataFromSource(source.name)
				.on('data', function(_data) {
					data = _data
				})
				.on('error', done)
				.once('end', function() {
					try {
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

	describe('items', function() {

		describe('failure cases', function() {

			it('items element does not exist', function(done) {
				var source = {
					name: 'list-crawler-items-element-does-not-exist',
					definition: {
						homeUrl: baseUrl,
						abstract: 'list-crawler',
						config: {
							startUrls: [
								baseUrl + '/start-page-0.html',
							],
							listLinks: [
								'#sidebar a:nth-child(1)',
							],
							items: {
								selector: '#does-not-exist',
								attributes: [],
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
							expect(errorMessage).to.equal('waiting for selector "' + source.definition.config.items.selector + '" failed: timeout ' + options.sourceOptions[source.name].defaultTimeout + 'ms exceeded');
						} catch (error) {
							return done(error);
						}
						done();
					});
			});
		});

		it('scrapes data from list page(s)', function(done) {
			var source = {
				name: 'list-crawler-scrapes-data-items',
				definition: {
					homeUrl: baseUrl,
					abstract: 'list-crawler',
					config: {
						startUrls: [
							baseUrl + '/start-page-1.html',
						],
						listLinks: [
							'#sidebar a:nth-child(1)',
							'#sidebar a:nth-child(2)',
						],
						items: {
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
			var data;
			dataSourcer.getDataFromSource(source.name, options)
				.on('data', function(_data) {
					data = _data;
				})
				.on('error', done)
				.once('end', function() {
					try {
						expect(data).to.not.be.undefined;
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
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
});
