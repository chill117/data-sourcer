'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('prepareSourceOptions(name[, options])', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.prepareSourceOptions).to.be.a('function');
	});

	it('should return an options object for a source', function() {

		var name = 'somewhere';
		var source = {
			defaultOptions: {
				something: '123',
			},
			getData: _.noop,
		};

		dataSourcer.addSource(name, source);

		var options = {
			sourcesWhiteList: [ 'somewhere' ],
			sourcesBlackList: [ 'other' ],
			requestQueue: {
				concurrency: 1,
				delay: 0
			},
			filter: {
				include: {
					someField: ['1']
				}
			},
			sourceOptions: {
				somewhere: {
					another: 'option'
				},
				another: {
					option: 1
				}
			}
		};

		var sourceOptions = dataSourcer.prepareSourceOptions(name, options);

		// Check for options that should have been omitted.
		expect(sourceOptions.sourcesWhiteList).to.be.undefined;
		expect(sourceOptions.sourcesBlackList).to.be.undefined;
		expect(sourceOptions.requestQueue).to.be.undefined;
		expect(sourceOptions.browser).to.be.undefined;

		// Check for options that should be kept.
		expect(sourceOptions.filter).to.deep.equal(options.filter);

		// Check for options that should have been added.
		expect(sourceOptions.request).to.be.a('function');

		// Test for mutating options.
		sourceOptions.test = 'change';
		sourceOptions.filter.include.someField = ['2'];
		expect(sourceOptions.filter.include.someField).to.not.deep.equal(options.filter.include.someField);

		// Check for name-spaced sourceOptions.
		expect(sourceOptions.sourceOptions).to.deep.equal(_.defaults(
			options.sourceOptions.somewhere,
			source.defaultOptions
		));
	});
});
