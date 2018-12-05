'use strict';

var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('sourceExists(name)', function() {

	var dataSourcer;

	before(function() {
		dataSourcer = new DataSourcer();
	});

	after(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.sourceExists).to.be.a('function');
	});

	it('should return TRUE if source exists', function() {
		var name = 'exists';
		dataSourcer.addSource(name, {
			homeUrl: 'https://somewhere',
			getData: function() {}
		});
		expect(dataSourcer.sourceExists(name)).to.equal(true);
	});

	it('should return FALSE if source does not exist', function() {
		expect(dataSourcer.sourceExists('does-not-exist')).to.equal(false);
	});
});
