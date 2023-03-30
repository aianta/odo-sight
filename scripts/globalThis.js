/**
 * Allows us to run without violating Content Security Policy (CSP).
 * https://github.com/facebook/regenerator/issues/378
 * 
 * https://mathiasbynens.be/notes/globalthis
 */


(function() {
	if (typeof globalThis === 'object') return;
	Object.prototype.__defineGetter__('__magic__', function() {
		return this;
	});
	__magic__.globalThis = __magic__; // lolwat
	delete Object.prototype.__magic__;
}());

globalThis.regeneratorRuntime = undefined