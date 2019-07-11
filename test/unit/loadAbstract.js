'use strict';

var async = require('async');
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../index');
var helpers = require('../helpers');

describe('loadAbstract(name)', function() {

	var dataSourcer;
	beforeEach(function() {
		dataSourcer = new DataSourcer({
			abstractsDir: helpers.directories.abstracts,
		});
	});

	var abstractName = 'loadAbstract';
	before(function(done) {
		var abstract = 'module.exports = { homeUrl: null, getData: function() {}, customMethod: function() {} };'
		helpers.createTestAbstract(abstractName, abstract, done);
	});

	after(function(done) {
		helpers.destroyTestAbstract(abstractName, done);
	});

	afterEach(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.loadAbstract).to.be.a('function');
	});

	it('should load the abstract', function() {
		var thrownError;
		try {
			var abstract = dataSourcer.loadAbstract(abstractName);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.be.undefined;
		expect(abstract).to.be.an('object');
		expect(abstract.homeUrl).to.equal(null);
		expect(abstract.getData).to.be.a('function');
		expect(abstract.customMethod).to.be.a('function');
	});
});
