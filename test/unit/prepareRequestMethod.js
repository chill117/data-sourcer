'use strict';

var _ = require('underscore');
var async = require('async');
var expect = require('chai').expect;
var express = require('express');

var DataSourcer = require('../../index');

describe('prepareRequestMethod([options])', function() {

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
	var responseDelay = 10;
	var app, numRequests, timeouts;
	beforeEach(function() {
		app = express();
		app.server = app.listen(port, host);
		numRequests = 0;
		timeouts = [];
		app.get('/test/:ref', function(req, res, next) {
			numRequests++;
			var timeout = _.delay(function() {
				res.send(req.params.ref).end();
			}, responseDelay);
			timeouts.push(timeout);
		});
	});

	afterEach(function() {
		_.each(timeouts, function(timeout) {
			clearTimeout(timeout);
		});
		app.server.close();
		app = null;
	});

	it('should be a function', function() {
		expect(dataSourcer.prepareRequestMethod).to.be.a('function');
	});

	it('returns a function', function() {
		var request = dataSourcer.prepareRequestMethod();
		expect(request).to.be.a('function');
	});

	it('limited concurrency', function(done) {

		var options = {
			requestQueue: {
				concurrency: 1,
				delay: 0,
			},
		};

		var request = dataSourcer.prepareRequestMethod(options);
		var received = {};

		request(baseUrl + '/test/1', function(error, response, body) {
			received[body] = true;
			expect(numRequests).to.equal(1);
			expect(body).to.equal('1');
			expect(received['1']).to.equal(true);
			expect(received['2']).to.be.undefined;
			expect(received['3']).to.be.undefined;
		});

		request(baseUrl + '/test/2', function(error, response, body) {
			received[body] = true;
			expect(numRequests).to.equal(2);
			expect(body).to.equal('2');
			expect(received['1']).to.equal(true);
			expect(received['2']).to.equal(true);
			expect(received['3']).to.be.undefined;
		});

		request(baseUrl + '/test/3', function(error, response, body) {
			received[body] = true;
			expect(numRequests).to.equal(3);
			expect(body).to.equal('3');
			expect(received['1']).to.equal(true);
			expect(received['2']).to.equal(true);
			expect(received['3']).to.equal(true);
			done();
		});
	});

	it('delay between requests', function(done) {

		var options = {
			requestQueue: {
				concurrency: 1,
				delay: 50,
			},
		};

		var request = dataSourcer.prepareRequestMethod(options);
		var lastResponseTime;

		async.times(3, function(index, next) {
			request(baseUrl + '/test/' + index, function(error, response, body) {
				try {
					if (lastResponseTime) {
						expect(Date.now() - lastResponseTime >= options.requestQueue.delay);
					}
					lastResponseTime = Date.now();
				} catch (error) {
					return next(error);
				}
				next();
			});
		}, done);
	});

	it('concurrency', function(done) {

		var options = {
			requestQueue: {
				concurrency: 5,
				delay: 0,
			},
		};

		var request = dataSourcer.prepareRequestMethod(options);

		async.times(options.requestQueue.concurrency, function(index, next) {
			request(baseUrl + '/test/' + index, function(error, response, body) {
				try {
					expect(numRequests).to.equal(options.requestQueue.concurrency);
					expect(body).to.equal(index.toString());
				} catch (error) {
					return next(error);
				}
				next();
			});
		}, done);
	});
});
