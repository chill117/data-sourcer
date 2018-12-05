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

	afterEach(function(done) {
		dataSourcer.close(done);
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

	it('process before filter', function(done) {

		var name = 'process-then-filter';
		var sampleData = [
			{ someField: 0 },
			{ someField: 1 },
			{ someField: 2 },
			{ someField: 3 }
		];

		dataSourcer.addSource(name, {
			getData: function() {
				var emitter = new EventEmitter;
				_.defer(function() {
					emitter.emit('data', sampleData);
					emitter.emit('end');
				});
				return emitter;
			}
		});

		var receivedData;

		dataSourcer.getDataFromSource(name, {
			filter: {
				mode: 'strict',
				include: {
					added: '1',
				},
			},
			process: function(item) {
				item.added = '1';
				return item;
			}
		})
			.on('data', function(data) {
				receivedData = data;
			})
			.on('end', function() {
				expect(receivedData).to.not.be.undefined;
				expect(receivedData).to.have.length(sampleData.length);
				done();
			});
	});

	it('no empty data', function(done) {

		var name = 'no-empty-data';
		var sampleData = [
			{ someField: 0 },
			{ someField: 1 },
			{ someField: 2 },
			{ someField: 3 }
		];

		dataSourcer.addSource(name, {
			getData: function() {
				var emitter = new EventEmitter;
				_.defer(function() {
					emitter.emit('data', sampleData);
					emitter.emit('end');
				});
				return emitter;
			}
		});

		var receivedData;

		dataSourcer.getDataFromSource(name, {
			filter: {
				mode: 'strict',
				include: {
					otherField: '1',
				},
			}
		})
			.on('data', function(data) {
				receivedData = data;
			})
			.on('end', function() {
				expect(receivedData).to.be.undefined;
				done();
			});
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
