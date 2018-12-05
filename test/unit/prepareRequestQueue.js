'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('prepareRequestQueue([options])', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.prepareRequestQueue).to.be.a('function');
	});

	it('should return an async queue', function() {
		var options = { concurrency: 2 };
		var queue = dataSourcer.prepareRequestQueue(options);
		expect(queue).to.be.an('object');
		_.each(['drain', 'kill', 'push'], function(methodName) {
			expect(queue[methodName]).to.be.a('function');
		});
		expect(queue.concurrency).to.equal(options.concurrency);
	});
});
