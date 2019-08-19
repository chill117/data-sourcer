'use strict';

var _ = require('underscore');
var expect = require('chai').expect;
var express = require('express');
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../../index');
var abstractName = 'xml';

describe('abstract.' + abstractName, function() {

	var dataSourcer;
	before(function() {
		dataSourcer = new DataSourcer();
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
		app.get('*.xml', function(req, res, next) {
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
				res.set('Content-type', 'text/xml');
				res.status(200).send(contents.toString());
			});
		});
	});

	afterEach(function() {
		app.server.close();
		app = null;
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('scrapes data', function(done) {

		var source = {
			name: 'xml-simple',
			definition: {
				homeUrl: baseUrl,
				abstract: 'xml',
				config: {
					feeds: [
						{
							requestOptions: {
								url: baseUrl + '/01.xml',
							},
							paths: {
								group: 'rss/channel',
								item: 'item',
								attributes: {
									title: 'title/0',
									date: 'pubDate/0',
								},
							},
							parseAttributes: {
								date: function(text) {
									return new Date(text);
								},
							},
						}
					],
				},
			},
		};
		dataSourcer.addSource(source.name, source.definition);
		var data = [];
		var errorMessages = [];
		dataSourcer.getDataFromSource(source.name)
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
					expect(data).to.have.length(2);
					_.each(data, function(item) {
						expect(item.title).to.not.be.undefined;
						expect(item.title).to.be.a('string');
						expect(item.date).to.not.be.undefined;
						expect(item.date).to.be.a('date');
					});
				} catch (error) {
					return done(error);
				}
				done();
			});
	});
});
