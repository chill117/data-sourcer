'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('prepareOptions(options, defaultOptions)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.prepareOptions).to.be.a('function');
	});

	it('should return the options object with the defaults added', function() {

		var samples = [
			{
				options: {},
				defaultOptions: { some: 'default-value', another: 1 },
				expected: { some: 'default-value', another: 1 }
			},
			{
				options: { some: 'other-value' },
				defaultOptions: { some: 'default-value', another: 1 },
				expected: { some: 'other-value', another: 1 }
			},
			{
				options: {
					filter: {
						include: {
							'some-field': [4, 2],
							'another-field': [true]
						}
					}
				},
				defaultOptions: {
					filter: {
						include: {
							'some-field': [5],
							'one-more-field': [false]
						},
						exclude: {
							'some-other-field': ['text']
						}
					},
					requestQueue: {
						concurrency: 1,
						delay: 0
					}
				},
				expected: {
					filter: {
						include: {
							'some-field': [4, 2],
							'another-field': [true],
							'one-more-field': [false]
						},
						exclude: {
							'some-other-field': ['text']
						}
					},
					requestQueue: {
						concurrency: 1,
						delay: 0
					}
				}
			}
		];

		_.each(samples, function(sample) {
			var result = dataSourcer.prepareOptions(sample.options, sample.defaultOptions);
			expect(result).to.deep.equal(sample.expected);
		});
	});
});
