'use strict';

var _ = require('underscore');
var async = require('async');
var express = require('express');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('close(done)', function() {

	var dataSourcer;
	beforeEach(function() {
		dataSourcer = new DataSourcer();
	});

	it('should be a function', function() {
		expect(dataSourcer.close).to.be.a('function');
	});

	describe('open browser', function() {

		it('should be closed', function(done) {

			var page;
			dataSourcer.addSource('source-using-browser', {
				homeUrl: 'https://somewhere',
				getData: function(options) {
					var emitter = options.newEventEmitter();
					_.defer(function() {
						options.newPage(function(error, _page) {
							if (error) return done(error);
							page = _page;
						});
					});
					return emitter;
				}
			});
			dataSourcer.getData();
			async.until(function(next) {
				next(null, !!page);
			}, function(next) {
				_.delay(next, 5);
			}, function() {
				dataSourcer.close(function(error) {
					if (error) return done(error);
					try {
						expect(dataSourcer.browser).to.be.null;
					} catch (error) {
						return done(error);
					}
					done();
				})
			});
		});
	});

	describe('active request(s)', function() {

		var app;
		beforeEach(function() {
			app = express();
			app.server = app.listen(3000, 'localhost');
			app.get('/timeout', function(req, res, next) {
				// Never respond - to cause a timeout.
			});
		});

		after(function() {
			app.server.close();
		});

		it('should be aborted', function(done) {

			var numResponses = 0;
			dataSourcer.addSource('source-using-request', {
				homeUrl: 'http://localhost:3000',
				getData: function(options) {
					var emitter = options.newEventEmitter();
					_.defer(function() {
						options.request({
							url: 'http://localhost:3000/timeout',
							timeout: 100,
						}, function() {
							numResponses++;
						});
					});
					return emitter;
				}
			});
			var errorMessages = [];
			dataSourcer.getData().on('error', function(error) {
				errorMessages.push(error.message);
			});
			async.until(function(next) {
				next(null, _.size(dataSourcer.activeRequests) > 0);
			}, function(next) {
				_.delay(next, 5);
			}, function() {
				dataSourcer.close(function(error) {
					if (error) return done(error);
					_.delay(function() {
						try {
							expect(errorMessages).to.deep.equal([]);
							expect(_.size(dataSourcer.activeRequests)).to.equal(0);
							expect(numResponses).to.equal(0);
						} catch (error) {
							return done(error);
						}
						done();
					}, 80);
				});
			});
		});
	});
});
