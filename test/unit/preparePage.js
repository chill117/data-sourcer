'use strict';

var expect = require('chai').expect;
var express = require('express');
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../index');

describe('preparePage()', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	var host = 'localhost';
	var port = 3000;
	var baseUrl = 'http://' + host + ':' + port;
	var app;
	beforeEach(function() {
		app = express();
		app.server = app.listen(port, host);
		var testHtmlFilePath = path.join(__dirname, '..', 'html', 'basic-page-with-javascript.html');
		app.get('/test.html', function(req, res, next) {
			fs.readFile(testHtmlFilePath, function(error, contents) {
				if (error) return next(error);
				res.set('Content-type', 'text/html')
				res.send(contents.toString());
			});
		});
	});

	afterEach(function() {
		app.server.close();
		app = null;
	});

	it('should be a function', function() {
		expect(dataSourcer.preparePage).to.be.a('function');
	});

	it('can get and process html page in the context of a browser', function(done) {

		dataSourcer.preparePage(function(error, page) {
			expect(error).to.equal(null);
			expect(page).to.be.an('object');
			page.goto(baseUrl + '/test.html').then(function() {
				page.waitFor('.list:not(:empty)').then(function() {
					page.evaluate(function() {
						var proxies = [];
						var itemEls = document.querySelectorAll('.list li');
						for (var index = 0; index < itemEls.length; index++) {
							proxies.push(itemEls[index].textContent);
						}
						return Promise.resolve(proxies);
					}).then(function(proxies) {
						expect(proxies).to.be.an('array');
						expect(proxies).to.have.length(3);
						done();
					}).catch(done);
				}).catch(done);
			}).catch(done);
		});
	});
});
