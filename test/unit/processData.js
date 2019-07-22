'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('processData(data, fn[, options])', function() {

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

		_.each(processed, function(item) {
			expect(item).to.have.property('added');
			expect(item).to.have.property('something');
		});
	});

	it('should not mutate original data', function() {

		var data = [
			{ something: 'original data 1' },
			{ something: 'original data 2' },
		];

		dataSourcer.processData(data, function(item) {
			item.added = 'something-else';
			return item;
		});

		_.each(data, function(item) {
			expect(item).to.not.have.property('added');
		});
	});

	it('throws an error when "fn" is not a function', function() {

		var data = [
			{ something: 'some text' },
		];
		var thrownError;
		try {
			dataSourcer.processData(data);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.not.be.undefined;
		expect(thrownError.message).to.equal('Missing required process function ("fn")');
	});

	describe('options', function() {

		describe('extend', function() {

			it('should extend each item object as expected', function() {

				var data = [
					{ something: 'here' },
					{ something: 'more text' },
				];

				var options = {
					extend: {
						another1: 'extended attributes',
					},
				};

				var processed = dataSourcer.processData(data, function(item) {
					return item;
				}, options);

				_.each(options.extend, function(value, key) {
					_.each(processed, function(item) {
						expect(item[key]).to.equal(value);
						expect(item).to.have.property('something');
						expect(_.keys(item)).to.have.length(2);
					});
				});
			});
		});
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
