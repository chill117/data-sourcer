'use strict';

var _ = require('underscore');
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

	it('handles thrown error inside data callback', function(done) {
		var name = 'data-callback-thrown-error';
		dataSourcer.addSource(name, {
			getData: function(options) {
				var emitter = options.newEventEmitter();
				_.defer(function() {
					emitter.emit('data', [{ something: '123' }]);
					emitter.emit('end');
				});
				return emitter;
			}
		});
		var testThrownErrorMessage = 'This should be handled';
		var errorMessage;
		dataSourcer.getDataFromSource(name)
			.on('data', function() {
				throw new Error(testThrownErrorMessage);
			})
			.on('error', function(error) {
				errorMessage = error.message;
			})
			.once('end', function() {
				try {
					expect(errorMessage).to.equal(testThrownErrorMessage);
				} catch (error) {
					return done(error);
				}
				done();
			});
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
			getData: function(options) {
				var emitter = options.newEventEmitter();
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

	it('no data with only source', function(done) {

		var name = 'no-data-with-only-source';
		var sampleData = [
			{},
			{},
		];

		dataSourcer.addSource(name, {
			getData: function(options) {
				var emitter = options.newEventEmitter();
				_.defer(function() {
					emitter.emit('data', sampleData);
					emitter.emit('end');
				});
				return emitter;
			}
		});

		var receivedData;
		dataSourcer.getDataFromSource(name)
			.on('data', function(data) {
				receivedData = data;
			})
			.on('end', function() {
				try {
					expect(receivedData).to.be.undefined;
				} catch (error) {
					return done(error);
				}
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
			getData: function(options) {
				var emitter = options.newEventEmitter();
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
				try {
					expect(receivedData).to.be.undefined;
				} catch (error) {
					return done(error);
				}
				done();
			});
	});

	describe('options', function() {

		describe('process(fn)', function() {

			it('handles thrown error', function(done) {
				var name = 'process-thrown-error';
				dataSourcer.addSource(name, {
					getData: function(options) {
						var emitter = options.newEventEmitter();
						_.defer(function() {
							emitter.emit('data', [{ something: '123' }]);
							emitter.emit('end');
						});
						return emitter;
					}
				});
				var testThrownErrorMessage = 'This should be handled';
				var errorMessage;
				dataSourcer.getDataFromSource(name, {
					process: function() {
						throw new Error(testThrownErrorMessage);
					}
				})
					.on('error', function(error) {
						errorMessage = error.message;
					})
					.once('end', function() {
						try {
							expect(errorMessage).to.equal(testThrownErrorMessage);
						} catch (error) {
							return done(error);
						}
						done();
					});
			});

			it('modifies item as expected', function(done) {

				var name = 'process';
				var sampleData = [
					{ something: '4' },
					{ something: '5' },
					{ something: '6' }
				];

				dataSourcer.addSource(name, {
					getData: function(options) {
						var emitter = options.newEventEmitter();
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

		describe('sampleDataLimit', function() {

			it('should not return a greater number of items than set by "sampleDataLimit"', function() {

				var name = 'sample-data-limit';
				var sampleData = [
					{ someField: 0 },
					{ someField: 1 },
					{ someField: 2 },
					{ someField: 3 }
				];

				dataSourcer.addSource(name, {
					getData: function(options) {
						var emitter = options.newEventEmitter();
						_.defer(function() {
							emitter.emit('data', sampleData);
							emitter.emit('end');
						});
						return emitter;
					}
				});

				var options = {
					sample: true,
					sampleDataLimit: 3,
				};

				var receivedData;
				dataSourcer.getDataFromSource(name, options)
					.on('data', function(data) {
						receivedData = data;
					})
					.on('end', function() {
						try {
							expect(receivedData).to.be.an('array');
							expect(receivedData).to.have.length(options.sampleDataLimit);
						} catch (error) {
							return done(error);
						}
						done();
					});
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
				getData: function(options) {
					var emitter = options.newEventEmitter();
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
			expect(thrownError.message).to.equal('Missing required option (`sourceOptions.' + name + '.something`): ' + requiredOptions.something);
		});
	});
});
