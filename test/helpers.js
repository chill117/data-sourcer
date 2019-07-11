'use strict';

var _ = require('underscore');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');

var directories = {
	tmp: path.join(__dirname, 'tmp'),
};
directories.abstracts = path.join(directories.tmp, 'abstracts');

module.exports = {
	directories: directories,
	createTestAbstract: function(name, abstract, cb) {
		mkdirp(directories.abstracts, function(error) {
			if (error) return cb(error);
			var filePath = path.join(directories.abstracts, name + '.js');
			var content;
			if (_.isString(abstract)) {
				content = abstract;
			} else {
				content = 'module.exports = ' + JSON.stringify(abstract);
			}
			fs.writeFile(filePath, content, cb);
		});
	},
	destroyTestAbstract: function(name, cb) {
		var filePath = path.join(directories.abstracts, name + '.js');
		fs.unlink(filePath, cb);
	},
};
