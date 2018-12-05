'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('isValidSourceName(name)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.isValidSourceName).to.be.a('function');
	});

	it('should return TRUE when source name is valid', function() {
		var names = ['some-name'];
		_.each(names, function(name) {
			expect(dataSourcer.isValidSourceName(name)).to.equal(true);
		});
	});

	it('should return FALSE when source name is invalid', function() {
		var names = ['', 1, false, true, null, undefined, {}, [], function() {}];
		_.each(names, function(name) {
			expect(dataSourcer.isValidSourceName(name)).to.equal(false);
		});
	});
});
