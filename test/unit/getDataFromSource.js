'use strict';

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter || require('events');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('getDataFromSource(name, [options, ]cb)', function() {

	var dataSourcer;

	beforeEach(function() {
		dataSourcer = new DataSourcer();
	});

	it('should be a function', function() {
		expect(dataSourcer.getDataFromSource).to.be.a('function');
	});

	it('should throw an error if the source does not exist', function() {

		var name = 'does-not-exist';
		var thrownError;

		try {
			dataSourcer.getDataFromSource(name);
		} catch (error) {
			thrownError = error;
		}

		expect(thrownError).to.not.be.undefined;
		expect(thrownError.message).to.equal('Data source does not exist: "' + name + '"');
	});

	it('should call getData() method of the specified source', function(done) {

		var name = 'somewhere';

		dataSourcer.addSource(name, {
			getData: function() {
				done();
			}
		});

		dataSourcer.getDataFromSource(name);
	});

	describe('options', function() {

		it('process', function(done) {

			var name = 'process';
			var sampleData = [
				{ something: '4' },
				{ something: '5' },
				{ something: '6' }
			];

			dataSourcer.addSource(name, {
				getData: function() {
					var emitter = new EventEmitter;
					_.defer(function() {
						emitter.emit('data', sampleData);
					});
					return emitter;
				}
			});

			dataSourcer.getDataFromSource(name, {
				process: function(item) {
					item.added = 'some-attribute';
					return item;
				}
			})
				.on('data', function(processed) {
					var processedDataCorrect = _.every(processed, function(item) {
						return _.has(item, 'something') && _.has(item, 'added');
					});
					expect(processedDataCorrect).to.equal(true);
					done();
				});
		});
	});

	describe('requiredOptions', function() {

		it('should throw an error when missing a required option', function() {

			var name = 'has-required-options';
			var requiredOptions = {
				something: 'This is a required option!'
			};

			dataSourcer.addSource(name, {
				requiredOptions: requiredOptions,
				getData: function() {
					var emitter = new EventEmitter();
					return emitter;
				}
			});

			var thrownError;

			try {
				dataSourcer.getDataFromSource(name);
			} catch (error) {
				thrownError = error;
			}

			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Missing required option (`option.sourceOptions.' + name + '.something`): ' + requiredOptions.something);
		});
	});
});
