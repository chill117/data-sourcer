'use strict';

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
			expect(thrownError.message).to.equal('Missing required option (`option.' + name + '.something`): ' + requiredOptions.something);
		});
	});
});
