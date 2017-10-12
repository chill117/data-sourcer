'use strict';

var _ = require('underscore');
var expect = require('chai').expect;
var fs = require('fs');
var path = require('path');

var DataSourcer = require('../../index');

describe('listSources([options])', function() {

	var testSourcesDir;
	var testDataSourcer;

	before(function() {
		testSourcesDir = path.join(__dirname, '..', 'sources');
		testDataSourcer = new DataSourcer({
			sourcesDir: testSourcesDir
		});
	});

	var numTestSources;

	before(function(done) {
		fs.readdir(testSourcesDir, function(error, files) {
			if (error) return done(error);
			numTestSources = files.length;
			done();
		});
	});

	it('should be a function', function() {
		expect(testDataSourcer.listSources).to.be.a('function');
	});

	it('should return an array of all sources', function() {
		var sources = testDataSourcer.listSources();
		expect(sources).to.be.an('array');
		expect(sources).to.have.length(numTestSources);
		_.each(sources, function(source) {
			expect(_.has(source, 'name')).to.equal(true);
			expect(source.name).to.be.a('string');
			expect(_.has(source, 'homeUrl')).to.equal(true);
		});
	});

	describe('options', function() {

		describe('sourcesWhiteList', function() {

			it('should return an array of only the sources in the "sourcesWhiteList"', function() {

				var sourcesWhiteLists = [
					[],
					['test-source-1']
				];

				_.each(sourcesWhiteLists, function(sourcesWhiteList) {
					var sources = testDataSourcer.listSources({ sourcesWhiteList: sourcesWhiteList });
					expect(sources).to.be.an('array');
					expect(sources).to.have.length(sourcesWhiteList.length);
					_.each(sources, function(source) {
						expect(_.contains(sourcesWhiteList, source.name)).to.equal(true);
					});
				});
			});
		});

		describe('sourcesBlackList', function() {

			it('should return an array of only the sources not in the "sourcesBlackList"', function() {

				var sourcesBlackLists = [
					[],
					['test-source-1']
				];

				_.each(sourcesBlackLists, function(sourcesBlackList) {
					var sources = testDataSourcer.listSources({ sourcesBlackList: sourcesBlackList });
					expect(sources).to.be.an('array');
					expect(sources).to.have.length(numTestSources - sourcesBlackList.length);
					_.each(sources, function(source) {
						expect(!_.contains(sourcesBlackList, source.name)).to.equal(true);
					});
				});
			});
		});
	});
});
