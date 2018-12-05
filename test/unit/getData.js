'use strict';

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter || require('events');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('getData([options])', function() {

	var dataSourcer;

	beforeEach(function() {
		dataSourcer = new DataSourcer();
	});

	afterEach(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.getData).to.be.a('function');
	});

	it('should return an event emitter', function() {
		var emitter = dataSourcer.getData();
		expect(emitter instanceof EventEmitter).to.equal(true);
	});

	it('should get proxies from all sources', function(done) {
		var sources = ['source-1', 'source-2', 'source-3'];
		var gotDataFromSource = {};
		_.each(sources, function(name) {
			dataSourcer.addSource(name, {
				homeUrl: 'https://' + name,
				getData: function() {
					var emitter = new EventEmitter;
					gotDataFromSource[name] = true;
					_.defer(function() {
						emitter.emit('end');
					});
					return emitter;
				}
			});
		});
		dataSourcer.getData().on('end', function() {
			try {
				_.each(sources, function(name) {
					expect(gotDataFromSource[name]).to.equal(true);
				});
			} catch (error) {
				return done(new Error('Expected to get data from every source.'));
			}
			done();
		});
	});

	it('should bubble up "error" events', function(done) {
		var sampleError = new Error('Some error!');
		dataSourcer.addSource('somewhere', {
			homeUrl: 'https://somewhere',
			getData: function() {
				var emitter = new EventEmitter;
				_.defer(function() {
					emitter.emit('error', sampleError);
				});
				return emitter;
			}
		});
		dataSourcer.getData().on('error', function(error) {
			try {
				expect(error).to.deep.equal(sampleError);
			} catch (error) {
				return done(error);
			}
			done();
		});
	});

	it('should bubble up "data" events', function(done) {

		var sampleData = [
			{ some: 'data' },
			{ some: 'more-data', withOtherAttributes: 2 }
		];
		var name = 'somewhere';

		dataSourcer.addSource(name, {
			homeUrl: 'https://somewhere',
			getData: function() {
				var emitter = new EventEmitter;
				_.defer(function() {
					emitter.emit('data', sampleData);
				});
				return emitter;
			}
		});

		dataSourcer.getData().on('data', function(data) {

			var expectedData = _.map(sampleData, function(item) {
				item = _.clone(item);
				item.source = name;
				return item;
			});

			try {
				expect(data).to.deep.equal(expectedData);
			} catch (error) {
				return done(error);
			}

			done();
		});
	});

	describe('options', function() {

		describe('series: TRUE', function() {

			it('should get data from all sources in series', function(done) {

				var sources = ['somewhere', 'somewhere-else'];
				var called = {};

				var getDataCalledForSource = function(name) {

					var nextExpected = sources[_.keys(called).length];

					try {
						expect(name).to.equal(nextExpected);
					} catch (error) {
						return done(error);
					}

					called[name] = true;
				};

				_.each(sources, function(name) {
					dataSourcer.addSource(name, {
						homeUrl: 'https://' + name,
						getData: function() {
							var emitter = new EventEmitter();
							_.defer(function() {
								getDataCalledForSource(name);
								emitter.emit('end');
							});
							return emitter;
						}
					});
				});

				dataSourcer.getData({ series: true }).on('end', function() {

					try {
						expect(_.keys(called)).to.have.length(sources.length);
					} catch (error) {
						return done(error);
					}

					done();
				});
			});
		});
	});

	describe('requiredOptions', function() {

		it('should receive error event when a source is missing required options', function(done) {

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

			done = _.once(done);

			dataSourcer.getData()
				.on('error', function() {
					done();
				})
				.once('end', function() {
					done(new Error('Expected an error event.'));
				});
		});
	});
});
