'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('filterData(data, options)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	it('should be a function', function() {
		expect(dataSourcer.filterData).to.be.a('function');
	});

	describe('filtering data with various options', function() {

		var data = [
			{ someField: '1' },
			{ someField: '2', other: 'field' },
			{ anItem: 'missing-fields' },
			{ someField: '4', anArrayField: ['text', 'field'] },
			{ someField: '5', anArrayField: ['different'] }
		];

		var tests = [
			{
				description: 'include (strict)',
				options: {
					mode: 'strict',
					include: {
						someField: ['2']
					}
				},
				expected: [
					{ someField: '2', other: 'field' }
				]
			},
			{
				description: 'exclude (strict)',
				options: {
					mode: 'strict',
					exclude: {
						someField: ['1', '2', '4']
					}
				},
				expected: [
					{ anItem: 'missing-fields' },
					{ someField: '5', anArrayField: ['different'] }
				]
			},
			{
				description: 'include, array-field (strict)',
				options: {
					mode: 'strict',
					include: {
						anArrayField: ['text']
					}
				},
				expected: [
					{ someField: '4', anArrayField: ['text', 'field'] }
				]
			},
			{
				description: 'exclude, array-field (strict)',
				options: {
					mode: 'strict',
					exclude: {
						anArrayField: ['field']
					}
				},
				expected: [
					{ someField: '1' },
					{ someField: '2', other: 'field' },
					{ anItem: 'missing-fields' },
					{ someField: '5', anArrayField: ['different'] }
				]
			},
			{
				description: 'include (loose)',
				options: {
					mode: 'loose',
					include: {
						someField: ['2']
					}
				},
				expected: [
					{ someField: '2', other: 'field' },
					{ anItem: 'missing-fields' }
				]
			},
			{
				description: 'include, array-field (loose)',
				options: {
					mode: 'loose',
					include: {
						anArrayField: ['text']
					}
				},
				expected: [
					{ someField: '1' },
					{ someField: '2', other: 'field' },
					{ anItem: 'missing-fields' },
					{ someField: '4', anArrayField: ['text', 'field'] }
				]
			}
		];

		_.each(tests, function(test) {
			it(test.description, function() {
				var filtered = dataSourcer.filterData(data, dataSourcer.prepareFilterOptions(test.options));
				expect(filtered).to.deep.equal(test.expected);
			});
		});
	});
});
