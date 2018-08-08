'use strict';

var DataSourcer = require('../../../index');

describe('options', function() {

	describe('getDataMethodName', function() {

		it('non-default usage', function(done) {
			var getDataMethodName = 'getSomething';
			var dataSourcer = new DataSourcer({
				getDataMethodName: getDataMethodName,
			});
			var name = 'some-source';
			var source = {};
			source[getDataMethodName] = function() {
				done();
			};
			dataSourcer.addSource(name, source);
			dataSourcer.getDataFromSource(name);
		});
	});
});
