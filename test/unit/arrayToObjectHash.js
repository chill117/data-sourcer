'use strict';

var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('arrayToObjectHash(array)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.arrayToObjectHash).to.be.a('function');
	});

	it('should return an object hash from the given array', function() {
		expect(dataSourcer.arrayToObjectHash(['1', '2', '4'])).deep.equal({ '1': true, '2': true, '4': true });
		expect(dataSourcer.arrayToObjectHash([])).deep.equal({});
	});
});
