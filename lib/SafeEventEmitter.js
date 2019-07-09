'use strict';

var EventEmitter = require('events').EventEmitter || require('events');
var util = require('util');
var SafeEventEmitter = module.exports = function() {};

util.inherits(SafeEventEmitter, EventEmitter);

SafeEventEmitter.prototype.emit = function(eventName) {
	try {
		var hasListeners = this.listeners(eventName).length > 0;
		EventEmitter.prototype.emit.apply(this, arguments);
	} catch (error) {
		this.emit('error', error);
	}
	return hasListeners;
};
