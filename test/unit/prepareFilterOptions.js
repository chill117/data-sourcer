'use strict';

var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('prepareFilterOptions([options])', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.prepareFilterOptions).to.be.a('function');
	});

	it('should return the "include" and "exclude" filters as object hashes', function() {
		var filterOptions = dataSourcer.prepareFilterOptions({
			include: {
				someField: ['1', '3'],
				otherField: ['text']
			},
			exclude: {
				another: ['text', 'field']
			}
		});
		expect(filterOptions).to.deep.equal({
			mode: 'strict',
			include: {
				someField: { '1': true, '3': true },
				otherField: { 'text': true }
			},
			exclude: {
				another: { 'text': true, 'field': true }
			}
		});
	});
});
