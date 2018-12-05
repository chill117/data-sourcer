'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('processData(data, fn)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.processData).to.be.a('function');
	});

	it('should process each data item with the given function', function() {

		var data = [
			{ something: '1' },
			{ something: '2' },
			{ something: '3' },
		];

		var processed = dataSourcer.processData(data, function(item) {
			item.added = 'something-else';
			return item;
		});

		var processedDataCorrect = _.every(processed, function(item) {
			return _.has(item, 'something') && _.has(item, 'added');
		});
		expect(processedDataCorrect).to.equal(true);

		var originalDataMutated = _.some(data, function(item) {
			return _.has(item, 'added');
		});
		expect(originalDataMutated).to.equal(false);
	});

	it('remove empty, non-object, or falsey items', function() {

		var data = [
			{ something: '1' },
			{},
			null,
			1
		];

		var processed = dataSourcer.processData(data, function(item) {
			return item;
		});

		expect(processed).to.deep.equal([
			{ something: '1' }
		]);
	});
});
