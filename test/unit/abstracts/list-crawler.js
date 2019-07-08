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
		app.get('*.html', function(req, res, next) {
			var filePath = path.join(samplesDir, req.url);
			fs.readFile(filePath, function(error, contents) {
				if (error) {
					return res.send(error.message).status(500).end();
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

	describe('list', function() {

		var sourceName = 'list-crawler-test';
		beforeEach(function() {
			dataSourcer.addSource(sourceName, {
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
			});
		});

		it('scrapes data from list page(s)', function(done) {
			dataSourcer.getDataFromSource(sourceName)
				.on('data', function(data) {
					try {
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.key).to.not.be.undefined;
							expect(item.description).to.not.be.undefined;
							expect(item.value).to.not.be.undefined;
						});
					} catch (error) {
						done(error);
					}
				})
				.on('error', done)
				.once('end', function() {
					done();
				});
		});
	});

	describe('items', function() {

		var sourceName = 'list-crawler-test';
		beforeEach(function() {
			dataSourcer.addSource(sourceName, {
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
			});
		});

		it('scrapes data from list page(s)', function(done) {
			done = _.once(done);
			dataSourcer.getDataFromSource(sourceName)
				.on('data', function(data) {
					try {
						expect(data).to.be.an('array');
						expect(data).to.have.length(3);
						_.each(data, function(item) {
							expect(item.someText).to.not.be.undefined;
							expect(item.someText).to.be.a('string');
							expect(item.someInteger).to.not.be.undefined;
							expect(item.someInteger).to.be.a('number');
						});
					} catch (error) {
						done(error);
					}
				})
				.on('error', done)
				.once('end', function() {
					done();
				});
		});
	});
});
