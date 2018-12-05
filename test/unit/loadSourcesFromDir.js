'use strict';

var _ = require('underscore');
var async = require('async');
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../index');

describe('loadSourcesFromDir(dirPath)', function() {

	var numTestSources = 3;
	var sourcesDir = path.join(__dirname, '..', 'sources');

	before(function(done) {
		fs.stat(sourcesDir, function(error) {
			if (!error) return done();
			fs.mkdir(sourcesDir, done);
		});
	});

	before(function(done) {
		async.times(numTestSources, function(index, next) {
			var filePath = path.join(sourcesDir, 'test-source-' + index + '.js');
			var content = 'module.exports = { homeUrl: \'https://test-source-' + index + '\', getData: function() {} };';
			fs.writeFile(filePath, content, next);
		}, done);
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
		expect(dataSourcer.loadSourcesFromDir).to.be.a('function');
	});

	it('should throw an error when the directory does not exist', function() {
		var thrownError;
		try {
			var dirPath = path.join(__dirname, 'does-not-exist');
			dataSourcer.loadSourcesFromDir(dirPath);
		} catch (error) {
			thrownError = error;
		}
		expect(thrownError).to.not.be.undefined;
		expect(thrownError.message.indexOf('no such file or directory') !== -1).to.equal(true);
	});

	it('should load the source from the given file', function() {
		dataSourcer.loadSourcesFromDir(sourcesDir);
		expect(_.keys(dataSourcer.sources)).to.have.length(numTestSources);
		for (var index = 0; index < numTestSources; index++) {
			expect(dataSourcer.sources['test-source-' + index]).to.not.be.undefined;
		}
	});
});
