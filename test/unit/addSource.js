'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('addSource(name, source)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.addSource).to.be.a('function');
	});

	var validDummySource = {
		homeUrl: 'https://somewhere',
		getData: function() {}
	};

	it('should throw an error when the source name is invalid', function() {
		var thrownError;
		try {
			dataSourcer.addSource('', validDummySource);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.not.be.undefined;
		expect(thrownError.message).to.equal('Invalid source name: ""');
	});

	it('should throw an error when a source already exists with the same name', function() {
		var name = 'already-exists';
		dataSourcer.addSource(name, validDummySource);
		var thrownError;
		try {
			dataSourcer.addSource(name, validDummySource);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.not.be.undefined;
		expect(thrownError.message).to.equal('Source already exists: "' + name + '"');
	});

	it('should throw an error when source is not an object', function() {
		_.each([null, 1, 'text', false], function(source) {
			var thrownError;
			try {
				dataSourcer.addSource('somewhere', source);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Expected "source" to be an object.');
		});
	});

	it('should throw an error when source is missing the getData method', function() {
		_.each([
			_.omit(validDummySource, 'getData'),
			_.extend({}, validDummySource, { getData: 'not-a-function' }),
			_.extend({}, validDummySource, { getData: null })
		], function(source) {
			var thrownError;
			try {
				dataSourcer.addSource('somewhere', source);
			} catch (error) {
				thrownError = error;
			}
			expect(thrownError).to.not.be.undefined;
			expect(thrownError.message).to.equal('Source missing required method: "getData"');
		});
	});

	it('should add a valid source', function() {
		var name = 'a-valid-source';
		var thrownError;
		try {
			dataSourcer.addSource(name, validDummySource);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.be.undefined;
		expect(dataSourcer.sourceExists(name)).to.equal(true);
	});
});
