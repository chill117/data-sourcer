'use strict';

var _ = require('underscore');
var expect = require('chai').expect;

var DataSourcer = require('../../index');

describe('listSources([options])', function() {

	var dataSourcer;
	var numTestSources = 3;

	before(function() {
		dataSourcer = new DataSourcer();
		dataSourcer.addSource('somewhere', { homeUrl: 'https://somewhere', getData: function() {} });
		dataSourcer.addSource('somewhere-else', { homeUrl: 'https://somewhere-else', getData: function() {} });
		dataSourcer.addSource('other', { homeUrl: 'https://other', getData: function() {} });
	});

	it('should be a function', function() {
		expect(dataSourcer.listSources).to.be.a('function');
	});

	it('should return an array of all sources', function() {
		var sources = dataSourcer.listSources();
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
					['somewhere'],
					['somewhere', 'other']
				];

				_.each(sourcesWhiteLists, function(sourcesWhiteList) {
					var sources = dataSourcer.listSources({ sourcesWhiteList: sourcesWhiteList });
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
					['somewhere-else'],
					['other', 'somewhere']
				];

				_.each(sourcesBlackLists, function(sourcesBlackList) {
					var sources = dataSourcer.listSources({ sourcesBlackList: sourcesBlackList });
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
