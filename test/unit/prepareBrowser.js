'use strict';

var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('prepareBrowser(done)', function() {

	var dataSourcer;
	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.prepareBrowser).to.be.a('function');
	});

	it('throws error when no callback is provided', function() {
		var thrownError;
		try {
			dataSourcer.prepareBrowser();
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.not.be.undefined;
		expect(thrownError instanceof Error).to.equal(true);
		expect(thrownError.message).to.equal('Missing required callback');
	});

	it('prepares browser instance', function(done) {
		this.timeout(5000);
		try {
			expect(dataSourcer.browser).to.be.undefined;
		} catch (error) {
			return done(error);
		}
		dataSourcer.prepareBrowser(function(error) {
			if (error) return done(error);
			try {
				expect(dataSourcer.browser).to.not.be.undefined;
			} catch (error) {
				return done(error);
			}
			done();
		});
	});
});
