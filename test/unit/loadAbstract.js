'use strict';

var async = require('async');
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../index');

describe('loadAbstract(name)', function() {

	var abstractsDir = path.join(__dirname, '..', 'abstracts');
	var abstractFilePath = path.join(abstractsDir, 'test-abstract.js');

	before(function(done) {
		fs.stat(abstractsDir, function(error) {
			if (!error) return done();
			fs.mkdir(abstractsDir, done);
		});
	});

	before(function(done) {
		var content = 'module.exports = { homeUrl: null, getData: function() {}, customMethod: function() {} };';
		fs.writeFile(abstractFilePath, content, done);
	});

	after(function(done) {
		fs.readdir(abstractsDir, function(error, files) {
			if (error) return done(error);
			async.each(files, function(file, next) {
				var filePath = path.join(abstractsDir, file);
				fs.unlink(filePath, next);
			}, done);
		});
	});

	after(function(done) {
		fs.rmdir(abstractsDir, done);
	});

	var dataSourcer;

	beforeEach(function() {
		dataSourcer = new DataSourcer({
			abstractsDir: abstractsDir,
		});
	});

	afterEach(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.addSource).to.be.a('function');
	});

	it('should load the abstract', function() {
		var name = 'test-abstract';
		var thrownError;
		try {
			var abstract = dataSourcer.loadAbstract(name);
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
