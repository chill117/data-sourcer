'use strict';

var _ = require('underscore');
var async = require('async');
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../index');

describe('loadSourceFromFile(filePath)', function() {

	var sourcesDir = path.join(__dirname, '..', 'sources');
	var sourceFilePath = path.join(sourcesDir, 'test-source.js');

	before(function(done) {
		fs.stat(sourcesDir, function(error) {
			if (!error) return done();
			fs.mkdir(sourcesDir, done);
		});
	});

	before(function(done) {
		var content = 'module.exports = { homeUrl: \'https://test-source\', getData: function() {} };';
		fs.writeFile(sourceFilePath, content, done);
	});

	after(function(done) {
		fs.readdir(sourcesDir, function(error, files) {
			if (error) return done(error);
			async.each(files, function(file, next) {
				var filePath = path.join(sourcesDir, file);
				fs.unlink(filePath, next);
			}, done);
		});
	});

	after(function(done) {
		fs.rmdir(sourcesDir, done);
	});

	var dataSourcer;

	beforeEach(function() {
		dataSourcer = new DataSourcer();
	});

	afterEach(function(done) {
		dataSourcer.close(done);
	});

	it('should be a function', function() {
		expect(dataSourcer.loadSourceFromFile).to.be.a('function');
	});

	it('should return FALSE when the file does not exist', function() {
		var filePath = path.join(sourcesDir, 'does-not-exist.js');
		var result = dataSourcer.loadSourceFromFile(filePath);
		expect(result).to.equal(false);
	});

	it('should return TRUE when successful', function() {
		var result = dataSourcer.loadSourceFromFile(sourceFilePath);
		expect(result).to.equal(true);
	});

	it('should load the sources in the given directory', function() {
		dataSourcer.loadSourceFromFile(sourceFilePath);
		expect(_.keys(dataSourcer.sources)).to.have.length(1);
		expect(dataSourcer.sources['test-source']).to.not.be.undefined;
	});
});
