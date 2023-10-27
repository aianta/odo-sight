var LogUI = (function () {
	'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	var runtime_1 = createCommonjsModule(function (module) {
	  /**
	   * Copyright (c) 2014-present, Facebook, Inc.
	   *
	   * This source code is licensed under the MIT license found in the
	   * LICENSE file in the root directory of this source tree.
	   */
	  var runtime = function (exports) {

	    var Op = Object.prototype;
	    var hasOwn = Op.hasOwnProperty;
	    var undefined$1; // More compressible than void 0.

	    var $Symbol = typeof Symbol === "function" ? Symbol : {};
	    var iteratorSymbol = $Symbol.iterator || "@@iterator";
	    var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
	    var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

	    function define(obj, key, value) {
	      Object.defineProperty(obj, key, {
	        value: value,
	        enumerable: true,
	        configurable: true,
	        writable: true
	      });
	      return obj[key];
	    }

	    try {
	      // IE 8 has a broken Object.defineProperty that only works on DOM objects.
	      define({}, "");
	    } catch (err) {
	      define = function (obj, key, value) {
	        return obj[key] = value;
	      };
	    }

	    function wrap(innerFn, outerFn, self, tryLocsList) {
	      // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
	      var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
	      var generator = Object.create(protoGenerator.prototype);
	      var context = new Context(tryLocsList || []); // The ._invoke method unifies the implementations of the .next,
	      // .throw, and .return methods.

	      generator._invoke = makeInvokeMethod(innerFn, self, context);
	      return generator;
	    }

	    exports.wrap = wrap; // Try/catch helper to minimize deoptimizations. Returns a completion
	    // record like context.tryEntries[i].completion. This interface could
	    // have been (and was previously) designed to take a closure to be
	    // invoked without arguments, but in all the cases we care about we
	    // already have an existing method we want to call, so there's no need
	    // to create a new function object. We can even get away with assuming
	    // the method takes exactly one argument, since that happens to be true
	    // in every case, so we don't have to touch the arguments object. The
	    // only additional allocation required is the completion record, which
	    // has a stable shape and so hopefully should be cheap to allocate.

	    function tryCatch(fn, obj, arg) {
	      try {
	        return {
	          type: "normal",
	          arg: fn.call(obj, arg)
	        };
	      } catch (err) {
	        return {
	          type: "throw",
	          arg: err
	        };
	      }
	    }

	    var GenStateSuspendedStart = "suspendedStart";
	    var GenStateSuspendedYield = "suspendedYield";
	    var GenStateExecuting = "executing";
	    var GenStateCompleted = "completed"; // Returning this object from the innerFn has the same effect as
	    // breaking out of the dispatch switch statement.

	    var ContinueSentinel = {}; // Dummy constructor functions that we use as the .constructor and
	    // .constructor.prototype properties for functions that return Generator
	    // objects. For full spec compliance, you may wish to configure your
	    // minifier not to mangle the names of these two functions.

	    function Generator() {}

	    function GeneratorFunction() {}

	    function GeneratorFunctionPrototype() {} // This is a polyfill for %IteratorPrototype% for environments that
	    // don't natively support it.


	    var IteratorPrototype = {};

	    IteratorPrototype[iteratorSymbol] = function () {
	      return this;
	    };

	    var getProto = Object.getPrototypeOf;
	    var NativeIteratorPrototype = getProto && getProto(getProto(values([])));

	    if (NativeIteratorPrototype && NativeIteratorPrototype !== Op && hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
	      // This environment has a native %IteratorPrototype%; use it instead
	      // of the polyfill.
	      IteratorPrototype = NativeIteratorPrototype;
	    }

	    var Gp = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(IteratorPrototype);
	    GeneratorFunction.prototype = Gp.constructor = GeneratorFunctionPrototype;
	    GeneratorFunctionPrototype.constructor = GeneratorFunction;
	    GeneratorFunction.displayName = define(GeneratorFunctionPrototype, toStringTagSymbol, "GeneratorFunction"); // Helper for defining the .next, .throw, and .return methods of the
	    // Iterator interface in terms of a single ._invoke method.

	    function defineIteratorMethods(prototype) {
	      ["next", "throw", "return"].forEach(function (method) {
	        define(prototype, method, function (arg) {
	          return this._invoke(method, arg);
	        });
	      });
	    }

	    exports.isGeneratorFunction = function (genFun) {
	      var ctor = typeof genFun === "function" && genFun.constructor;
	      return ctor ? ctor === GeneratorFunction || // For the native GeneratorFunction constructor, the best we can
	      // do is to check its .name property.
	      (ctor.displayName || ctor.name) === "GeneratorFunction" : false;
	    };

	    exports.mark = function (genFun) {
	      if (Object.setPrototypeOf) {
	        Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
	      } else {
	        genFun.__proto__ = GeneratorFunctionPrototype;
	        define(genFun, toStringTagSymbol, "GeneratorFunction");
	      }

	      genFun.prototype = Object.create(Gp);
	      return genFun;
	    }; // Within the body of any async function, `await x` is transformed to
	    // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
	    // `hasOwn.call(value, "__await")` to determine if the yielded value is
	    // meant to be awaited.


	    exports.awrap = function (arg) {
	      return {
	        __await: arg
	      };
	    };

	    function AsyncIterator(generator, PromiseImpl) {
	      function invoke(method, arg, resolve, reject) {
	        var record = tryCatch(generator[method], generator, arg);

	        if (record.type === "throw") {
	          reject(record.arg);
	        } else {
	          var result = record.arg;
	          var value = result.value;

	          if (value && typeof value === "object" && hasOwn.call(value, "__await")) {
	            return PromiseImpl.resolve(value.__await).then(function (value) {
	              invoke("next", value, resolve, reject);
	            }, function (err) {
	              invoke("throw", err, resolve, reject);
	            });
	          }

	          return PromiseImpl.resolve(value).then(function (unwrapped) {
	            // When a yielded Promise is resolved, its final value becomes
	            // the .value of the Promise<{value,done}> result for the
	            // current iteration.
	            result.value = unwrapped;
	            resolve(result);
	          }, function (error) {
	            // If a rejected Promise was yielded, throw the rejection back
	            // into the async generator function so it can be handled there.
	            return invoke("throw", error, resolve, reject);
	          });
	        }
	      }

	      var previousPromise;

	      function enqueue(method, arg) {
	        function callInvokeWithMethodAndArg() {
	          return new PromiseImpl(function (resolve, reject) {
	            invoke(method, arg, resolve, reject);
	          });
	        }

	        return previousPromise = // If enqueue has been called before, then we want to wait until
	        // all previous Promises have been resolved before calling invoke,
	        // so that results are always delivered in the correct order. If
	        // enqueue has not been called before, then it is important to
	        // call invoke immediately, without waiting on a callback to fire,
	        // so that the async generator function has the opportunity to do
	        // any necessary setup in a predictable way. This predictability
	        // is why the Promise constructor synchronously invokes its
	        // executor callback, and why async functions synchronously
	        // execute code before the first await. Since we implement simple
	        // async functions in terms of async generators, it is especially
	        // important to get this right, even though it requires care.
	        previousPromise ? previousPromise.then(callInvokeWithMethodAndArg, // Avoid propagating failures to Promises returned by later
	        // invocations of the iterator.
	        callInvokeWithMethodAndArg) : callInvokeWithMethodAndArg();
	      } // Define the unified helper method that is used to implement .next,
	      // .throw, and .return (see defineIteratorMethods).


	      this._invoke = enqueue;
	    }

	    defineIteratorMethods(AsyncIterator.prototype);

	    AsyncIterator.prototype[asyncIteratorSymbol] = function () {
	      return this;
	    };

	    exports.AsyncIterator = AsyncIterator; // Note that simple async functions are implemented on top of
	    // AsyncIterator objects; they just return a Promise for the value of
	    // the final result produced by the iterator.

	    exports.async = function (innerFn, outerFn, self, tryLocsList, PromiseImpl) {
	      if (PromiseImpl === void 0) PromiseImpl = Promise;
	      var iter = new AsyncIterator(wrap(innerFn, outerFn, self, tryLocsList), PromiseImpl);
	      return exports.isGeneratorFunction(outerFn) ? iter // If outerFn is a generator, return the full iterator.
	      : iter.next().then(function (result) {
	        return result.done ? result.value : iter.next();
	      });
	    };

	    function makeInvokeMethod(innerFn, self, context) {
	      var state = GenStateSuspendedStart;
	      return function invoke(method, arg) {
	        if (state === GenStateExecuting) {
	          throw new Error("Generator is already running");
	        }

	        if (state === GenStateCompleted) {
	          if (method === "throw") {
	            throw arg;
	          } // Be forgiving, per 25.3.3.3.3 of the spec:
	          // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume


	          return doneResult();
	        }

	        context.method = method;
	        context.arg = arg;

	        while (true) {
	          var delegate = context.delegate;

	          if (delegate) {
	            var delegateResult = maybeInvokeDelegate(delegate, context);

	            if (delegateResult) {
	              if (delegateResult === ContinueSentinel) continue;
	              return delegateResult;
	            }
	          }

	          if (context.method === "next") {
	            // Setting context._sent for legacy support of Babel's
	            // function.sent implementation.
	            context.sent = context._sent = context.arg;
	          } else if (context.method === "throw") {
	            if (state === GenStateSuspendedStart) {
	              state = GenStateCompleted;
	              throw context.arg;
	            }

	            context.dispatchException(context.arg);
	          } else if (context.method === "return") {
	            context.abrupt("return", context.arg);
	          }

	          state = GenStateExecuting;
	          var record = tryCatch(innerFn, self, context);

	          if (record.type === "normal") {
	            // If an exception is thrown from innerFn, we leave state ===
	            // GenStateExecuting and loop back for another invocation.
	            state = context.done ? GenStateCompleted : GenStateSuspendedYield;

	            if (record.arg === ContinueSentinel) {
	              continue;
	            }

	            return {
	              value: record.arg,
	              done: context.done
	            };
	          } else if (record.type === "throw") {
	            state = GenStateCompleted; // Dispatch the exception by looping back around to the
	            // context.dispatchException(context.arg) call above.

	            context.method = "throw";
	            context.arg = record.arg;
	          }
	        }
	      };
	    } // Call delegate.iterator[context.method](context.arg) and handle the
	    // result, either by returning a { value, done } result from the
	    // delegate iterator, or by modifying context.method and context.arg,
	    // setting context.delegate to null, and returning the ContinueSentinel.


	    function maybeInvokeDelegate(delegate, context) {
	      var method = delegate.iterator[context.method];

	      if (method === undefined$1) {
	        // A .throw or .return when the delegate iterator has no .throw
	        // method always terminates the yield* loop.
	        context.delegate = null;

	        if (context.method === "throw") {
	          // Note: ["return"] must be used for ES3 parsing compatibility.
	          if (delegate.iterator["return"]) {
	            // If the delegate iterator has a return method, give it a
	            // chance to clean up.
	            context.method = "return";
	            context.arg = undefined$1;
	            maybeInvokeDelegate(delegate, context);

	            if (context.method === "throw") {
	              // If maybeInvokeDelegate(context) changed context.method from
	              // "return" to "throw", let that override the TypeError below.
	              return ContinueSentinel;
	            }
	          }

	          context.method = "throw";
	          context.arg = new TypeError("The iterator does not provide a 'throw' method");
	        }

	        return ContinueSentinel;
	      }

	      var record = tryCatch(method, delegate.iterator, context.arg);

	      if (record.type === "throw") {
	        context.method = "throw";
	        context.arg = record.arg;
	        context.delegate = null;
	        return ContinueSentinel;
	      }

	      var info = record.arg;

	      if (!info) {
	        context.method = "throw";
	        context.arg = new TypeError("iterator result is not an object");
	        context.delegate = null;
	        return ContinueSentinel;
	      }

	      if (info.done) {
	        // Assign the result of the finished delegate to the temporary
	        // variable specified by delegate.resultName (see delegateYield).
	        context[delegate.resultName] = info.value; // Resume execution at the desired location (see delegateYield).

	        context.next = delegate.nextLoc; // If context.method was "throw" but the delegate handled the
	        // exception, let the outer generator proceed normally. If
	        // context.method was "next", forget context.arg since it has been
	        // "consumed" by the delegate iterator. If context.method was
	        // "return", allow the original .return call to continue in the
	        // outer generator.

	        if (context.method !== "return") {
	          context.method = "next";
	          context.arg = undefined$1;
	        }
	      } else {
	        // Re-yield the result returned by the delegate method.
	        return info;
	      } // The delegate iterator is finished, so forget it and continue with
	      // the outer generator.


	      context.delegate = null;
	      return ContinueSentinel;
	    } // Define Generator.prototype.{next,throw,return} in terms of the
	    // unified ._invoke helper method.


	    defineIteratorMethods(Gp);
	    define(Gp, toStringTagSymbol, "Generator"); // A Generator should always return itself as the iterator object when the
	    // @@iterator function is called on it. Some browsers' implementations of the
	    // iterator prototype chain incorrectly implement this, causing the Generator
	    // object to not be returned from this call. This ensures that doesn't happen.
	    // See https://github.com/facebook/regenerator/issues/274 for more details.

	    Gp[iteratorSymbol] = function () {
	      return this;
	    };

	    Gp.toString = function () {
	      return "[object Generator]";
	    };

	    function pushTryEntry(locs) {
	      var entry = {
	        tryLoc: locs[0]
	      };

	      if (1 in locs) {
	        entry.catchLoc = locs[1];
	      }

	      if (2 in locs) {
	        entry.finallyLoc = locs[2];
	        entry.afterLoc = locs[3];
	      }

	      this.tryEntries.push(entry);
	    }

	    function resetTryEntry(entry) {
	      var record = entry.completion || {};
	      record.type = "normal";
	      delete record.arg;
	      entry.completion = record;
	    }

	    function Context(tryLocsList) {
	      // The root entry object (effectively a try statement without a catch
	      // or a finally block) gives us a place to store values thrown from
	      // locations where there is no enclosing try statement.
	      this.tryEntries = [{
	        tryLoc: "root"
	      }];
	      tryLocsList.forEach(pushTryEntry, this);
	      this.reset(true);
	    }

	    exports.keys = function (object) {
	      var keys = [];

	      for (var key in object) {
	        keys.push(key);
	      }

	      keys.reverse(); // Rather than returning an object with a next method, we keep
	      // things simple and return the next function itself.

	      return function next() {
	        while (keys.length) {
	          var key = keys.pop();

	          if (key in object) {
	            next.value = key;
	            next.done = false;
	            return next;
	          }
	        } // To avoid creating an additional object, we just hang the .value
	        // and .done properties off the next function object itself. This
	        // also ensures that the minifier will not anonymize the function.


	        next.done = true;
	        return next;
	      };
	    };

	    function values(iterable) {
	      if (iterable) {
	        var iteratorMethod = iterable[iteratorSymbol];

	        if (iteratorMethod) {
	          return iteratorMethod.call(iterable);
	        }

	        if (typeof iterable.next === "function") {
	          return iterable;
	        }

	        if (!isNaN(iterable.length)) {
	          var i = -1,
	              next = function next() {
	            while (++i < iterable.length) {
	              if (hasOwn.call(iterable, i)) {
	                next.value = iterable[i];
	                next.done = false;
	                return next;
	              }
	            }

	            next.value = undefined$1;
	            next.done = true;
	            return next;
	          };

	          return next.next = next;
	        }
	      } // Return an iterator with no values.


	      return {
	        next: doneResult
	      };
	    }

	    exports.values = values;

	    function doneResult() {
	      return {
	        value: undefined$1,
	        done: true
	      };
	    }

	    Context.prototype = {
	      constructor: Context,
	      reset: function (skipTempReset) {
	        this.prev = 0;
	        this.next = 0; // Resetting context._sent for legacy support of Babel's
	        // function.sent implementation.

	        this.sent = this._sent = undefined$1;
	        this.done = false;
	        this.delegate = null;
	        this.method = "next";
	        this.arg = undefined$1;
	        this.tryEntries.forEach(resetTryEntry);

	        if (!skipTempReset) {
	          for (var name in this) {
	            // Not sure about the optimal order of these conditions:
	            if (name.charAt(0) === "t" && hasOwn.call(this, name) && !isNaN(+name.slice(1))) {
	              this[name] = undefined$1;
	            }
	          }
	        }
	      },
	      stop: function () {
	        this.done = true;
	        var rootEntry = this.tryEntries[0];
	        var rootRecord = rootEntry.completion;

	        if (rootRecord.type === "throw") {
	          throw rootRecord.arg;
	        }

	        return this.rval;
	      },
	      dispatchException: function (exception) {
	        if (this.done) {
	          throw exception;
	        }

	        var context = this;

	        function handle(loc, caught) {
	          record.type = "throw";
	          record.arg = exception;
	          context.next = loc;

	          if (caught) {
	            // If the dispatched exception was caught by a catch block,
	            // then let that catch block handle the exception normally.
	            context.method = "next";
	            context.arg = undefined$1;
	          }

	          return !!caught;
	        }

	        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	          var entry = this.tryEntries[i];
	          var record = entry.completion;

	          if (entry.tryLoc === "root") {
	            // Exception thrown outside of any try block that could handle
	            // it, so set the completion value of the entire function to
	            // throw the exception.
	            return handle("end");
	          }

	          if (entry.tryLoc <= this.prev) {
	            var hasCatch = hasOwn.call(entry, "catchLoc");
	            var hasFinally = hasOwn.call(entry, "finallyLoc");

	            if (hasCatch && hasFinally) {
	              if (this.prev < entry.catchLoc) {
	                return handle(entry.catchLoc, true);
	              } else if (this.prev < entry.finallyLoc) {
	                return handle(entry.finallyLoc);
	              }
	            } else if (hasCatch) {
	              if (this.prev < entry.catchLoc) {
	                return handle(entry.catchLoc, true);
	              }
	            } else if (hasFinally) {
	              if (this.prev < entry.finallyLoc) {
	                return handle(entry.finallyLoc);
	              }
	            } else {
	              throw new Error("try statement without catch or finally");
	            }
	          }
	        }
	      },
	      abrupt: function (type, arg) {
	        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	          var entry = this.tryEntries[i];

	          if (entry.tryLoc <= this.prev && hasOwn.call(entry, "finallyLoc") && this.prev < entry.finallyLoc) {
	            var finallyEntry = entry;
	            break;
	          }
	        }

	        if (finallyEntry && (type === "break" || type === "continue") && finallyEntry.tryLoc <= arg && arg <= finallyEntry.finallyLoc) {
	          // Ignore the finally entry if control is not jumping to a
	          // location outside the try/catch block.
	          finallyEntry = null;
	        }

	        var record = finallyEntry ? finallyEntry.completion : {};
	        record.type = type;
	        record.arg = arg;

	        if (finallyEntry) {
	          this.method = "next";
	          this.next = finallyEntry.finallyLoc;
	          return ContinueSentinel;
	        }

	        return this.complete(record);
	      },
	      complete: function (record, afterLoc) {
	        if (record.type === "throw") {
	          throw record.arg;
	        }

	        if (record.type === "break" || record.type === "continue") {
	          this.next = record.arg;
	        } else if (record.type === "return") {
	          this.rval = this.arg = record.arg;
	          this.method = "return";
	          this.next = "end";
	        } else if (record.type === "normal" && afterLoc) {
	          this.next = afterLoc;
	        }

	        return ContinueSentinel;
	      },
	      finish: function (finallyLoc) {
	        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	          var entry = this.tryEntries[i];

	          if (entry.finallyLoc === finallyLoc) {
	            this.complete(entry.completion, entry.afterLoc);
	            resetTryEntry(entry);
	            return ContinueSentinel;
	          }
	        }
	      },
	      "catch": function (tryLoc) {
	        for (var i = this.tryEntries.length - 1; i >= 0; --i) {
	          var entry = this.tryEntries[i];

	          if (entry.tryLoc === tryLoc) {
	            var record = entry.completion;

	            if (record.type === "throw") {
	              var thrown = record.arg;
	              resetTryEntry(entry);
	            }

	            return thrown;
	          }
	        } // The context.catch method must only be called with a location
	        // argument that corresponds to a known catch block.


	        throw new Error("illegal catch attempt");
	      },
	      delegateYield: function (iterable, resultName, nextLoc) {
	        this.delegate = {
	          iterator: values(iterable),
	          resultName: resultName,
	          nextLoc: nextLoc
	        };

	        if (this.method === "next") {
	          // Deliberately forget the last sent value so that we don't
	          // accidentally pass it on to the delegate.
	          this.arg = undefined$1;
	        }

	        return ContinueSentinel;
	      }
	    }; // Regardless of whether this script is executing as a CommonJS module
	    // or not, return the runtime object so that we can declare the variable
	    // regeneratorRuntime in the outer scope, which allows this module to be
	    // injected easily by `bin/regenerator --include-runtime script.js`.

	    return exports;
	  }( // If this script is executing as a CommonJS module, use module.exports
	  // as the regeneratorRuntime namespace. Otherwise create a new empty
	  // object. Either way, the resulting object will be used to initialize
	  // the regeneratorRuntime variable at the top of this file.
	   module.exports );

	  try {
	    regeneratorRuntime = runtime;
	  } catch (accidentalStrictMode) {
	    // This module should not be running in strict mode, so the above
	    // assignment should always work unless something is misconfigured. Just
	    // in case runtime.js accidentally runs in strict mode, we can escape
	    // strict mode using a global Function call. This could conceivably fail
	    // if a Content Security Policy forbids using Function, but in that case
	    // the proper solution is to fix the accidental strict mode problem. If
	    // you've misconfigured your bundler to force strict mode and applied a
	    // CSP to forbid Function, and you're not willing to fix either of those
	    // problems, please detail your unique predicament in a GitHub issue.
	    Function("r", "regeneratorRuntime = r")(runtime);
	  }
	});

	var regenerator = runtime_1;

	function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
	  try {
	    var info = gen[key](arg);
	    var value = info.value;
	  } catch (error) {
	    reject(error);
	    return;
	  }

	  if (info.done) {
	    resolve(value);
	  } else {
	    Promise.resolve(value).then(_next, _throw);
	  }
	}

	function _asyncToGenerator(fn) {
	  return function () {
	    var self = this,
	        args = arguments;
	    return new Promise(function (resolve, reject) {
	      var gen = fn.apply(self, args);

	      function _next(value) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
	      }

	      function _throw(err) {
	        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
	      }

	      _next(undefined);
	    });
	  };
	}

	var asyncToGenerator = _asyncToGenerator;

	var _typeof_1 = createCommonjsModule(function (module) {
	  function _typeof(obj) {
	    "@babel/helpers - typeof";

	    if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") {
	      module.exports = _typeof = function _typeof(obj) {
	        return typeof obj;
	      };
	    } else {
	      module.exports = _typeof = function _typeof(obj) {
	        return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj;
	      };
	    }

	    return _typeof(obj);
	  }

	  module.exports = _typeof;
	});

	/*
	    LogUI Client Library
	    Helpers Module

	    A IIFE function containing several helper methods used throughout the rest of the LogUI client library.

	    @module: Helpers
	    @author: David Maxwell
	    @date: 2020-09-14
	*/
	var Helpers = (function (root) {
	  var _helpers = {};
	  _helpers.$ = root.document.querySelector.bind(root.document);
	  _helpers.$$ = root.document.querySelectorAll.bind(root.document);

	  _helpers.console = function (messageStr) {
	    var currentState = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
	    var isWarning = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
	    var currentStateString = '';
	    var consoleFunction = console.log;

	    if (currentState) {
	      currentStateString = " (".concat(currentState, ")");
	    }

	    if (isWarning) {
	      consoleFunction = console.warn;
	    }

	    if (root.LogUI.Config.getConfigProperty('verbose') || isWarning) {
	      var timeDelta = new Date().getTime() - root.LogUI.Config.getInitTimestamp();

	      if (_typeof_1(messageStr) === 'object' && messageStr !== null) {
	        consoleFunction("LogUI".concat(currentStateString, " @ ").concat(timeDelta, "ms > Logged object below"));
	        consoleFunction(messageStr);
	        return;
	      }

	      consoleFunction("LogUI".concat(currentStateString, " @ ").concat(timeDelta, "ms > ").concat(messageStr));
	    }
	  };

	  _helpers.getElementDescendant = function (rootObject) {
	    var descendantString = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
	    var separator = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '.';

	    if (!descendantString || descendantString == []) {
	      return rootObject;
	    }

	    var descendantSplitArray = descendantString.split(separator);

	    while (descendantSplitArray.length && (rootObject = rootObject[descendantSplitArray.shift()])) {
	    }

	    return rootObject;
	  };

	  _helpers.extendObject = function (objectA, objectB) {
	    for (var key in objectB) {
	      if (objectB.hasOwnProperty(key)) {
	        objectA[key] = objectB[key];
	      }
	    }

	    return objectA;
	  };

	  return _helpers;
	})(window);

	var logUIdefaults = {
	  verbose: true,
	  // Whether LogUI dumps events to console.log() or not.
	  overrideEqualSpecificity: true,
	  // If an existing event has equal specificity to the event being proposed, do we replace it (true, default) or replace it (false)?
	  sessionUUID: null // The session UUID to be used (null means no previous UUID has been used).

	};

	/*
	    LogUI Client Library
	    Required Functionality Module

	    An IIFE function providing a list of required functionality.
	    Supports the addition of additional functionality for extensions.

	    @module: Required Functionality Module
	    @author: David Maxwell
	    @date: 2020-10-06
	*/
	var RequiredFeatures = (function () {
	  var _public = {};
	  var requiredFeatures = ['console', 'document', 'document.documentElement', 'document.querySelector', 'document.querySelectorAll', 'navigator', 'addEventListener', 'sessionStorage', 'MutationObserver', 'Number', 'WeakMap', 'Map', 'Date', 'Object'];

	  _public.getFeatures = function () {
	    return requiredFeatures;
	  };

	  _public.addFeature = function (feature) {
	    requiredFeatures.push(feature);
	  };

	  return _public;
	})();

	/*! https://mths.be/punycode v1.4.1 by @mathias */

	/** Highest positive signed 32-bit float value */
	var maxInt = 2147483647; // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */

	var base = 36;
	var tMin = 1;
	var tMax = 26;
	var skew = 38;
	var damp = 700;
	var initialBias = 72;
	var initialN = 128; // 0x80

	var delimiter = '-'; // '\x2D'
	var regexNonASCII = /[^\x20-\x7E]/; // unprintable ASCII chars + non-ASCII chars

	var regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g; // RFC 3490 separators

	/** Error messages */

	var errors = {
	  'overflow': 'Overflow: input needs wider integers to process',
	  'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
	  'invalid-input': 'Invalid input'
	};
	/** Convenience shortcuts */

	var baseMinusTMin = base - tMin;
	var floor = Math.floor;
	var stringFromCharCode = String.fromCharCode;
	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */

	function error(type) {
	  throw new RangeError(errors[type]);
	}
	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */


	function map(array, fn) {
	  var length = array.length;
	  var result = [];

	  while (length--) {
	    result[length] = fn(array[length]);
	  }

	  return result;
	}
	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */


	function mapDomain(string, fn) {
	  var parts = string.split('@');
	  var result = '';

	  if (parts.length > 1) {
	    // In email addresses, only the domain name should be punycoded. Leave
	    // the local part (i.e. everything up to `@`) intact.
	    result = parts[0] + '@';
	    string = parts[1];
	  } // Avoid `split(regex)` for IE8 compatibility. See #17.


	  string = string.replace(regexSeparators, '\x2E');
	  var labels = string.split('.');
	  var encoded = map(labels, fn).join('.');
	  return result + encoded;
	}
	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */


	function ucs2decode(string) {
	  var output = [],
	      counter = 0,
	      length = string.length,
	      value,
	      extra;

	  while (counter < length) {
	    value = string.charCodeAt(counter++);

	    if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
	      // high surrogate, and there is a next character
	      extra = string.charCodeAt(counter++);

	      if ((extra & 0xFC00) == 0xDC00) {
	        // low surrogate
	        output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
	      } else {
	        // unmatched surrogate; only append this code unit, in case the next
	        // code unit is the high surrogate of a surrogate pair
	        output.push(value);
	        counter--;
	      }
	    } else {
	      output.push(value);
	    }
	  }

	  return output;
	}
	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */


	function digitToBasic(digit, flag) {
	  //  0..25 map to ASCII a..z or A..Z
	  // 26..35 map to ASCII 0..9
	  return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}
	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */


	function adapt(delta, numPoints, firstTime) {
	  var k = 0;
	  delta = firstTime ? floor(delta / damp) : delta >> 1;
	  delta += floor(delta / numPoints);

	  for (;
	  /* no initialization */
	  delta > baseMinusTMin * tMax >> 1; k += base) {
	    delta = floor(delta / baseMinusTMin);
	  }

	  return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}
	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */

	function encode(input) {
	  var n,
	      delta,
	      handledCPCount,
	      basicLength,
	      bias,
	      j,
	      m,
	      q,
	      k,
	      t,
	      currentValue,
	      output = [],

	  /** `inputLength` will hold the number of code points in `input`. */
	  inputLength,

	  /** Cached calculation results */
	  handledCPCountPlusOne,
	      baseMinusT,
	      qMinusT; // Convert the input in UCS-2 to Unicode

	  input = ucs2decode(input); // Cache the length

	  inputLength = input.length; // Initialize the state

	  n = initialN;
	  delta = 0;
	  bias = initialBias; // Handle the basic code points

	  for (j = 0; j < inputLength; ++j) {
	    currentValue = input[j];

	    if (currentValue < 0x80) {
	      output.push(stringFromCharCode(currentValue));
	    }
	  }

	  handledCPCount = basicLength = output.length; // `handledCPCount` is the number of code points that have been handled;
	  // `basicLength` is the number of basic code points.
	  // Finish the basic string - if it is not empty - with a delimiter

	  if (basicLength) {
	    output.push(delimiter);
	  } // Main encoding loop:


	  while (handledCPCount < inputLength) {
	    // All non-basic code points < n have been handled already. Find the next
	    // larger one:
	    for (m = maxInt, j = 0; j < inputLength; ++j) {
	      currentValue = input[j];

	      if (currentValue >= n && currentValue < m) {
	        m = currentValue;
	      }
	    } // Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
	    // but guard against overflow


	    handledCPCountPlusOne = handledCPCount + 1;

	    if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
	      error('overflow');
	    }

	    delta += (m - n) * handledCPCountPlusOne;
	    n = m;

	    for (j = 0; j < inputLength; ++j) {
	      currentValue = input[j];

	      if (currentValue < n && ++delta > maxInt) {
	        error('overflow');
	      }

	      if (currentValue == n) {
	        // Represent delta as a generalized variable-length integer
	        for (q = delta, k = base;;
	        /* no condition */
	        k += base) {
	          t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;

	          if (q < t) {
	            break;
	          }

	          qMinusT = q - t;
	          baseMinusT = base - t;
	          output.push(stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0)));
	          q = floor(qMinusT / baseMinusT);
	        }

	        output.push(stringFromCharCode(digitToBasic(q, 0)));
	        bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
	        delta = 0;
	        ++handledCPCount;
	      }
	    }

	    ++delta;
	    ++n;
	  }

	  return output.join('');
	}
	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */

	function toASCII(input) {
	  return mapDomain(input, function (string) {
	    return regexNonASCII.test(string) ? 'xn--' + encode(string) : string;
	  });
	}

	// Copyright Joyent, Inc. and other Node contributors.
	function isNull(arg) {
	  return arg === null;
	}
	function isNullOrUndefined(arg) {
	  return arg == null;
	}
	function isString(arg) {
	  return typeof arg === 'string';
	}
	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.
	// If obj.hasOwnProperty has been overridden, then calling
	// obj.hasOwnProperty(prop) will break.
	// See: https://github.com/joyent/node/issues/1707
	function hasOwnProperty(obj, prop) {
	  return Object.prototype.hasOwnProperty.call(obj, prop);
	}

	var isArray = Array.isArray || function (xs) {
	  return Object.prototype.toString.call(xs) === '[object Array]';
	};

	function stringifyPrimitive(v) {
	  switch (typeof v) {
	    case 'string':
	      return v;

	    case 'boolean':
	      return v ? 'true' : 'false';

	    case 'number':
	      return isFinite(v) ? v : '';

	    default:
	      return '';
	  }
	}

	function stringify(obj, sep, eq, name) {
	  sep = sep || '&';
	  eq = eq || '=';

	  if (obj === null) {
	    obj = undefined;
	  }

	  if (typeof obj === 'object') {
	    return map$1(objectKeys(obj), function (k) {
	      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;

	      if (isArray(obj[k])) {
	        return map$1(obj[k], function (v) {
	          return ks + encodeURIComponent(stringifyPrimitive(v));
	        }).join(sep);
	      } else {
	        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
	      }
	    }).join(sep);
	  }

	  if (!name) return '';
	  return encodeURIComponent(stringifyPrimitive(name)) + eq + encodeURIComponent(stringifyPrimitive(obj));
	}

	function map$1(xs, f) {
	  if (xs.map) return xs.map(f);
	  var res = [];

	  for (var i = 0; i < xs.length; i++) {
	    res.push(f(xs[i], i));
	  }

	  return res;
	}

	var objectKeys = Object.keys || function (obj) {
	  var res = [];

	  for (var key in obj) {
	    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
	  }

	  return res;
	};

	function parse(qs, sep, eq, options) {
	  sep = sep || '&';
	  eq = eq || '=';
	  var obj = {};

	  if (typeof qs !== 'string' || qs.length === 0) {
	    return obj;
	  }

	  var regexp = /\+/g;
	  qs = qs.split(sep);
	  var maxKeys = 1000;

	  if (options && typeof options.maxKeys === 'number') {
	    maxKeys = options.maxKeys;
	  }

	  var len = qs.length; // maxKeys <= 0 means that we should not limit keys count

	  if (maxKeys > 0 && len > maxKeys) {
	    len = maxKeys;
	  }

	  for (var i = 0; i < len; ++i) {
	    var x = qs[i].replace(regexp, '%20'),
	        idx = x.indexOf(eq),
	        kstr,
	        vstr,
	        k,
	        v;

	    if (idx >= 0) {
	      kstr = x.substr(0, idx);
	      vstr = x.substr(idx + 1);
	    } else {
	      kstr = x;
	      vstr = '';
	    }

	    k = decodeURIComponent(kstr);
	    v = decodeURIComponent(vstr);

	    if (!hasOwnProperty(obj, k)) {
	      obj[k] = v;
	    } else if (isArray(obj[k])) {
	      obj[k].push(v);
	    } else {
	      obj[k] = [obj[k], v];
	    }
	  }

	  return obj;
	}

	// Copyright Joyent, Inc. and other Node contributors.
	var urilib = {
	  parse: urlParse,
	  resolve: urlResolve,
	  resolveObject: urlResolveObject,
	  format: urlFormat,
	  Url: Url
	};
	function Url() {
	  this.protocol = null;
	  this.slashes = null;
	  this.auth = null;
	  this.host = null;
	  this.port = null;
	  this.hostname = null;
	  this.hash = null;
	  this.search = null;
	  this.query = null;
	  this.pathname = null;
	  this.path = null;
	  this.href = null;
	} // Reference: RFC 3986, RFC 1808, RFC 2396
	// define these here so at least they only have to be
	// compiled once on the first module load.

	var protocolPattern = /^([a-z0-9.+-]+:)/i,
	    portPattern = /:[0-9]*$/,
	    // Special case for a simple path URL
	simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,
	    // RFC 2396: characters reserved for delimiting URLs.
	// We actually just auto-escape these.
	delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],
	    // RFC 2396: characters not allowed for various reasons.
	unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),
	    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
	autoEscape = ['\''].concat(unwise),
	    // Characters that are never ever allowed in a hostname.
	// Note that any invalid chars are also handled, but these
	// are the ones that are *expected* to be seen, so we fast-path
	// them.
	nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
	    hostEndingChars = ['/', '?', '#'],
	    hostnameMaxLen = 255,
	    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
	    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
	    // protocols that can allow "unsafe" and "unwise" chars.
	unsafeProtocol = {
	  'javascript': true,
	  'javascript:': true
	},
	    // protocols that never have a hostname.
	hostlessProtocol = {
	  'javascript': true,
	  'javascript:': true
	},
	    // protocols that always contain a // bit.
	slashedProtocol = {
	  'http': true,
	  'https': true,
	  'ftp': true,
	  'gopher': true,
	  'file': true,
	  'http:': true,
	  'https:': true,
	  'ftp:': true,
	  'gopher:': true,
	  'file:': true
	};

	function urlParse(url, parseQueryString, slashesDenoteHost) {
	  if (url && isObject(url) && url instanceof Url) return url;
	  var u = new Url();
	  u.parse(url, parseQueryString, slashesDenoteHost);
	  return u;
	}

	Url.prototype.parse = function (url, parseQueryString, slashesDenoteHost) {
	  return parse$1(this, url, parseQueryString, slashesDenoteHost);
	};

	function parse$1(self, url, parseQueryString, slashesDenoteHost) {
	  if (!isString(url)) {
	    throw new TypeError('Parameter \'url\' must be a string, not ' + typeof url);
	  } // Copy chrome, IE, opera backslash-handling behavior.
	  // Back slashes before the query string get converted to forward slashes
	  // See: https://code.google.com/p/chromium/issues/detail?id=25916


	  var queryIndex = url.indexOf('?'),
	      splitter = queryIndex !== -1 && queryIndex < url.indexOf('#') ? '?' : '#',
	      uSplit = url.split(splitter),
	      slashRegex = /\\/g;
	  uSplit[0] = uSplit[0].replace(slashRegex, '/');
	  url = uSplit.join(splitter);
	  var rest = url; // trim before proceeding.
	  // This is to support parse stuff like "  http://foo.com  \n"

	  rest = rest.trim();

	  if (!slashesDenoteHost && url.split('#').length === 1) {
	    // Try fast path regexp
	    var simplePath = simplePathPattern.exec(rest);

	    if (simplePath) {
	      self.path = rest;
	      self.href = rest;
	      self.pathname = simplePath[1];

	      if (simplePath[2]) {
	        self.search = simplePath[2];

	        if (parseQueryString) {
	          self.query = parse(self.search.substr(1));
	        } else {
	          self.query = self.search.substr(1);
	        }
	      } else if (parseQueryString) {
	        self.search = '';
	        self.query = {};
	      }

	      return self;
	    }
	  }

	  var proto = protocolPattern.exec(rest);

	  if (proto) {
	    proto = proto[0];
	    var lowerProto = proto.toLowerCase();
	    self.protocol = lowerProto;
	    rest = rest.substr(proto.length);
	  } // figure out if it's got a host
	  // user@server is *always* interpreted as a hostname, and url
	  // resolution will treat //foo/bar as host=foo,path=bar because that's
	  // how the browser resolves relative URLs.


	  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
	    var slashes = rest.substr(0, 2) === '//';

	    if (slashes && !(proto && hostlessProtocol[proto])) {
	      rest = rest.substr(2);
	      self.slashes = true;
	    }
	  }

	  var i, hec, l, p;

	  if (!hostlessProtocol[proto] && (slashes || proto && !slashedProtocol[proto])) {
	    // there's a hostname.
	    // the first instance of /, ?, ;, or # ends the host.
	    //
	    // If there is an @ in the hostname, then non-host chars *are* allowed
	    // to the left of the last @ sign, unless some host-ending character
	    // comes *before* the @-sign.
	    // URLs are obnoxious.
	    //
	    // ex:
	    // http://a@b@c/ => user:a@b host:c
	    // http://a@b?@c => user:a host:c path:/?@c
	    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
	    // Review our test case against browsers more comprehensively.
	    // find the first instance of any hostEndingChars
	    var hostEnd = -1;

	    for (i = 0; i < hostEndingChars.length; i++) {
	      hec = rest.indexOf(hostEndingChars[i]);
	      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) hostEnd = hec;
	    } // at this point, either we have an explicit point where the
	    // auth portion cannot go past, or the last @ char is the decider.


	    var auth, atSign;

	    if (hostEnd === -1) {
	      // atSign can be anywhere.
	      atSign = rest.lastIndexOf('@');
	    } else {
	      // atSign must be in auth portion.
	      // http://a@b/c@d => host:b auth:a path:/c@d
	      atSign = rest.lastIndexOf('@', hostEnd);
	    } // Now we have a portion which is definitely the auth.
	    // Pull that off.


	    if (atSign !== -1) {
	      auth = rest.slice(0, atSign);
	      rest = rest.slice(atSign + 1);
	      self.auth = decodeURIComponent(auth);
	    } // the host is the remaining to the left of the first non-host char


	    hostEnd = -1;

	    for (i = 0; i < nonHostChars.length; i++) {
	      hec = rest.indexOf(nonHostChars[i]);
	      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) hostEnd = hec;
	    } // if we still have not hit it, then the entire thing is a host.


	    if (hostEnd === -1) hostEnd = rest.length;
	    self.host = rest.slice(0, hostEnd);
	    rest = rest.slice(hostEnd); // pull out port.

	    parseHost(self); // we've indicated that there is a hostname,
	    // so even if it's empty, it has to be present.

	    self.hostname = self.hostname || ''; // if hostname begins with [ and ends with ]
	    // assume that it's an IPv6 address.

	    var ipv6Hostname = self.hostname[0] === '[' && self.hostname[self.hostname.length - 1] === ']'; // validate a little.

	    if (!ipv6Hostname) {
	      var hostparts = self.hostname.split(/\./);

	      for (i = 0, l = hostparts.length; i < l; i++) {
	        var part = hostparts[i];
	        if (!part) continue;

	        if (!part.match(hostnamePartPattern)) {
	          var newpart = '';

	          for (var j = 0, k = part.length; j < k; j++) {
	            if (part.charCodeAt(j) > 127) {
	              // we replace non-ASCII char with a temporary placeholder
	              // we need this to make sure size of hostname is not
	              // broken by replacing non-ASCII by nothing
	              newpart += 'x';
	            } else {
	              newpart += part[j];
	            }
	          } // we test again with ASCII char only


	          if (!newpart.match(hostnamePartPattern)) {
	            var validParts = hostparts.slice(0, i);
	            var notHost = hostparts.slice(i + 1);
	            var bit = part.match(hostnamePartStart);

	            if (bit) {
	              validParts.push(bit[1]);
	              notHost.unshift(bit[2]);
	            }

	            if (notHost.length) {
	              rest = '/' + notHost.join('.') + rest;
	            }

	            self.hostname = validParts.join('.');
	            break;
	          }
	        }
	      }
	    }

	    if (self.hostname.length > hostnameMaxLen) {
	      self.hostname = '';
	    } else {
	      // hostnames are always lower case.
	      self.hostname = self.hostname.toLowerCase();
	    }

	    if (!ipv6Hostname) {
	      // IDNA Support: Returns a punycoded representation of "domain".
	      // It only converts parts of the domain name that
	      // have non-ASCII characters, i.e. it doesn't matter if
	      // you call it with a domain that already is ASCII-only.
	      self.hostname = toASCII(self.hostname);
	    }

	    p = self.port ? ':' + self.port : '';
	    var h = self.hostname || '';
	    self.host = h + p;
	    self.href += self.host; // strip [ and ] from the hostname
	    // the host field still retains them, though

	    if (ipv6Hostname) {
	      self.hostname = self.hostname.substr(1, self.hostname.length - 2);

	      if (rest[0] !== '/') {
	        rest = '/' + rest;
	      }
	    }
	  } // now rest is set to the post-host stuff.
	  // chop off any delim chars.


	  if (!unsafeProtocol[lowerProto]) {
	    // First, make 100% sure that any "autoEscape" chars get
	    // escaped, even if encodeURIComponent doesn't think they
	    // need to be.
	    for (i = 0, l = autoEscape.length; i < l; i++) {
	      var ae = autoEscape[i];
	      if (rest.indexOf(ae) === -1) continue;
	      var esc = encodeURIComponent(ae);

	      if (esc === ae) {
	        esc = escape(ae);
	      }

	      rest = rest.split(ae).join(esc);
	    }
	  } // chop off from the tail first.


	  var hash = rest.indexOf('#');

	  if (hash !== -1) {
	    // got a fragment string.
	    self.hash = rest.substr(hash);
	    rest = rest.slice(0, hash);
	  }

	  var qm = rest.indexOf('?');

	  if (qm !== -1) {
	    self.search = rest.substr(qm);
	    self.query = rest.substr(qm + 1);

	    if (parseQueryString) {
	      self.query = parse(self.query);
	    }

	    rest = rest.slice(0, qm);
	  } else if (parseQueryString) {
	    // no query string, but parseQueryString still requested
	    self.search = '';
	    self.query = {};
	  }

	  if (rest) self.pathname = rest;

	  if (slashedProtocol[lowerProto] && self.hostname && !self.pathname) {
	    self.pathname = '/';
	  } //to support http.request


	  if (self.pathname || self.search) {
	    p = self.pathname || '';
	    var s = self.search || '';
	    self.path = p + s;
	  } // finally, reconstruct the href based on what has been validated.


	  self.href = format(self);
	  return self;
	} // format a parsed object into a url string


	function urlFormat(obj) {
	  // ensure it's an object, and not a string url.
	  // If it's an obj, this is a no-op.
	  // this way, you can call url_format() on strings
	  // to clean up potentially wonky urls.
	  if (isString(obj)) obj = parse$1({}, obj);
	  return format(obj);
	}

	function format(self) {
	  var auth = self.auth || '';

	  if (auth) {
	    auth = encodeURIComponent(auth);
	    auth = auth.replace(/%3A/i, ':');
	    auth += '@';
	  }

	  var protocol = self.protocol || '',
	      pathname = self.pathname || '',
	      hash = self.hash || '',
	      host = false,
	      query = '';

	  if (self.host) {
	    host = auth + self.host;
	  } else if (self.hostname) {
	    host = auth + (self.hostname.indexOf(':') === -1 ? self.hostname : '[' + this.hostname + ']');

	    if (self.port) {
	      host += ':' + self.port;
	    }
	  }

	  if (self.query && isObject(self.query) && Object.keys(self.query).length) {
	    query = stringify(self.query);
	  }

	  var search = self.search || query && '?' + query || '';
	  if (protocol && protocol.substr(-1) !== ':') protocol += ':'; // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
	  // unless they had them to begin with.

	  if (self.slashes || (!protocol || slashedProtocol[protocol]) && host !== false) {
	    host = '//' + (host || '');
	    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
	  } else if (!host) {
	    host = '';
	  }

	  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
	  if (search && search.charAt(0) !== '?') search = '?' + search;
	  pathname = pathname.replace(/[?#]/g, function (match) {
	    return encodeURIComponent(match);
	  });
	  search = search.replace('#', '%23');
	  return protocol + host + pathname + search + hash;
	}

	Url.prototype.format = function () {
	  return format(this);
	};

	function urlResolve(source, relative) {
	  return urlParse(source, false, true).resolve(relative);
	}

	Url.prototype.resolve = function (relative) {
	  return this.resolveObject(urlParse(relative, false, true)).format();
	};

	function urlResolveObject(source, relative) {
	  if (!source) return relative;
	  return urlParse(source, false, true).resolveObject(relative);
	}

	Url.prototype.resolveObject = function (relative) {
	  if (isString(relative)) {
	    var rel = new Url();
	    rel.parse(relative, false, true);
	    relative = rel;
	  }

	  var result = new Url();
	  var tkeys = Object.keys(this);

	  for (var tk = 0; tk < tkeys.length; tk++) {
	    var tkey = tkeys[tk];
	    result[tkey] = this[tkey];
	  } // hash is always overridden, no matter what.
	  // even href="" will remove it.


	  result.hash = relative.hash; // if the relative url is empty, then there's nothing left to do here.

	  if (relative.href === '') {
	    result.href = result.format();
	    return result;
	  } // hrefs like //foo/bar always cut to the protocol.


	  if (relative.slashes && !relative.protocol) {
	    // take everything except the protocol from relative
	    var rkeys = Object.keys(relative);

	    for (var rk = 0; rk < rkeys.length; rk++) {
	      var rkey = rkeys[rk];
	      if (rkey !== 'protocol') result[rkey] = relative[rkey];
	    } //urlParse appends trailing / to urls like http://www.example.com


	    if (slashedProtocol[result.protocol] && result.hostname && !result.pathname) {
	      result.path = result.pathname = '/';
	    }

	    result.href = result.format();
	    return result;
	  }

	  var relPath;

	  if (relative.protocol && relative.protocol !== result.protocol) {
	    // if it's a known url protocol, then changing
	    // the protocol does weird things
	    // first, if it's not file:, then we MUST have a host,
	    // and if there was a path
	    // to begin with, then we MUST have a path.
	    // if it is file:, then the host is dropped,
	    // because that's known to be hostless.
	    // anything else is assumed to be absolute.
	    if (!slashedProtocol[relative.protocol]) {
	      var keys = Object.keys(relative);

	      for (var v = 0; v < keys.length; v++) {
	        var k = keys[v];
	        result[k] = relative[k];
	      }

	      result.href = result.format();
	      return result;
	    }

	    result.protocol = relative.protocol;

	    if (!relative.host && !hostlessProtocol[relative.protocol]) {
	      relPath = (relative.pathname || '').split('/');

	      while (relPath.length && !(relative.host = relPath.shift()));

	      if (!relative.host) relative.host = '';
	      if (!relative.hostname) relative.hostname = '';
	      if (relPath[0] !== '') relPath.unshift('');
	      if (relPath.length < 2) relPath.unshift('');
	      result.pathname = relPath.join('/');
	    } else {
	      result.pathname = relative.pathname;
	    }

	    result.search = relative.search;
	    result.query = relative.query;
	    result.host = relative.host || '';
	    result.auth = relative.auth;
	    result.hostname = relative.hostname || relative.host;
	    result.port = relative.port; // to support http.request

	    if (result.pathname || result.search) {
	      var p = result.pathname || '';
	      var s = result.search || '';
	      result.path = p + s;
	    }

	    result.slashes = result.slashes || relative.slashes;
	    result.href = result.format();
	    return result;
	  }

	  var isSourceAbs = result.pathname && result.pathname.charAt(0) === '/',
	      isRelAbs = relative.host || relative.pathname && relative.pathname.charAt(0) === '/',
	      mustEndAbs = isRelAbs || isSourceAbs || result.host && relative.pathname,
	      removeAllDots = mustEndAbs,
	      srcPath = result.pathname && result.pathname.split('/') || [],
	      psychotic = result.protocol && !slashedProtocol[result.protocol];
	  relPath = relative.pathname && relative.pathname.split('/') || []; // if the url is a non-slashed url, then relative
	  // links like ../.. should be able
	  // to crawl up to the hostname, as well.  This is strange.
	  // result.protocol has already been set by now.
	  // Later on, put the first path part into the host field.

	  if (psychotic) {
	    result.hostname = '';
	    result.port = null;

	    if (result.host) {
	      if (srcPath[0] === '') srcPath[0] = result.host;else srcPath.unshift(result.host);
	    }

	    result.host = '';

	    if (relative.protocol) {
	      relative.hostname = null;
	      relative.port = null;

	      if (relative.host) {
	        if (relPath[0] === '') relPath[0] = relative.host;else relPath.unshift(relative.host);
	      }

	      relative.host = null;
	    }

	    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
	  }

	  var authInHost;

	  if (isRelAbs) {
	    // it's absolute.
	    result.host = relative.host || relative.host === '' ? relative.host : result.host;
	    result.hostname = relative.hostname || relative.hostname === '' ? relative.hostname : result.hostname;
	    result.search = relative.search;
	    result.query = relative.query;
	    srcPath = relPath; // fall through to the dot-handling below.
	  } else if (relPath.length) {
	    // it's relative
	    // throw away the existing file, and take the new path instead.
	    if (!srcPath) srcPath = [];
	    srcPath.pop();
	    srcPath = srcPath.concat(relPath);
	    result.search = relative.search;
	    result.query = relative.query;
	  } else if (!isNullOrUndefined(relative.search)) {
	    // just pull out the search.
	    // like href='?foo'.
	    // Put this after the other two cases because it simplifies the booleans
	    if (psychotic) {
	      result.hostname = result.host = srcPath.shift(); //occationaly the auth can get stuck only in host
	      //this especially happens in cases like
	      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')

	      authInHost = result.host && result.host.indexOf('@') > 0 ? result.host.split('@') : false;

	      if (authInHost) {
	        result.auth = authInHost.shift();
	        result.host = result.hostname = authInHost.shift();
	      }
	    }

	    result.search = relative.search;
	    result.query = relative.query; //to support http.request

	    if (!isNull(result.pathname) || !isNull(result.search)) {
	      result.path = (result.pathname ? result.pathname : '') + (result.search ? result.search : '');
	    }

	    result.href = result.format();
	    return result;
	  }

	  if (!srcPath.length) {
	    // no path at all.  easy.
	    // we've already handled the other stuff above.
	    result.pathname = null; //to support http.request

	    if (result.search) {
	      result.path = '/' + result.search;
	    } else {
	      result.path = null;
	    }

	    result.href = result.format();
	    return result;
	  } // if a url ENDs in . or .., then it must get a trailing slash.
	  // however, if it ends in anything else non-slashy,
	  // then it must NOT get a trailing slash.


	  var last = srcPath.slice(-1)[0];
	  var hasTrailingSlash = (result.host || relative.host || srcPath.length > 1) && (last === '.' || last === '..') || last === ''; // strip single dots, resolve double dots to parent dir
	  // if the path tries to go above the root, `up` ends up > 0

	  var up = 0;

	  for (var i = srcPath.length; i >= 0; i--) {
	    last = srcPath[i];

	    if (last === '.') {
	      srcPath.splice(i, 1);
	    } else if (last === '..') {
	      srcPath.splice(i, 1);
	      up++;
	    } else if (up) {
	      srcPath.splice(i, 1);
	      up--;
	    }
	  } // if the path is allowed to go above the root, restore leading ..s


	  if (!mustEndAbs && !removeAllDots) {
	    for (; up--; up) {
	      srcPath.unshift('..');
	    }
	  }

	  if (mustEndAbs && srcPath[0] !== '' && (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
	    srcPath.unshift('');
	  }

	  if (hasTrailingSlash && srcPath.join('/').substr(-1) !== '/') {
	    srcPath.push('');
	  }

	  var isAbsolute = srcPath[0] === '' || srcPath[0] && srcPath[0].charAt(0) === '/'; // put the host back

	  if (psychotic) {
	    result.hostname = result.host = isAbsolute ? '' : srcPath.length ? srcPath.shift() : ''; //occationaly the auth can get stuck only in host
	    //this especially happens in cases like
	    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')

	    authInHost = result.host && result.host.indexOf('@') > 0 ? result.host.split('@') : false;

	    if (authInHost) {
	      result.auth = authInHost.shift();
	      result.host = result.hostname = authInHost.shift();
	    }
	  }

	  mustEndAbs = mustEndAbs || result.host && srcPath.length;

	  if (mustEndAbs && !isAbsolute) {
	    srcPath.unshift('');
	  }

	  if (!srcPath.length) {
	    result.pathname = null;
	    result.path = null;
	  } else {
	    result.pathname = srcPath.join('/');
	  } //to support request.http


	  if (!isNull(result.pathname) || !isNull(result.search)) {
	    result.path = (result.pathname ? result.pathname : '') + (result.search ? result.search : '');
	  }

	  result.auth = relative.auth || result.auth;
	  result.slashes = result.slashes || relative.slashes;
	  result.href = result.format();
	  return result;
	};

	Url.prototype.parseHost = function () {
	  return parseHost(this);
	};

	function parseHost(self) {
	  var host = self.host;
	  var port = portPattern.exec(host);

	  if (port) {
	    port = port[0];

	    if (port !== ':') {
	      self.port = port.substr(1);
	    }

	    host = host.substr(0, host.length - port.length);
	  }

	  if (host) self.hostname = host;
	}

	var helpers = createCommonjsModule(function (module, exports) {

	  var ValidationError = exports.ValidationError = function ValidationError(message, instance, schema, propertyPath, name, argument) {
	    if (propertyPath) {
	      this.property = propertyPath;
	    }

	    if (message) {
	      this.message = message;
	    }

	    if (schema) {
	      if (schema.id) {
	        this.schema = schema.id;
	      } else {
	        this.schema = schema;
	      }
	    }

	    if (instance) {
	      this.instance = instance;
	    }

	    this.name = name;
	    this.argument = argument;
	    this.stack = this.toString();
	  };

	  ValidationError.prototype.toString = function toString() {
	    return this.property + ' ' + this.message;
	  };

	  var ValidatorResult = exports.ValidatorResult = function ValidatorResult(instance, schema, options, ctx) {
	    this.instance = instance;
	    this.schema = schema;
	    this.propertyPath = ctx.propertyPath;
	    this.errors = [];
	    this.throwError = options && options.throwError;
	    this.disableFormat = options && options.disableFormat === true;
	  };

	  ValidatorResult.prototype.addError = function addError(detail) {
	    var err;

	    if (typeof detail == 'string') {
	      err = new ValidationError(detail, this.instance, this.schema, this.propertyPath);
	    } else {
	      if (!detail) throw new Error('Missing error detail');
	      if (!detail.message) throw new Error('Missing error message');
	      if (!detail.name) throw new Error('Missing validator type');
	      err = new ValidationError(detail.message, this.instance, this.schema, this.propertyPath, detail.name, detail.argument);
	    }

	    if (this.throwError) {
	      throw err;
	    }

	    this.errors.push(err);
	    return err;
	  };

	  ValidatorResult.prototype.importErrors = function importErrors(res) {
	    if (typeof res == 'string' || res && res.validatorType) {
	      this.addError(res);
	    } else if (res && res.errors) {
	      Array.prototype.push.apply(this.errors, res.errors);
	    }
	  };

	  function stringizer(v, i) {
	    return i + ': ' + v.toString() + '\n';
	  }

	  ValidatorResult.prototype.toString = function toString(res) {
	    return this.errors.map(stringizer).join('');
	  };

	  Object.defineProperty(ValidatorResult.prototype, "valid", {
	    get: function () {
	      return !this.errors.length;
	    }
	  });
	  /**
	   * Describes a problem with a Schema which prevents validation of an instance
	   * @name SchemaError
	   * @constructor
	   */

	  var SchemaError = exports.SchemaError = function SchemaError(msg, schema) {
	    this.message = msg;
	    this.schema = schema;
	    Error.call(this, msg);
	    Error.captureStackTrace(this, SchemaError);
	  };

	  SchemaError.prototype = Object.create(Error.prototype, {
	    constructor: {
	      value: SchemaError,
	      enumerable: false
	    },
	    name: {
	      value: 'SchemaError',
	      enumerable: false
	    }
	  });

	  var SchemaContext = exports.SchemaContext = function SchemaContext(schema, options, propertyPath, base, schemas) {
	    this.schema = schema;
	    this.options = options;
	    this.propertyPath = propertyPath;
	    this.base = base;
	    this.schemas = schemas;
	  };

	  SchemaContext.prototype.resolve = function resolve(target) {
	    return urilib.resolve(this.base, target);
	  };

	  SchemaContext.prototype.makeChild = function makeChild(schema, propertyName) {
	    var propertyPath = propertyName === undefined ? this.propertyPath : this.propertyPath + makeSuffix(propertyName);
	    var base = urilib.resolve(this.base, schema.id || '');
	    var ctx = new SchemaContext(schema, this.options, propertyPath, base, Object.create(this.schemas));

	    if (schema.id && !ctx.schemas[base]) {
	      ctx.schemas[base] = schema;
	    }

	    return ctx;
	  };

	  var FORMAT_REGEXPS = exports.FORMAT_REGEXPS = {
	    'date-time': /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-(3[01]|0[1-9]|[12][0-9])[tT ](2[0-4]|[01][0-9]):([0-5][0-9]):(60|[0-5][0-9])(\.\d+)?([zZ]|[+-]([0-5][0-9]):(60|[0-5][0-9]))$/,
	    'date': /^\d{4}-(?:0[0-9]{1}|1[0-2]{1})-(3[01]|0[1-9]|[12][0-9])$/,
	    'time': /^(2[0-4]|[01][0-9]):([0-5][0-9]):(60|[0-5][0-9])$/,
	    'email': /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/,
	    'ip-address': /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
	    'ipv6': /^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/,
	    'uri': /^[a-zA-Z][a-zA-Z0-9+-.]*:[^\s]*$/,
	    'color': /^(#?([0-9A-Fa-f]{3}){1,2}\b|aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|orange|purple|red|silver|teal|white|yellow|(rgb\(\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*,\s*\b([0-9]|[1-9][0-9]|1[0-9][0-9]|2[0-4][0-9]|25[0-5])\b\s*\))|(rgb\(\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*,\s*(\d?\d%|100%)+\s*\)))$/,
	    // hostname regex from: http://stackoverflow.com/a/1420225/5628
	    'hostname': /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/,
	    'host-name': /^(?=.{1,255}$)[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?(?:\.[0-9A-Za-z](?:(?:[0-9A-Za-z]|-){0,61}[0-9A-Za-z])?)*\.?$/,
	    'alpha': /^[a-zA-Z]+$/,
	    'alphanumeric': /^[a-zA-Z0-9]+$/,
	    'utc-millisec': function (input) {
	      return typeof input === 'string' && parseFloat(input) === parseInt(input, 10) && !isNaN(input);
	    },
	    'regex': function (input) {
	      var result = true;

	      try {
	        new RegExp(input);
	      } catch (e) {
	        result = false;
	      }

	      return result;
	    },
	    'style': /\s*(.+?):\s*([^;]+);?/,
	    'phone': /^\+(?:[0-9] ?){6,14}[0-9]$/
	  };
	  FORMAT_REGEXPS.regexp = FORMAT_REGEXPS.regex;
	  FORMAT_REGEXPS.pattern = FORMAT_REGEXPS.regex;
	  FORMAT_REGEXPS.ipv4 = FORMAT_REGEXPS['ip-address'];

	  exports.isFormat = function isFormat(input, format, validator) {
	    if (typeof input === 'string' && FORMAT_REGEXPS[format] !== undefined) {
	      if (FORMAT_REGEXPS[format] instanceof RegExp) {
	        return FORMAT_REGEXPS[format].test(input);
	      }

	      if (typeof FORMAT_REGEXPS[format] === 'function') {
	        return FORMAT_REGEXPS[format](input);
	      }
	    } else if (validator && validator.customFormats && typeof validator.customFormats[format] === 'function') {
	      return validator.customFormats[format](input);
	    }

	    return true;
	  };

	  var makeSuffix = exports.makeSuffix = function makeSuffix(key) {
	    key = key.toString(); // This function could be capable of outputting valid a ECMAScript string, but the
	    // resulting code for testing which form to use would be tens of thousands of characters long
	    // That means this will use the name form for some illegal forms

	    if (!key.match(/[.\s\[\]]/) && !key.match(/^[\d]/)) {
	      return '.' + key;
	    }

	    if (key.match(/^\d+$/)) {
	      return '[' + key + ']';
	    }

	    return '[' + JSON.stringify(key) + ']';
	  };

	  exports.deepCompareStrict = function deepCompareStrict(a, b) {
	    if (typeof a !== typeof b) {
	      return false;
	    }

	    if (Array.isArray(a)) {
	      if (!Array.isArray(b)) {
	        return false;
	      }

	      if (a.length !== b.length) {
	        return false;
	      }

	      return a.every(function (v, i) {
	        return deepCompareStrict(a[i], b[i]);
	      });
	    }

	    if (typeof a === 'object') {
	      if (!a || !b) {
	        return a === b;
	      }

	      var aKeys = Object.keys(a);
	      var bKeys = Object.keys(b);

	      if (aKeys.length !== bKeys.length) {
	        return false;
	      }

	      return aKeys.every(function (v) {
	        return deepCompareStrict(a[v], b[v]);
	      });
	    }

	    return a === b;
	  };

	  function deepMerger(target, dst, e, i) {
	    if (typeof e === 'object') {
	      dst[i] = deepMerge(target[i], e);
	    } else {
	      if (target.indexOf(e) === -1) {
	        dst.push(e);
	      }
	    }
	  }

	  function copyist(src, dst, key) {
	    dst[key] = src[key];
	  }

	  function copyistWithDeepMerge(target, src, dst, key) {
	    if (typeof src[key] !== 'object' || !src[key]) {
	      dst[key] = src[key];
	    } else {
	      if (!target[key]) {
	        dst[key] = src[key];
	      } else {
	        dst[key] = deepMerge(target[key], src[key]);
	      }
	    }
	  }

	  function deepMerge(target, src) {
	    var array = Array.isArray(src);
	    var dst = array && [] || {};

	    if (array) {
	      target = target || [];
	      dst = dst.concat(target);
	      src.forEach(deepMerger.bind(null, target, dst));
	    } else {
	      if (target && typeof target === 'object') {
	        Object.keys(target).forEach(copyist.bind(null, target, dst));
	      }

	      Object.keys(src).forEach(copyistWithDeepMerge.bind(null, target, src, dst));
	    }

	    return dst;
	  }
	  module.exports.deepMerge = deepMerge;
	  /**
	   * Validates instance against the provided schema
	   * Implements URI+JSON Pointer encoding, e.g. "%7e"="~0"=>"~", "~1"="%2f"=>"/"
	   * @param o
	   * @param s The path to walk o along
	   * @return any
	   */

	  exports.objectGetPath = function objectGetPath(o, s) {
	    var parts = s.split('/').slice(1);
	    var k;

	    while (typeof (k = parts.shift()) == 'string') {
	      var n = decodeURIComponent(k.replace(/~0/, '~').replace(/~1/g, '/'));
	      if (!(n in o)) return;
	      o = o[n];
	    }

	    return o;
	  };

	  function pathEncoder(v) {
	    return '/' + encodeURIComponent(v).replace(/~/g, '%7E');
	  }
	  /**
	   * Accept an Array of property names and return a JSON Pointer URI fragment
	   * @param Array a
	   * @return {String}
	   */


	  exports.encodePath = function encodePointer(a) {
	    // ~ must be encoded explicitly because hacks
	    // the slash is encoded by encodeURIComponent
	    return a.map(pathEncoder).join('');
	  };
	  /**
	   * Calculate the number of decimal places a number uses
	   * We need this to get correct results out of multipleOf and divisibleBy
	   * when either figure is has decimal places, due to IEEE-754 float issues.
	   * @param number
	   * @returns {number}
	   */


	  exports.getDecimalPlaces = function getDecimalPlaces(number) {
	    var decimalPlaces = 0;
	    if (isNaN(number)) return decimalPlaces;

	    if (typeof number !== 'number') {
	      number = Number(number);
	    }

	    var parts = number.toString().split('e');

	    if (parts.length === 2) {
	      if (parts[1][0] !== '-') {
	        return decimalPlaces;
	      } else {
	        decimalPlaces = Number(parts[1].slice(1));
	      }
	    }

	    var decimalParts = parts[0].split('.');

	    if (decimalParts.length === 2) {
	      decimalPlaces += decimalParts[1].length;
	    }

	    return decimalPlaces;
	  };
	});
	var helpers_1 = helpers.ValidationError;
	var helpers_2 = helpers.ValidatorResult;
	var helpers_3 = helpers.SchemaError;
	var helpers_4 = helpers.SchemaContext;
	var helpers_5 = helpers.FORMAT_REGEXPS;
	var helpers_6 = helpers.isFormat;
	var helpers_7 = helpers.makeSuffix;
	var helpers_8 = helpers.deepCompareStrict;
	var helpers_9 = helpers.deepMerge;
	var helpers_10 = helpers.objectGetPath;
	var helpers_11 = helpers.encodePath;
	var helpers_12 = helpers.getDecimalPlaces;

	/** @type ValidatorResult */


	var ValidatorResult = helpers.ValidatorResult;
	/** @type SchemaError */

	var SchemaError = helpers.SchemaError;
	var attribute = {};
	attribute.ignoreProperties = {
	  // informative properties
	  'id': true,
	  'default': true,
	  'description': true,
	  'title': true,
	  // arguments to other properties
	  'exclusiveMinimum': true,
	  'exclusiveMaximum': true,
	  'additionalItems': true,
	  // special-handled properties
	  '$schema': true,
	  '$ref': true,
	  'extends': true
	};
	/**
	 * @name validators
	 */

	var validators = attribute.validators = {};
	/**
	 * Validates whether the instance if of a certain type
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {ValidatorResult|null}
	 */

	validators.type = function validateType(instance, schema, options, ctx) {
	  // Ignore undefined instances
	  if (instance === undefined) {
	    return null;
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var types = Array.isArray(schema.type) ? schema.type : [schema.type];

	  if (!types.some(this.testType.bind(this, instance, schema, options, ctx))) {
	    var list = types.map(function (v) {
	      return v.id && '<' + v.id + '>' || v + '';
	    });
	    result.addError({
	      name: 'type',
	      argument: list,
	      message: "is not of a type(s) " + list
	    });
	  }

	  return result;
	};

	function testSchemaNoThrow(instance, options, ctx, callback, schema) {
	  var throwError = options.throwError;
	  options.throwError = false;
	  var res = this.validateSchema(instance, schema, options, ctx);
	  options.throwError = throwError;

	  if (!res.valid && callback instanceof Function) {
	    callback(res);
	  }

	  return res.valid;
	}
	/**
	 * Validates whether the instance matches some of the given schemas
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {ValidatorResult|null}
	 */


	validators.anyOf = function validateAnyOf(instance, schema, options, ctx) {
	  // Ignore undefined instances
	  if (instance === undefined) {
	    return null;
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var inner = new ValidatorResult(instance, schema, options, ctx);

	  if (!Array.isArray(schema.anyOf)) {
	    throw new SchemaError("anyOf must be an array");
	  }

	  if (!schema.anyOf.some(testSchemaNoThrow.bind(this, instance, options, ctx, function (res) {
	    inner.importErrors(res);
	  }))) {
	    var list = schema.anyOf.map(function (v, i) {
	      return v.id && '<' + v.id + '>' || v.title && JSON.stringify(v.title) || v['$ref'] && '<' + v['$ref'] + '>' || '[subschema ' + i + ']';
	    });

	    if (options.nestedErrors) {
	      result.importErrors(inner);
	    }

	    result.addError({
	      name: 'anyOf',
	      argument: list,
	      message: "is not any of " + list.join(',')
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance matches every given schema
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null}
	 */


	validators.allOf = function validateAllOf(instance, schema, options, ctx) {
	  // Ignore undefined instances
	  if (instance === undefined) {
	    return null;
	  }

	  if (!Array.isArray(schema.allOf)) {
	    throw new SchemaError("allOf must be an array");
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var self = this;
	  schema.allOf.forEach(function (v, i) {
	    var valid = self.validateSchema(instance, v, options, ctx);

	    if (!valid.valid) {
	      var msg = v.id && '<' + v.id + '>' || v.title && JSON.stringify(v.title) || v['$ref'] && '<' + v['$ref'] + '>' || '[subschema ' + i + ']';
	      result.addError({
	        name: 'allOf',
	        argument: {
	          id: msg,
	          length: valid.errors.length,
	          valid: valid
	        },
	        message: 'does not match allOf schema ' + msg + ' with ' + valid.errors.length + ' error[s]:'
	      });
	      result.importErrors(valid);
	    }
	  });
	  return result;
	};
	/**
	 * Validates whether the instance matches exactly one of the given schemas
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null}
	 */


	validators.oneOf = function validateOneOf(instance, schema, options, ctx) {
	  // Ignore undefined instances
	  if (instance === undefined) {
	    return null;
	  }

	  if (!Array.isArray(schema.oneOf)) {
	    throw new SchemaError("oneOf must be an array");
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var inner = new ValidatorResult(instance, schema, options, ctx);
	  var count = schema.oneOf.filter(testSchemaNoThrow.bind(this, instance, options, ctx, function (res) {
	    inner.importErrors(res);
	  })).length;
	  var list = schema.oneOf.map(function (v, i) {
	    return v.id && '<' + v.id + '>' || v.title && JSON.stringify(v.title) || v['$ref'] && '<' + v['$ref'] + '>' || '[subschema ' + i + ']';
	  });

	  if (count !== 1) {
	    if (options.nestedErrors) {
	      result.importErrors(inner);
	    }

	    result.addError({
	      name: 'oneOf',
	      argument: list,
	      message: "is not exactly one from " + list.join(',')
	    });
	  }

	  return result;
	};
	/**
	 * Validates properties
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null|ValidatorResult}
	 */


	validators.properties = function validateProperties(instance, schema, options, ctx) {
	  if (!this.types.object(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var properties = schema.properties || {};

	  for (var property in properties) {
	    if (typeof options.preValidateProperty == 'function') {
	      options.preValidateProperty(instance, property, properties[property], options, ctx);
	    }

	    var prop = Object.hasOwnProperty.call(instance, property) ? instance[property] : undefined;
	    var res = this.validateSchema(prop, properties[property], options, ctx.makeChild(properties[property], property));
	    if (res.instance !== result.instance[property]) result.instance[property] = res.instance;
	    result.importErrors(res);
	  }

	  return result;
	};
	/**
	 * Test a specific property within in instance against the additionalProperties schema attribute
	 * This ignores properties with definitions in the properties schema attribute, but no other attributes.
	 * If too many more types of property-existance tests pop up they may need their own class of tests (like `type` has)
	 * @private
	 * @return {boolean}
	 */


	function testAdditionalProperty(instance, schema, options, ctx, property, result) {
	  if (!this.types.object(instance)) return;

	  if (schema.properties && schema.properties[property] !== undefined) {
	    return;
	  }

	  if (schema.additionalProperties === false) {
	    result.addError({
	      name: 'additionalProperties',
	      argument: property,
	      message: "additionalProperty " + JSON.stringify(property) + " exists in instance when not allowed"
	    });
	  } else {
	    var additionalProperties = schema.additionalProperties || {};

	    if (typeof options.preValidateProperty == 'function') {
	      options.preValidateProperty(instance, property, additionalProperties, options, ctx);
	    }

	    var res = this.validateSchema(instance[property], additionalProperties, options, ctx.makeChild(additionalProperties, property));
	    if (res.instance !== result.instance[property]) result.instance[property] = res.instance;
	    result.importErrors(res);
	  }
	}
	/**
	 * Validates patternProperties
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null|ValidatorResult}
	 */


	validators.patternProperties = function validatePatternProperties(instance, schema, options, ctx) {
	  if (!this.types.object(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var patternProperties = schema.patternProperties || {};

	  for (var property in instance) {
	    var test = true;

	    for (var pattern in patternProperties) {
	      var expr = new RegExp(pattern);

	      if (!expr.test(property)) {
	        continue;
	      }

	      test = false;

	      if (typeof options.preValidateProperty == 'function') {
	        options.preValidateProperty(instance, property, patternProperties[pattern], options, ctx);
	      }

	      var res = this.validateSchema(instance[property], patternProperties[pattern], options, ctx.makeChild(patternProperties[pattern], property));
	      if (res.instance !== result.instance[property]) result.instance[property] = res.instance;
	      result.importErrors(res);
	    }

	    if (test) {
	      testAdditionalProperty.call(this, instance, schema, options, ctx, property, result);
	    }
	  }

	  return result;
	};
	/**
	 * Validates additionalProperties
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null|ValidatorResult}
	 */


	validators.additionalProperties = function validateAdditionalProperties(instance, schema, options, ctx) {
	  if (!this.types.object(instance)) return; // if patternProperties is defined then we'll test when that one is called instead

	  if (schema.patternProperties) {
	    return null;
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);

	  for (var property in instance) {
	    testAdditionalProperty.call(this, instance, schema, options, ctx, property, result);
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value is at least of a certain length, when the instance value is a string.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.minProperties = function validateMinProperties(instance, schema, options, ctx) {
	  if (!this.types.object(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var keys = Object.keys(instance);

	  if (!(keys.length >= schema.minProperties)) {
	    result.addError({
	      name: 'minProperties',
	      argument: schema.minProperties,
	      message: "does not meet minimum property length of " + schema.minProperties
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value is at most of a certain length, when the instance value is a string.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.maxProperties = function validateMaxProperties(instance, schema, options, ctx) {
	  if (!this.types.object(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var keys = Object.keys(instance);

	  if (!(keys.length <= schema.maxProperties)) {
	    result.addError({
	      name: 'maxProperties',
	      argument: schema.maxProperties,
	      message: "does not meet maximum property length of " + schema.maxProperties
	    });
	  }

	  return result;
	};
	/**
	 * Validates items when instance is an array
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null|ValidatorResult}
	 */


	validators.items = function validateItems(instance, schema, options, ctx) {
	  var self = this;
	  if (!this.types.array(instance)) return;
	  if (!schema.items) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  instance.every(function (value, i) {
	    var items = Array.isArray(schema.items) ? schema.items[i] || schema.additionalItems : schema.items;

	    if (items === undefined) {
	      return true;
	    }

	    if (items === false) {
	      result.addError({
	        name: 'items',
	        message: "additionalItems not permitted"
	      });
	      return false;
	    }

	    var res = self.validateSchema(value, items, options, ctx.makeChild(items, i));
	    if (res.instance !== result.instance[i]) result.instance[i] = res.instance;
	    result.importErrors(res);
	    return true;
	  });
	  return result;
	};
	/**
	 * Validates minimum and exclusiveMinimum when the type of the instance value is a number.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.minimum = function validateMinimum(instance, schema, options, ctx) {
	  if (!this.types.number(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var valid = true;

	  if (schema.exclusiveMinimum && schema.exclusiveMinimum === true) {
	    valid = instance > schema.minimum;
	  } else {
	    valid = instance >= schema.minimum;
	  }

	  if (!valid) {
	    result.addError({
	      name: 'minimum',
	      argument: schema.minimum,
	      message: "must have a minimum value of " + schema.minimum
	    });
	  }

	  return result;
	};
	/**
	 * Validates maximum and exclusiveMaximum when the type of the instance value is a number.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.maximum = function validateMaximum(instance, schema, options, ctx) {
	  if (!this.types.number(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var valid;

	  if (schema.exclusiveMaximum && schema.exclusiveMaximum === true) {
	    valid = instance < schema.maximum;
	  } else {
	    valid = instance <= schema.maximum;
	  }

	  if (!valid) {
	    result.addError({
	      name: 'maximum',
	      argument: schema.maximum,
	      message: "must have a maximum value of " + schema.maximum
	    });
	  }

	  return result;
	};
	/**
	 * Perform validation for multipleOf and divisibleBy, which are essentially the same.
	 * @param instance
	 * @param schema
	 * @param validationType
	 * @param errorMessage
	 * @returns {String|null}
	 */


	var validateMultipleOfOrDivisbleBy = function validateMultipleOfOrDivisbleBy(instance, schema, options, ctx, validationType, errorMessage) {
	  if (!this.types.number(instance)) return;
	  var validationArgument = schema[validationType];

	  if (validationArgument == 0) {
	    throw new SchemaError(validationType + " cannot be zero");
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var instanceDecimals = helpers.getDecimalPlaces(instance);
	  var divisorDecimals = helpers.getDecimalPlaces(validationArgument);
	  var maxDecimals = Math.max(instanceDecimals, divisorDecimals);
	  var multiplier = Math.pow(10, maxDecimals);

	  if (Math.round(instance * multiplier) % Math.round(validationArgument * multiplier) !== 0) {
	    result.addError({
	      name: validationType,
	      argument: validationArgument,
	      message: errorMessage + JSON.stringify(validationArgument)
	    });
	  }

	  return result;
	};
	/**
	 * Validates divisibleBy when the type of the instance value is a number.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.multipleOf = function validateMultipleOf(instance, schema, options, ctx) {
	  return validateMultipleOfOrDivisbleBy.call(this, instance, schema, options, ctx, "multipleOf", "is not a multiple of (divisible by) ");
	};
	/**
	 * Validates multipleOf when the type of the instance value is a number.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.divisibleBy = function validateDivisibleBy(instance, schema, options, ctx) {
	  return validateMultipleOfOrDivisbleBy.call(this, instance, schema, options, ctx, "divisibleBy", "is not divisible by (multiple of) ");
	};
	/**
	 * Validates whether the instance value is present.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.required = function validateRequired(instance, schema, options, ctx) {
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (instance === undefined && schema.required === true) {
	    // A boolean form is implemented for reverse-compatability with schemas written against older drafts
	    result.addError({
	      name: 'required',
	      message: "is required"
	    });
	  } else if (this.types.object(instance) && Array.isArray(schema.required)) {
	    schema.required.forEach(function (n) {
	      if (instance[n] === undefined) {
	        result.addError({
	          name: 'required',
	          argument: n,
	          message: "requires property " + JSON.stringify(n)
	        });
	      }
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value matches the regular expression, when the instance value is a string.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.pattern = function validatePattern(instance, schema, options, ctx) {
	  if (!this.types.string(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!instance.match(schema.pattern)) {
	    result.addError({
	      name: 'pattern',
	      argument: schema.pattern,
	      message: "does not match pattern " + JSON.stringify(schema.pattern.toString())
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value is of a certain defined format or a custom
	 * format.
	 * The following formats are supported for string types:
	 *   - date-time
	 *   - date
	 *   - time
	 *   - ip-address
	 *   - ipv6
	 *   - uri
	 *   - color
	 *   - host-name
	 *   - alpha
	 *   - alpha-numeric
	 *   - utc-millisec
	 * @param instance
	 * @param schema
	 * @param [options]
	 * @param [ctx]
	 * @return {String|null}
	 */


	validators.format = function validateFormat(instance, schema, options, ctx) {
	  if (instance === undefined) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!result.disableFormat && !helpers.isFormat(instance, schema.format, this)) {
	    result.addError({
	      name: 'format',
	      argument: schema.format,
	      message: "does not conform to the " + JSON.stringify(schema.format) + " format"
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value is at least of a certain length, when the instance value is a string.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.minLength = function validateMinLength(instance, schema, options, ctx) {
	  if (!this.types.string(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var hsp = instance.match(/[\uDC00-\uDFFF]/g);
	  var length = instance.length - (hsp ? hsp.length : 0);

	  if (!(length >= schema.minLength)) {
	    result.addError({
	      name: 'minLength',
	      argument: schema.minLength,
	      message: "does not meet minimum length of " + schema.minLength
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value is at most of a certain length, when the instance value is a string.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.maxLength = function validateMaxLength(instance, schema, options, ctx) {
	  if (!this.types.string(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx); // TODO if this was already computed in "minLength", use that value instead of re-computing

	  var hsp = instance.match(/[\uDC00-\uDFFF]/g);
	  var length = instance.length - (hsp ? hsp.length : 0);

	  if (!(length <= schema.maxLength)) {
	    result.addError({
	      name: 'maxLength',
	      argument: schema.maxLength,
	      message: "does not meet maximum length of " + schema.maxLength
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether instance contains at least a minimum number of items, when the instance is an Array.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.minItems = function validateMinItems(instance, schema, options, ctx) {
	  if (!this.types.array(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!(instance.length >= schema.minItems)) {
	    result.addError({
	      name: 'minItems',
	      argument: schema.minItems,
	      message: "does not meet minimum length of " + schema.minItems
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether instance contains no more than a maximum number of items, when the instance is an Array.
	 * @param instance
	 * @param schema
	 * @return {String|null}
	 */


	validators.maxItems = function validateMaxItems(instance, schema, options, ctx) {
	  if (!this.types.array(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!(instance.length <= schema.maxItems)) {
	    result.addError({
	      name: 'maxItems',
	      argument: schema.maxItems,
	      message: "does not meet maximum length of " + schema.maxItems
	    });
	  }

	  return result;
	};
	/**
	 * Validates that every item in an instance array is unique, when instance is an array
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {String|null|ValidatorResult}
	 */


	validators.uniqueItems = function validateUniqueItems(instance, schema, options, ctx) {
	  if (!this.types.array(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  function testArrays(v, i, a) {
	    for (var j = i + 1; j < a.length; j++) if (helpers.deepCompareStrict(v, a[j])) {
	      return false;
	    }

	    return true;
	  }

	  if (!instance.every(testArrays)) {
	    result.addError({
	      name: 'uniqueItems',
	      message: "contains duplicate item"
	    });
	  }

	  return result;
	};
	/**
	 * Deep compares arrays for duplicates
	 * @param v
	 * @param i
	 * @param a
	 * @private
	 * @return {boolean}
	 */


	function testArrays(v, i, a) {
	  var j,
	      len = a.length;

	  for (j = i + 1, len; j < len; j++) {
	    if (helpers.deepCompareStrict(v, a[j])) {
	      return false;
	    }
	  }

	  return true;
	}
	/**
	 * Validates whether there are no duplicates, when the instance is an Array.
	 * @param instance
	 * @return {String|null}
	 */


	validators.uniqueItems = function validateUniqueItems(instance, schema, options, ctx) {
	  if (!this.types.array(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!instance.every(testArrays)) {
	    result.addError({
	      name: 'uniqueItems',
	      message: "contains duplicate item"
	    });
	  }

	  return result;
	};
	/**
	 * Validate for the presence of dependency properties, if the instance is an object.
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {null|ValidatorResult}
	 */


	validators.dependencies = function validateDependencies(instance, schema, options, ctx) {
	  if (!this.types.object(instance)) return;
	  var result = new ValidatorResult(instance, schema, options, ctx);

	  for (var property in schema.dependencies) {
	    if (instance[property] === undefined) {
	      continue;
	    }

	    var dep = schema.dependencies[property];
	    var childContext = ctx.makeChild(dep, property);

	    if (typeof dep == 'string') {
	      dep = [dep];
	    }

	    if (Array.isArray(dep)) {
	      dep.forEach(function (prop) {
	        if (instance[prop] === undefined) {
	          result.addError({
	            // FIXME there's two different "dependencies" errors here with slightly different outputs
	            // Can we make these the same? Or should we create different error types?
	            name: 'dependencies',
	            argument: childContext.propertyPath,
	            message: "property " + prop + " not found, required by " + childContext.propertyPath
	          });
	        }
	      });
	    } else {
	      var res = this.validateSchema(instance, dep, options, childContext);
	      if (result.instance !== res.instance) result.instance = res.instance;

	      if (res && res.errors.length) {
	        result.addError({
	          name: 'dependencies',
	          argument: childContext.propertyPath,
	          message: "does not meet dependency required by " + childContext.propertyPath
	        });
	        result.importErrors(res);
	      }
	    }
	  }

	  return result;
	};
	/**
	 * Validates whether the instance value is one of the enumerated values.
	 *
	 * @param instance
	 * @param schema
	 * @return {ValidatorResult|null}
	 */


	validators['enum'] = function validateEnum(instance, schema, options, ctx) {
	  if (instance === undefined) {
	    return null;
	  }

	  if (!Array.isArray(schema['enum'])) {
	    throw new SchemaError("enum expects an array", schema);
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!schema['enum'].some(helpers.deepCompareStrict.bind(null, instance))) {
	    result.addError({
	      name: 'enum',
	      argument: schema['enum'],
	      message: "is not one of enum values: " + schema['enum'].map(String).join(',')
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance exactly matches a given value
	 *
	 * @param instance
	 * @param schema
	 * @return {ValidatorResult|null}
	 */


	validators['const'] = function validateEnum(instance, schema, options, ctx) {
	  if (instance === undefined) {
	    return null;
	  }

	  var result = new ValidatorResult(instance, schema, options, ctx);

	  if (!helpers.deepCompareStrict(schema['const'], instance)) {
	    result.addError({
	      name: 'const',
	      argument: schema['const'],
	      message: "does not exactly match expected constant: " + schema['const']
	    });
	  }

	  return result;
	};
	/**
	 * Validates whether the instance if of a prohibited type.
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @return {null|ValidatorResult}
	 */


	validators.not = validators.disallow = function validateNot(instance, schema, options, ctx) {
	  var self = this;
	  if (instance === undefined) return null;
	  var result = new ValidatorResult(instance, schema, options, ctx);
	  var notTypes = schema.not || schema.disallow;
	  if (!notTypes) return null;
	  if (!Array.isArray(notTypes)) notTypes = [notTypes];
	  notTypes.forEach(function (type) {
	    if (self.testType(instance, schema, options, ctx, type)) {
	      var schemaId = type && type.id && '<' + type.id + '>' || type;
	      result.addError({
	        name: 'not',
	        argument: schemaId,
	        message: "is of prohibited type " + schemaId
	      });
	    }
	  });
	  return result;
	};

	var attribute_1 = attribute;

	var SchemaScanResult_1 = SchemaScanResult;

	function SchemaScanResult(found, ref) {
	  this.id = found;
	  this.ref = ref;
	}
	/**
	 * Adds a schema with a certain urn to the Validator instance.
	 * @param string uri
	 * @param object schema
	 * @return {Object}
	 */


	var scan_1 = function scan(base, schema) {
	  function scanSchema(baseuri, schema) {
	    if (!schema || typeof schema != 'object') return; // Mark all referenced schemas so we can tell later which schemas are referred to, but never defined

	    if (schema.$ref) {
	      var resolvedUri = urilib.resolve(baseuri, schema.$ref);
	      ref[resolvedUri] = ref[resolvedUri] ? ref[resolvedUri] + 1 : 0;
	      return;
	    }

	    var ourBase = schema.id ? urilib.resolve(baseuri, schema.id) : baseuri;

	    if (ourBase) {
	      // If there's no fragment, append an empty one
	      if (ourBase.indexOf('#') < 0) ourBase += '#';

	      if (found[ourBase]) {
	        if (!helpers.deepCompareStrict(found[ourBase], schema)) {
	          throw new Error('Schema <' + schema + '> already exists with different definition');
	        }

	        return found[ourBase];
	      }

	      found[ourBase] = schema; // strip trailing fragment

	      if (ourBase[ourBase.length - 1] == '#') {
	        found[ourBase.substring(0, ourBase.length - 1)] = schema;
	      }
	    }

	    scanArray(ourBase + '/items', Array.isArray(schema.items) ? schema.items : [schema.items]);
	    scanArray(ourBase + '/extends', Array.isArray(schema.extends) ? schema.extends : [schema.extends]);
	    scanSchema(ourBase + '/additionalItems', schema.additionalItems);
	    scanObject(ourBase + '/properties', schema.properties);
	    scanSchema(ourBase + '/additionalProperties', schema.additionalProperties);
	    scanObject(ourBase + '/definitions', schema.definitions);
	    scanObject(ourBase + '/patternProperties', schema.patternProperties);
	    scanObject(ourBase + '/dependencies', schema.dependencies);
	    scanArray(ourBase + '/disallow', schema.disallow);
	    scanArray(ourBase + '/allOf', schema.allOf);
	    scanArray(ourBase + '/anyOf', schema.anyOf);
	    scanArray(ourBase + '/oneOf', schema.oneOf);
	    scanSchema(ourBase + '/not', schema.not);
	  }

	  function scanArray(baseuri, schemas) {
	    if (!Array.isArray(schemas)) return;

	    for (var i = 0; i < schemas.length; i++) {
	      scanSchema(baseuri + '/' + i, schemas[i]);
	    }
	  }

	  function scanObject(baseuri, schemas) {
	    if (!schemas || typeof schemas != 'object') return;

	    for (var p in schemas) {
	      scanSchema(baseuri + '/' + p, schemas[p]);
	    }
	  }

	  var found = {};
	  var ref = {};
	  scanSchema(base, schema);
	  return new SchemaScanResult(found, ref);
	};

	var scan = {
	  SchemaScanResult: SchemaScanResult_1,
	  scan: scan_1
	};

	var scanSchema = scan.scan;
	var ValidatorResult$1 = helpers.ValidatorResult;
	var SchemaError$1 = helpers.SchemaError;
	var SchemaContext = helpers.SchemaContext; //var anonymousBase = 'vnd.jsonschema:///';

	var anonymousBase = '/';
	/**
	 * Creates a new Validator object
	 * @name Validator
	 * @constructor
	 */

	var Validator = function Validator() {
	  // Allow a validator instance to override global custom formats or to have their
	  // own custom formats.
	  this.customFormats = Object.create(Validator.prototype.customFormats);
	  this.schemas = {};
	  this.unresolvedRefs = []; // Use Object.create to make this extensible without Validator instances stepping on each other's toes.

	  this.types = Object.create(types);
	  this.attributes = Object.create(attribute_1.validators);
	}; // Allow formats to be registered globally.


	Validator.prototype.customFormats = {}; // Hint at the presence of a property

	Validator.prototype.schemas = null;
	Validator.prototype.types = null;
	Validator.prototype.attributes = null;
	Validator.prototype.unresolvedRefs = null;
	/**
	 * Adds a schema with a certain urn to the Validator instance.
	 * @param schema
	 * @param urn
	 * @return {Object}
	 */

	Validator.prototype.addSchema = function addSchema(schema, base) {
	  var self = this;

	  if (!schema) {
	    return null;
	  }

	  var scan = scanSchema(base || anonymousBase, schema);
	  var ourUri = base || schema.id;

	  for (var uri in scan.id) {
	    this.schemas[uri] = scan.id[uri];
	  }

	  for (var uri in scan.ref) {
	    this.unresolvedRefs.push(uri);
	  }

	  this.unresolvedRefs = this.unresolvedRefs.filter(function (uri) {
	    return typeof self.schemas[uri] === 'undefined';
	  });
	  return this.schemas[ourUri];
	};

	Validator.prototype.addSubSchemaArray = function addSubSchemaArray(baseuri, schemas) {
	  if (!Array.isArray(schemas)) return;

	  for (var i = 0; i < schemas.length; i++) {
	    this.addSubSchema(baseuri, schemas[i]);
	  }
	};

	Validator.prototype.addSubSchemaObject = function addSubSchemaArray(baseuri, schemas) {
	  if (!schemas || typeof schemas != 'object') return;

	  for (var p in schemas) {
	    this.addSubSchema(baseuri, schemas[p]);
	  }
	};
	/**
	 * Sets all the schemas of the Validator instance.
	 * @param schemas
	 */


	Validator.prototype.setSchemas = function setSchemas(schemas) {
	  this.schemas = schemas;
	};
	/**
	 * Returns the schema of a certain urn
	 * @param urn
	 */


	Validator.prototype.getSchema = function getSchema(urn) {
	  return this.schemas[urn];
	};
	/**
	 * Validates instance against the provided schema
	 * @param instance
	 * @param schema
	 * @param [options]
	 * @param [ctx]
	 * @return {Array}
	 */


	Validator.prototype.validate = function validate(instance, schema, options, ctx) {
	  if (!options) {
	    options = {};
	  }

	  var propertyName = options.propertyName || 'instance'; // This will work so long as the function at uri.resolve() will resolve a relative URI to a relative URI

	  var base = urilib.resolve(options.base || anonymousBase, schema.id || '');

	  if (!ctx) {
	    ctx = new SchemaContext(schema, options, propertyName, base, Object.create(this.schemas));

	    if (!ctx.schemas[base]) {
	      ctx.schemas[base] = schema;
	    }

	    var found = scanSchema(base, schema);

	    for (var n in found.id) {
	      var sch = found.id[n];
	      ctx.schemas[n] = sch;
	    }
	  }

	  if (schema) {
	    var result = this.validateSchema(instance, schema, options, ctx);

	    if (!result) {
	      throw new Error('Result undefined');
	    }

	    return result;
	  }

	  throw new SchemaError$1('no schema specified', schema);
	};
	/**
	* @param Object schema
	* @return mixed schema uri or false
	*/


	function shouldResolve(schema) {
	  var ref = typeof schema === 'string' ? schema : schema.$ref;
	  if (typeof ref == 'string') return ref;
	  return false;
	}
	/**
	 * Validates an instance against the schema (the actual work horse)
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @private
	 * @return {ValidatorResult}
	 */


	Validator.prototype.validateSchema = function validateSchema(instance, schema, options, ctx) {
	  var result = new ValidatorResult$1(instance, schema, options, ctx); // Support for the true/false schemas

	  if (typeof schema === 'boolean') {
	    if (schema === true) {
	      // `true` is always valid
	      schema = {};
	    } else if (schema === false) {
	      // `false` is always invalid
	      schema = {
	        type: []
	      };
	    }
	  } else if (!schema) {
	    // This might be a string
	    throw new Error("schema is undefined");
	  }

	  if (schema['extends']) {
	    if (Array.isArray(schema['extends'])) {
	      var schemaobj = {
	        schema: schema,
	        ctx: ctx
	      };
	      schema['extends'].forEach(this.schemaTraverser.bind(this, schemaobj));
	      schema = schemaobj.schema;
	      schemaobj.schema = null;
	      schemaobj.ctx = null;
	      schemaobj = null;
	    } else {
	      schema = helpers.deepMerge(schema, this.superResolve(schema['extends'], ctx));
	    }
	  } // If passed a string argument, load that schema URI


	  var switchSchema;

	  if (switchSchema = shouldResolve(schema)) {
	    var resolved = this.resolve(schema, switchSchema, ctx);
	    var subctx = new SchemaContext(resolved.subschema, options, ctx.propertyPath, resolved.switchSchema, ctx.schemas);
	    return this.validateSchema(instance, resolved.subschema, options, subctx);
	  }

	  var skipAttributes = options && options.skipAttributes || []; // Validate each schema attribute against the instance

	  for (var key in schema) {
	    if (!attribute_1.ignoreProperties[key] && skipAttributes.indexOf(key) < 0) {
	      var validatorErr = null;
	      var validator = this.attributes[key];

	      if (validator) {
	        validatorErr = validator.call(this, instance, schema, options, ctx);
	      } else if (options.allowUnknownAttributes === false) {
	        // This represents an error with the schema itself, not an invalid instance
	        throw new SchemaError$1("Unsupported attribute: " + key, schema);
	      }

	      if (validatorErr) {
	        result.importErrors(validatorErr);
	      }
	    }
	  }

	  if (typeof options.rewrite == 'function') {
	    var value = options.rewrite.call(this, instance, schema, options, ctx);
	    result.instance = value;
	  }

	  return result;
	};
	/**
	* @private
	* @param Object schema
	* @param SchemaContext ctx
	* @returns Object schema or resolved schema
	*/


	Validator.prototype.schemaTraverser = function schemaTraverser(schemaobj, s) {
	  schemaobj.schema = helpers.deepMerge(schemaobj.schema, this.superResolve(s, schemaobj.ctx));
	};
	/**
	* @private
	* @param Object schema
	* @param SchemaContext ctx
	* @returns Object schema or resolved schema
	*/


	Validator.prototype.superResolve = function superResolve(schema, ctx) {
	  var ref;

	  if (ref = shouldResolve(schema)) {
	    return this.resolve(schema, ref, ctx).subschema;
	  }

	  return schema;
	};
	/**
	* @private
	* @param Object schema
	* @param Object switchSchema
	* @param SchemaContext ctx
	* @return Object resolved schemas {subschema:String, switchSchema: String}
	* @throws SchemaError
	*/


	Validator.prototype.resolve = function resolve(schema, switchSchema, ctx) {
	  switchSchema = ctx.resolve(switchSchema); // First see if the schema exists under the provided URI

	  if (ctx.schemas[switchSchema]) {
	    return {
	      subschema: ctx.schemas[switchSchema],
	      switchSchema: switchSchema
	    };
	  } // Else try walking the property pointer


	  var parsed = urilib.parse(switchSchema);
	  var fragment = parsed && parsed.hash;
	  var document = fragment && fragment.length && switchSchema.substr(0, switchSchema.length - fragment.length);

	  if (!document || !ctx.schemas[document]) {
	    throw new SchemaError$1("no such schema <" + switchSchema + ">", schema);
	  }

	  var subschema = helpers.objectGetPath(ctx.schemas[document], fragment.substr(1));

	  if (subschema === undefined) {
	    throw new SchemaError$1("no such schema " + fragment + " located in <" + document + ">", schema);
	  }

	  return {
	    subschema: subschema,
	    switchSchema: switchSchema
	  };
	};
	/**
	 * Tests whether the instance if of a certain type.
	 * @private
	 * @param instance
	 * @param schema
	 * @param options
	 * @param ctx
	 * @param type
	 * @return {boolean}
	 */


	Validator.prototype.testType = function validateType(instance, schema, options, ctx, type) {
	  if (typeof this.types[type] == 'function') {
	    return this.types[type].call(this, instance);
	  }

	  if (type && typeof type == 'object') {
	    var res = this.validateSchema(instance, type, options, ctx);
	    return res === undefined || !(res && res.errors.length);
	  } // Undefined or properties not on the list are acceptable, same as not being defined


	  return true;
	};

	var types = Validator.prototype.types = {};

	types.string = function testString(instance) {
	  return typeof instance == 'string';
	};

	types.number = function testNumber(instance) {
	  // isFinite returns false for NaN, Infinity, and -Infinity
	  return typeof instance == 'number' && isFinite(instance);
	};

	types.integer = function testInteger(instance) {
	  return typeof instance == 'number' && instance % 1 === 0;
	};

	types.boolean = function testBoolean(instance) {
	  return typeof instance == 'boolean';
	};

	types.array = function testArray(instance) {
	  return Array.isArray(instance);
	};

	types['null'] = function testNull(instance) {
	  return instance === null;
	};

	types.date = function testDate(instance) {
	  return instance instanceof Date;
	};

	types.any = function testAny(instance) {
	  return true;
	};

	types.object = function testObject(instance) {
	  // TODO: fix this - see #15
	  return instance && typeof instance === 'object' && !Array.isArray(instance) && !(instance instanceof Date);
	};

	var validator = Validator;

	var lib = createCommonjsModule(function (module) {

	  var Validator = module.exports.Validator = validator;
	  module.exports.ValidatorResult = helpers.ValidatorResult;
	  module.exports.ValidationError = helpers.ValidationError;
	  module.exports.SchemaError = helpers.SchemaError;
	  module.exports.SchemaScanResult = scan.SchemaScanResult;
	  module.exports.scan = scan.scan;

	  module.exports.validate = function (instance, schema, options) {
	    var v = new Validator();
	    return v.validate(instance, schema, options);
	  };
	});
	var lib_1 = lib.Validator;
	var lib_2 = lib.ValidatorResult;
	var lib_3 = lib.ValidationError;
	var lib_4 = lib.SchemaError;
	var lib_5 = lib.SchemaScanResult;
	var lib_6 = lib.scan;
	var lib_7 = lib.validate;

	/*
	    LogUI Client Library
	    JSON Schema Validation Library

	    An IIFE module providing access to JSON validation functionality.
	    Also provides the ability to add additional properties to be validated.
	    Useful for the dispatcher architecture.

	    @module: ValidationSchemas
	    @author: David Maxwell
	    @date: 2020-09-20
	*/
	var SCHEMA_SUPPLIED_CONFIG = {
	  id: 'LogUI-suppliedConfig',
	  type: 'object',
	  properties: {
	    applicationSpecificData: {
	      'type': 'object'
	    },
	    logUIConfiguration: {
	      '$ref': '/LogUI-logUIConfig'
	    },
	    trackingConfiguration: {
	      '$ref': '/LogUI-trackingConfig'
	    }
	  },
	  required: ['applicationSpecificData', 'trackingConfiguration', 'logUIConfiguration']
	};
	var SCHEMA_SUPPLIED_CONFIG_LOGUI = {
	  id: 'LogUI-logUIConfig',
	  type: 'object',
	  properties: {
	    verbose: {
	      'type': 'boolean'
	    },
	    browserEvents: {
	      '$ref': '/LogUI-browserEvents'
	    }
	  },
	  required: []
	};
	var SCHEMA_SUPPLIED_CONFIG_LOGUI_BROWSEREVENTS = {
	  id: 'LogUI-browserEvents',
	  type: 'object',
	  additionalProperties: false,
	  properties: {
	    blockEventBubbling: {
	      'type': 'boolean'
	    },
	    eventsWhileScrolling: {
	      'type': 'boolean'
	    },
	    URLChanges: {
	      'type': 'boolean'
	    },
	    contextMenu: {
	      'type': 'boolean'
	    },
	    pageFocus: {
	      'type': 'boolean'
	    },
	    trackCursor: {
	      'type': 'boolean'
	    },
	    cursorUpdateFrequency: {
	      'type': 'number'
	    },
	    cursorLeavingPage: {
	      'type': 'boolean'
	    },
	    pageResize: {
	      'type': 'boolean'
	    }
	  },
	  required: []
	};
	var SCHEMA_SUPPLIED_TRACKING_CONFIG = {
	  id: 'LogUI-trackingConfig',
	  type: 'object',
	  properties: {},
	  required: []
	};
	var ValidationSchemas = (function (root) {
	  var _public = {};

	  _public.addLogUIConfigProperty = function (propertyName, propertyType) {
	    var isRequired = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : true;
	    SCHEMA_SUPPLIED_CONFIG_LOGUI.properties[propertyName] = {
	      'type': propertyType
	    };

	    if (isRequired) {
	      SCHEMA_SUPPLIED_CONFIG_LOGUI.required.push(propertyName);
	    }
	  };

	  _public.validateSuppliedConfigObject = function (suppliedConfigObject) {
	    var suppliedConfigValidator = new lib_1();
	    suppliedConfigValidator.addSchema(SCHEMA_SUPPLIED_CONFIG_LOGUI, '/LogUI-logUIConfig');
	    suppliedConfigValidator.addSchema(SCHEMA_SUPPLIED_TRACKING_CONFIG, '/LogUI-trackingConfig');
	    suppliedConfigValidator.addSchema(SCHEMA_SUPPLIED_CONFIG_LOGUI_BROWSEREVENTS, '/LogUI-browserEvents');
	    return suppliedConfigValidator.validate(suppliedConfigObject, SCHEMA_SUPPLIED_CONFIG);
	  };

	  return _public;
	})();

	function _createForOfIteratorHelper(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

	function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var LOGUI_SESSION_ID_KEYNAME = 'logUI-sessionIDKey';
	var Config = (function (root) {
	  var _public = {};
	  var _initTimestamp = null;
	  var _sessionData = null;
	  var _applicationSpecificData = {};
	  var _trackingConfig = {};
	  var _configProperties = null;
	  var _browserEvents = {};
	  var _DOMProperties = null; // Used to store properties for DOM elements on the page.

	  var _styleElement = null;

	  _public.init = function (suppliedConfigObject) {
	    _initTimestamp = new Date();
	    _configProperties = Helpers.extendObject({}, logUIdefaults);
	    var initState = isSupported() && validateSuppliedConfigObject(suppliedConfigObject) && initConfigObjects(suppliedConfigObject);

	    if (!initState) {
	      _initTimestamp = null;
	      return initState;
	    }

	    _DOMProperties = new WeakMap();

	    _public.CSSRules.init();

	    _public.sessionData.init();

	    return initState;
	  };

	  var initConfigObjects = function initConfigObjects(suppliedConfigObject) {
	    Helpers.extendObject(_configProperties, logUIdefaults.dispatcher); // Apply the defaults for the dispatcher.

	    Helpers.extendObject(_configProperties, suppliedConfigObject.logUIConfiguration); // Apply the logUIConfiguration values from the supplied config object.

	    _applicationSpecificData = suppliedConfigObject.applicationSpecificData;
	    _trackingConfig = suppliedConfigObject.trackingConfiguration;
	    _browserEvents = suppliedConfigObject.browserEvents;
	    return true;
	  };

	  _public.reset = function () {
	    _configProperties = null;
	    _initTimestamp = null;
	    _sessionData = null;
	    _applicationSpecificData = {};
	    _trackingConfig = {};
	    _browserEvents = {};

	    _public.CSSRules.reset();
	  };

	  _public.DOMProperties = {
	    has: function has(element) {
	      return _DOMProperties.has(element);
	    },
	    set: function set(element, properties) {
	      _DOMProperties.set(element, properties);
	    },
	    get: function get(element) {
	      if (_DOMProperties.has(element)) {
	        return _DOMProperties.get(element);
	      }

	      return undefined;
	    },
	    reset: function reset() {
	      if (_public.isActive()) {
	        _DOMProperties = new WeakMap();
	        return true;
	      }

	      return false;
	    }
	  };
	  _public.CSSRules = {
	    init: function init() {
	      _styleElement = root.document.createElement('style');
	      root.document.head.append(_styleElement);
	    },
	    reset: function reset() {
	      _styleElement.remove();

	      _styleElement = null;
	    },
	    addRule: function addRule(selectorString, propertiesString) {
	      var stylesheet = _styleElement.sheet;

	      if (stylesheet) {
	        stylesheet.insertRule("".concat(selectorString, " { ").concat(propertiesString, " }"));
	      }
	    },
	    removeRule: function removeRule(selectorString, propertiesString) {
	      if (_styleElement) {
	        for (var i in _styleElement.sheet.cssRules) {
	          var styleElement = _styleElement.sheet.cssRules[i];

	          if (styleElement.cssText == "".concat(selectorString, " { ").concat(propertiesString, " }")) {
	            _styleElement.sheet.removeRule(i);

	            return true;
	          }
	        }

	        return false;
	      }
	    }
	  };

	  _public.getConfigProperty = function (propertyName) {
	    return _configProperties[propertyName];
	  }; // _public.getApplicationSpecificData = function() {
	  //     return _applicationSpecificData;
	  // };


	  _public.applicationSpecificData = {
	    get: function get() {
	      return _applicationSpecificData;
	    },
	    update: function update(updatedObject) {
	      _applicationSpecificData = Helpers.extendObject(_applicationSpecificData, updatedObject);
	    },
	    deleteKey: function deleteKey(keyName) {
	      delete _applicationSpecificData[keyName];
	    }
	  };
	  _public.elementTrackingConfig = {
	    get: function get() {
	      return _trackingConfig;
	    },
	    getElementGroup: function getElementGroup(groupName) {
	      return _trackingConfig[groupName];
	    }
	  };

	  _public.isActive = function () {
	    return !!_initTimestamp;
	  };

	  _public.getInitTimestamp = function () {
	    return _initTimestamp;
	  };

	  _public.sessionData = {
	    init: function init() {
	      _sessionData = {
	        IDkey: null,
	        sessionStartTimestamp: null,
	        libraryStartTimestamp: null
	      };

	      _public.sessionData.getSessionIDKey();
	    },
	    reset: function reset() {
	      _public.sessionData.init();
	    },
	    getSessionIDKey: function getSessionIDKey() {
	      return root.sessionStorage.getItem(LOGUI_SESSION_ID_KEYNAME);
	    },
	    clearSessionIDKey: function clearSessionIDKey() {
	      root.sessionStorage.removeItem(LOGUI_SESSION_ID_KEYNAME);
	    },
	    setID: function setID(newID) {
	      _sessionData.IDkey = newID;
	      root.sessionStorage.setItem(LOGUI_SESSION_ID_KEYNAME, newID);
	    },
	    setIDFromSession: function setIDFromSession() {
	      _sessionData.IDKey = root.sessionStorage.getItem(LOGUI_SESSION_ID_KEYNAME);
	    },
	    setTimestamps: function setTimestamps(sessionStartTimestamp, libraryLoadTimestamp) {
	      _sessionData.sessionStartTimestamp = sessionStartTimestamp;
	      _sessionData.libraryStartTimestamp = libraryLoadTimestamp;
	    },
	    getSessionStartTimestamp: function getSessionStartTimestamp() {
	      return _sessionData.sessionStartTimestamp;
	    },
	    getLibraryStartTimestamp: function getLibraryStartTimestamp() {
	      return _sessionData.libraryStartTimestamp;
	    }
	  };
	  _public.browserEventsConfig = {
	    get: function get(propertyName, defaultValue) {
	      if (_public.browserEventsConfig.has(propertyName)) {
	        return _browserEvents[propertyName];
	      }

	      return defaultValue;
	    },
	    has: function has(propertyName) {
	      if (_browserEvents) {
	        return _browserEvents.hasOwnProperty(propertyName);
	      }

	      return false;
	    }
	  };

	  var isSupported = function isSupported() {
	    var _iterator = _createForOfIteratorHelper(RequiredFeatures.getFeatures()),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var feature = _step.value;

	        if (!Helpers.getElementDescendant(root, feature)) {
	          Helpers.console("The required feature '".concat(feature, "' cannot be found; LogUI cannot start!"), 'Initialisation', true);
	          return false;
	        }
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }

	    return true;
	  };

	  var validateSuppliedConfigObject = function validateSuppliedConfigObject(suppliedConfigObject) {
	    var validator = ValidationSchemas.validateSuppliedConfigObject(suppliedConfigObject);

	    if (!validator.valid) {
	      Helpers.console("The configuration object passed to LogUI was not valid or complete; refer to the warning(s) below for more information.", 'Initialisation', true);

	      var _iterator2 = _createForOfIteratorHelper(validator.errors),
	          _step2;

	      try {
	        for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	          var error = _step2.value;
	          Helpers.console("> ".concat(error.stack), 'Initialisation', true);
	        }
	      } catch (err) {
	        _iterator2.e(err);
	      } finally {
	        _iterator2.f();
	      }

	      return false;
	    }

	    return true;
	  };

	  return _public;
	})(window);

	logUIdefaults.dispatcher = {
	  endpoint: null,
	  authorizationToken: null
	}; //TODO: Odosight does not register the WindowConnection API for this to work. Maybe fix this one day.
	//RequiredFeatures.addFeature('WindowConnection') //Requires the WindowConnection API provided by the odo-sight extension.  

	var Dispatcher = (function (root) {
	  var _public = {};
	  var _isActive = false;
	  var _windowConnection = null;

	  _public.dispatcherType = 'odo-sight';

	  _public.init = function () {
	    _initWindowConnection();

	    _isActive = true;
	    root.dispatchEvent(new Event('logUIStarted'));
	    return true;
	  };

	  _public.stop = /*#__PURE__*/asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee() {
	    return regenerator.wrap(function _callee$(_context) {
	      while (1) {
	        switch (_context.prev = _context.next) {
	          case 0:
	            _isActive = false;

	          case 1:
	          case "end":
	            return _context.stop();
	        }
	      }
	    }, _callee);
	  }));

	  _public.isActive = function () {
	    return _isActive;
	  };

	  _public.sendObject = function (objectToSend) {
	    if (_isActive) {
	      Helpers.console(objectToSend, 'Dispatcher', false);
	      var data = JSON.parse(JSON.stringify(objectToSend));

	      _windowConnection.send({
	        type: 'LOGUI_EVENT',
	        payload: data
	      }, function (response) {
	        console.log('Event dispatch acknowledged by odo-sight.');
	      }, function (error) {
	        console.error('Error dispatching event to odo-sight!', JSON.stringify(error, null, 4));
	      });

	      return;
	    }

	    throw Error('You cannot send a message when LogUI is not active.');
	  };

	  var _initWindowConnection = function _initWindowConnection() {
	    _windowConnection = new WindowConnection('logui.bundle.js', 'main.js');

	    _windowConnection.on('LOGUI_HANDSHAKE_SUCCESS', function (request) {
	      return new Promise(function (resolve, reject) {
	        var _sessionData = request.sessionData;
	        Config.sessionData.setID(_sessionData.sessionID);
	        Config.sessionData.setTimestamps(new Date(_sessionData['sessionStartTimestamp']), new Date(_sessionData['libraryStartTimestamp']));
	        root.dispatchEvent(new Event('logUIStarted'));
	        resolve('dispatched DOM Event logUIStarted');
	      });
	    });

	    _windowConnection.on('LOGUI_CACHE_OVERFLOW', function (request) {
	      return new Promise(function (resolve, reject) {
	        root.dispatchEvent(new Event('logUIShutdownRequest'));
	        resolve('dispatched DOM Event logUIShutdownRequest');
	      });
	    });

	    _windowConnection.send({
	      type: 'START_DISPATCHER',
	      authToken: Config.getConfigProperty('authorisationToken'),
	      endpoint: Config.getConfigProperty('endpoint')
	    });
	  };

	  return _public;
	})(window);

	function _createForOfIteratorHelper$1(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$1(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$1(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$1(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$1(o, minLen); }

	function _arrayLikeToArray$1(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

	/*
	    LogUI Client Library
	    DOM Properties Object Factory Module

	    IIFE function that provides a factory for DOM Properties objects, which are stored in the Config WeakMap.

	    @module: DOM Properties Object Factory
	    @author: David Maxwell
	    @date: 2020-03-02
	*/
	var DOMPropertiesObject = (function (root) {
	  var createObject = function createObject(groupObject) {
	    var newDOMPropertiesObject = {
	      events: {},
	      hasEvent: function hasEvent(eventName) {
	        if (newDOMPropertiesObject['events'].hasOwnProperty(eventName)) {
	          return true;
	        }

	        return false;
	      },
	      getEventGroupName: function getEventGroupName(eventName) {
	        if (newDOMPropertiesObject.hasEvent(eventName)) {
	          return newDOMPropertiesObject['events'][eventName];
	        }

	        return false;
	      },
	      getEventList: /*#__PURE__*/regenerator.mark(function getEventList() {
	        var eventName;
	        return regenerator.wrap(function getEventList$(_context) {
	          while (1) {
	            switch (_context.prev = _context.next) {
	              case 0:
	                _context.t0 = regenerator.keys(newDOMPropertiesObject['events']);

	              case 1:
	                if ((_context.t1 = _context.t0()).done) {
	                  _context.next = 7;
	                  break;
	                }

	                eventName = _context.t1.value;
	                _context.next = 5;
	                return eventName;

	              case 5:
	                _context.next = 1;
	                break;

	              case 7:
	              case "end":
	                return _context.stop();
	            }
	          }
	        }, getEventList);
	      }),
	      deleteEventsWithGroup: function deleteEventsWithGroup(groupName) {
	        for (var event in newDOMPropertiesObject['events']) {
	          if (newDOMPropertiesObject.getEventGroupName(event) == groupName) {
	            newDOMPropertiesObject.deleteEvent(event);
	          }
	        }
	      },
	      deleteEvent: function deleteEvent(eventName) {
	        delete newDOMPropertiesObject['events'][eventName];
	      },
	      setEvent: function setEvent(eventName, groupName) {
	        newDOMPropertiesObject['events'][eventName] = groupName;
	      }
	    };

	    var _iterator = _createForOfIteratorHelper$1(groupObject.eventsList),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var event = _step.value;
	        newDOMPropertiesObject['events'][event] = groupObject.name;
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }

	    return newDOMPropertiesObject;
	  };

	  return createObject;
	})();

	function _arrayLikeToArray$2(arr, len) {
	  if (len == null || len > arr.length) len = arr.length;

	  for (var i = 0, arr2 = new Array(len); i < len; i++) {
	    arr2[i] = arr[i];
	  }

	  return arr2;
	}

	var arrayLikeToArray = _arrayLikeToArray$2;

	function _arrayWithoutHoles(arr) {
	  if (Array.isArray(arr)) return arrayLikeToArray(arr);
	}

	var arrayWithoutHoles = _arrayWithoutHoles;

	function _iterableToArray(iter) {
	  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter);
	}

	var iterableToArray = _iterableToArray;

	function _unsupportedIterableToArray$2(o, minLen) {
	  if (!o) return;
	  if (typeof o === "string") return arrayLikeToArray(o, minLen);
	  var n = Object.prototype.toString.call(o).slice(8, -1);
	  if (n === "Object" && o.constructor) n = o.constructor.name;
	  if (n === "Map" || n === "Set") return Array.from(o);
	  if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return arrayLikeToArray(o, minLen);
	}

	var unsupportedIterableToArray = _unsupportedIterableToArray$2;

	function _nonIterableSpread() {
	  throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
	}

	var nonIterableSpread = _nonIterableSpread;

	function _toConsumableArray(arr) {
	  return arrayWithoutHoles(arr) || iterableToArray(arr) || unsupportedIterableToArray(arr) || nonIterableSpread();
	}

	var toConsumableArray = _toConsumableArray;

	/*
	    Some utility/shared functions for the custom LogUI Event handlers, used by odo-bot.
	    
	    @author: Alex Ianta
	    @date: 2023-02-06

	*/

	/**
	 * A list of dom properties to log when including the root element in a custom event.
	 */
	var _root_dom_properties = ['outerHTML', 'outerText'];
	/**
	 * A list of dom properties to log when including an element in a custom event.
	 */

	var _dom_properties = ['xpath', 'URL', 'baseURI', 'attributes', 'childElementCount', 'id', 'className', 'localName', 'nodeName', 'offsetHeight', 'offsetWidth', 'title', 'tagName'];

	var _dom_properties_ext = [].concat(_dom_properties);

	_dom_properties_ext.push('outerHTML', 'outerText');
	/**
	 * An extended list of dom properties to log when including input elements in a custom event.
	 */


	var _dom_properties_input_ext = toConsumableArray(_dom_properties_ext);

	_dom_properties_input_ext.push('value', 'valueAsDate', 'valueAsNumber', 'willValidate');
	/**
	 * A function that computes the XPath of a given element
	 * https://stackoverflow.com/questions/3454526/how-to-calculate-the-xpath-position-of-an-element-using-javascript
	 */


	var getElementTreeXPath = function getElementTreeXPath(element) {
	  var paths = []; // Use nodeName (instead of localName) 
	  // so namespace prefix is included (if any).

	  for (; element && element.nodeType == Node.ELEMENT_NODE; element = element.parentNode) {
	    var index = 0;
	    var hasFollowingSiblings = false;

	    for (var sibling = element.previousSibling; sibling; sibling = sibling.previousSibling) {
	      // Ignore document type declaration.
	      if (sibling.nodeType == Node.DOCUMENT_TYPE_NODE) continue;
	      if (sibling.nodeName == element.nodeName) ++index;
	    }

	    for (var sibling = element.nextSibling; sibling && !hasFollowingSiblings; sibling = sibling.nextSibling) {
	      if (sibling.nodeName == element.nodeName) hasFollowingSiblings = true;
	    }

	    var tagName = (element.prefix ? element.prefix + ":" : "") + element.localName;
	    var pathIndex = index || hasFollowingSiblings ? "[" + (index + 1) + "]" : "";
	    paths.splice(0, 0, tagName + pathIndex);
	  }

	  return paths.length ? "/" + paths.join("/") : null;
	};

	function _createForOfIteratorHelper$2(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$3(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$3(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$3(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$3(o, minLen); }

	function _arrayLikeToArray$3(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var click = (function (root) {
	  var _handler = {};
	  _handler.browserEvents = ['click']; //This doesn't seem to matter...

	  _handler.init = function () {
	    return;
	  }; // Handle the click event


	  _handler.logUIEventCallback = function (eventContext, browserEvent, trackingConfig) {
	    // get elements whose listeners will be invoked from the browser event as it bubbles
	    // https://developer.mozilla.org/en-US/docs/Web/API/Event/composedPath
	    var eventPath = browserEvent.composedPath(); //Let's compute xpaths for each element

	    var _iterator = _createForOfIteratorHelper$2(eventPath),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var element = _step.value;
	        var element_xpath = getElementTreeXPath(element);

	        if (element_xpath !== null) {
	          //Don't bother inserting the field in elements without an xpath
	          element['xpath'] = getElementTreeXPath(element);
	        }
	      } // Get the last element on the eventPath (which should be the html tag)
	      // and include its outerHTML as a snapshot of the DOM at this time. 

	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }

	    var rootElement = eventPath.find(function (e) {
	      return e.localName === 'html';
	    });
	    var returnObject = {
	      type: browserEvent.type,
	      xpath: getElementTreeXPath(browserEvent.target),
	      element: JSON.stringify(eventPath[0], _dom_properties_ext),
	      domSnapshot: JSON.stringify(rootElement, _root_dom_properties)
	    };

	    if (trackingConfig.hasOwnProperty('name')) {
	      returnObject.name = trackingConfig.name;
	    }

	    return returnObject;
	  };

	  return _handler;
	})();

	var _click = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': click
	});

	/*
	    LogUI Client Library
	    Metadata Sourcers / DOM Element Attribute Sourcer

	    An IIFE function yielding a module for extracting attribute values from a given DOM element.

	    @module: DOM Element Attribute Sourcer Module
	    @author: David Maxwell
	    @date: 2021-03-05
	*/
	var elementAttribute = (function (root) {
	  var _sourcer = {};

	  _sourcer.init = function () {};

	  _sourcer.stop = function () {};

	  _sourcer.getObject = function (element, request) {
	    var value = _sourcer.getValue(element, request);

	    if (value) {
	      return {
	        name: request.nameForLog,
	        value: value
	      };
	    }

	    return undefined;
	  };

	  _sourcer.getValue = function (element, request) {
	    if (request.hasOwnProperty('lookFor')) {
	      if (element.hasAttribute(request.lookFor)) {
	        return element.getAttribute(request.lookFor);
	      }
	    }

	    return undefined;
	  };

	  return _sourcer;
	})();

	var _elementAttribute = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': elementAttribute
	});

	/*
	    LogUI Client Library
	    Metadata Sourcers / DOM Element Property Sourcer

	    An IIFE function yielding a module for extracting property values from a given DOM element.

	    @module: DOM Element Property Sourcer Module
	    @author: David Maxwell
	    @date: 2021-03-25
	*/
	var elementProperty = (function (root) {
	  var _sourcer = {};

	  _sourcer.init = function () {};

	  _sourcer.stop = function () {};

	  _sourcer.getObject = function (element, request) {
	    var value = _sourcer.getValue(element, request);

	    if (value) {
	      return {
	        name: request.nameForLog,
	        value: value
	      };
	    }

	    return undefined;
	  };

	  _sourcer.getValue = function (element, request) {
	    if (request.hasOwnProperty('lookFor')) {
	      if (request.hasOwnProperty('onElement')) {
	        var selectedElement = Helpers.$(request.onElement);

	        if (!selectedElement) {
	          // The element specified does not exist in the DOM.
	          return;
	        }

	        if (selectedElement[request.lookFor]) {
	          return selectedElement[request.lookFor];
	        }

	        return;
	      }

	      if (element[request.lookFor]) {
	        return element[request.lookFor];
	      }
	    }

	    return undefined;
	  };

	  return _sourcer;
	})();

	var _elementProperty = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': elementProperty
	});

	/*
	    LogUI Client Library
	    Metadata Sourcers / LocalStorage Sourcer

	    An IIFE function yielding a module for extracting data from localStorage.

	    @module: LocalStorage Sourcer Module
	    @author: David Maxwell
	    @date: 2021-03-05
	*/
	var localStorage$1 = (function (root) {
	  var _sourcer = {};

	  _sourcer.init = function () {};

	  _sourcer.stop = function () {};

	  _sourcer.getObject = function (element, request) {
	    var value = _sourcer.getValue(element, request);

	    if (value) {
	      return {
	        name: request.nameForLog,
	        value: value
	      };
	    }

	    return undefined;
	  };

	  _sourcer.getValue = function (element, request) {
	    if (request.hasOwnProperty('lookFor')) {
	      return localStorage.getItem(request.lookFor);
	    }

	    return undefined;
	  };

	  return _sourcer;
	})();

	var _localStorage = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': localStorage$1
	});

	/*
	    LogUI Client Library
	    Metadata Sourcers / React Component Prop Sourcer

	    An IIFE function yielding a module for extracting prop data from a React component.

	    @module: React Component Prop Sourcer Module
	    @author: David Maxwell
	    @date: 2021-03-05
	*/
	var reactComponentProp = (function (root) {
	  var _sourcer = {};

	  _sourcer.init = function () {};

	  _sourcer.stop = function () {};

	  _sourcer.getObject = function (element, request) {
	    var value = _sourcer.getValue(element, request);

	    if (value) {
	      return {
	        name: request.nameForLog,
	        value: value
	      };
	    }

	    return undefined;
	  };

	  _sourcer.getValue = function (element, request) {
	    for (var key in element) {
	      if (key.startsWith('__reactFiber')) {
	        var propsObject = element[key]._debugOwner.stateNode.props;

	        if (propsObject.hasOwnProperty(request.lookFor)) {
	          return propsObject[request.lookFor];
	        }
	      }
	    }

	    return undefined;
	  };

	  return _sourcer;
	})();

	var _reactComponentProp = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': reactComponentProp
	});

	/*
	    LogUI Client Library
	    Metadata Sourcers / React Component State Sourcer

	    An IIFE function yielding a module for extracting state data from a React component.

	    @module: React Component State Sourcer Module
	    @author: David Maxwell
	    @date: 2021-03-05
	*/
	var reactComponentState = (function (root) {
	  var _sourcer = {};

	  _sourcer.init = function () {};

	  _sourcer.stop = function () {};

	  _sourcer.getObject = function (element, request) {
	    var value = _sourcer.getValue(element, request);

	    if (value) {
	      return {
	        name: request.nameForLog,
	        value: value
	      };
	    }

	    return undefined;
	  };

	  _sourcer.getValue = function (element, request) {
	    for (var key in element) {
	      if (key.startsWith('__reactFiber')) {
	        var stateObject = element[key]._debugOwner.stateNode.state;

	        if (stateObject.hasOwnProperty(request.lookFor)) {
	          return stateObject[request.lookFor];
	        }
	      }
	    }

	    return undefined;
	  };

	  return _sourcer;
	})();

	var _reactComponentState = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': reactComponentState
	});

	/*
	    LogUI Client Library
	    Metadata Sourcers / SessionStorage Sourcer

	    An IIFE function yielding a module for extracting data from the SessionStorage object.

	    @module: SessionStorage Sourcer Module
	    @author: David Maxwell
	    @date: 2021-03-05
	*/
	var sessionStorage$1 = (function (root) {
	  var _sourcer = {};

	  _sourcer.init = function () {};

	  _sourcer.stop = function () {};

	  _sourcer.getObject = function (element, request) {
	    var value = _sourcer.getValue(element, request);

	    if (value) {
	      return {
	        name: request.nameForLog,
	        value: value
	      };
	    }

	    return undefined;
	  };

	  _sourcer.getValue = function (element, request) {
	    if (request.hasOwnProperty('lookFor')) {
	      return sessionStorage.getItem(request.lookFor);
	    }

	    return undefined;
	  };

	  return _sourcer;
	})();

	var _sessionStorage = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': sessionStorage$1
	});

	function _createForOfIteratorHelper$3(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$4(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$4(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$4(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$4(o, minLen); }

	function _arrayLikeToArray$4(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

	var _dirImport = {};

	for (var _key5 in _sessionStorage) {
	  _dirImport[_key5 === 'default' ? "sessionStorage" : _key5] = _sessionStorage[_key5];
	}

	for (var _key4 in _reactComponentState) {
	  _dirImport[_key4 === 'default' ? "reactComponentState" : _key4] = _reactComponentState[_key4];
	}

	for (var _key3 in _reactComponentProp) {
	  _dirImport[_key3 === 'default' ? "reactComponentProp" : _key3] = _reactComponentProp[_key3];
	}

	for (var _key2 in _localStorage) {
	  _dirImport[_key2 === 'default' ? "localStorage" : _key2] = _localStorage[_key2];
	}

	for (var _key in _elementProperty) {
	  _dirImport[_key === 'default' ? "elementProperty" : _key] = _elementProperty[_key];
	}

	for (var key in _elementAttribute) {
	  _dirImport[key === 'default' ? "elementAttribute" : key] = _elementAttribute[key];
	}

	var Sourcers = _dirImport;
	var MetadataHandler = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    for (var sourcer in Sourcers) {
	      Sourcers[sourcer].init();
	    }

	    return true;
	  };

	  _public.stop = function () {
	    for (var sourcerName in Sourcers) {
	      var sourcer = Sourcers[sourcerName];

	      if (sourcer.hasOwnProperty('stop')) {
	        sourcer.stop();
	      }
	    }
	  };

	  _public.getMetadataValue = function (element, entryConfig) {
	    var selectedSourcer = getSourcer(entryConfig.sourcer);

	    if (!selectedSourcer) {
	      return;
	    }

	    if (!entryConfig.hasOwnProperty('nameForLog') || !entryConfig.hasOwnProperty('lookFor')) {
	      return;
	    }

	    return selectedSourcer.getObject(element, entryConfig);
	  };

	  _public.getMetadata = function (element, trackingConfig) {
	    var returnArray = [];
	    var observedNames = [];

	    if (trackingConfig.hasOwnProperty('metadata')) {
	      var _iterator = _createForOfIteratorHelper$3(trackingConfig.metadata),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var entry = _step.value;

	          var objectToPush = _public.getMetadataValue(element, entry);

	          if (observedNames.includes(entry.nameForLog)) {
	            continue;
	          }

	          if (objectToPush) {
	            returnArray.push(objectToPush);
	            observedNames.push(entry.nameForLog);
	          }
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }

	    return returnArray;
	  };

	  var getSourcer = function getSourcer(requestedSourcerName) {
	    for (var sourcerName in Sourcers) {
	      if (sourcerName == requestedSourcerName) {
	        return Sourcers[sourcerName];
	      }
	    }

	    return undefined;
	  };

	  return _public;
	})();

	function _createForOfIteratorHelper$4(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$5(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$5(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$5(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$5(o, minLen); }

	function _arrayLikeToArray$5(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var formSubmission = (function (root) {
	  var _handler = {};
	  _handler.browserEvents = ['submit'];

	  _handler.init = function () {
	    return;
	  };

	  _handler.logUIEventCallback = function (eventContext, browserEvent, trackingConfig) {
	    var customName = trackingConfig.name;
	    var formElementValues = getFormElementValue(trackingConfig);
	    var returnObject = {
	      type: browserEvent.type
	    };
	    console.log(customName);

	    if (customName) {
	      returnObject.name = customName;
	    }

	    if (formElementValues.length > 0) {
	      returnObject.submissionValues = formElementValues;
	    }

	    return returnObject;
	  };

	  var getFormElementValue = function getFormElementValue(trackingConfig) {
	    var trackingConfigProperties = trackingConfig.properties;
	    var returnArray = [];
	    var observedNames = [];

	    if (trackingConfigProperties && trackingConfigProperties.hasOwnProperty('includeValues')) {
	      var _iterator = _createForOfIteratorHelper$4(trackingConfigProperties.includeValues),
	          _step;

	      try {
	        for (_iterator.s(); !(_step = _iterator.n()).done;) {
	          var entry = _step.value;
	          var element = Helpers.$(entry.selector);

	          if (!element) {
	            continue;
	          }

	          var returnedObject = MetadataHandler.getMetadataValue(element, entry);

	          if (!returnedObject) {
	            continue;
	          }

	          if (observedNames.includes(entry.nameForLog)) {
	            continue;
	          }

	          observedNames.push(entry.nameForLog);
	          returnArray.push(returnedObject);
	        }
	      } catch (err) {
	        _iterator.e(err);
	      } finally {
	        _iterator.f();
	      }
	    }

	    return returnArray;
	  };

	  return _handler;
	})();

	var _formSubmission = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': formSubmission
	});

	/*
	 Custom LogUI Event Handler

	 Captures additional dom details when an input event is triggered

	 @module: Input Event Handler
	 @author: Alex Ianta
	 @date: 2023-02-06
	*/
	var input = (function (root) {
	  var _handler = {};
	  _handler.browserEvents = ['input'];

	  _handler.init = function () {
	    return;
	  }; //Handle the input event


	  _handler.logUIEventCallback = function (eventContext, browserEvent, trackingConfig) {
	    //Get the root element
	    var rootElement = browserEvent.composedPath().find(function (e) {
	      return e.localName === 'html';
	    }); //Get the ValidityState object
	    //https://developer.mozilla.org/en-US/docs/Web/API/ValidityState

	    var validityState = browserEvent.target.validity;
	    var returnObject = {
	      type: browserEvent.type,
	      xpath: getElementTreeXPath(browserEvent.target),
	      element: JSON.stringify(browserEvent.target, _dom_properties_ext),
	      //The actual input element should include extended properties.
	      domSnapshot: JSON.stringify(rootElement, _root_dom_properties),
	      validity_badInput: validityState.badInput,
	      validity_customError: validityState.customError,
	      validity_patternMismatch: validityState.patternMismatch,
	      validity_rangeOverflow: validityState.rangeOverflow,
	      validity_rangeUnderflow: validityState.rangeUnderflow,
	      validity_stepMismatch: validityState.stepMismatch,
	      validity_tooLong: validityState.tooLong,
	      validity_tooShort: validityState.tooShort,
	      validity_typeMismatch: validityState.typeMismatch,
	      validity_valid: validityState.valid,
	      validity_valueMissing: validityState.valueMissing
	    };

	    if (trackingConfig.hasOwnProperty('name')) {
	      returnObject.name = trackingConfig.name;
	    }

	    return returnObject;
	  };

	  return _handler;
	})();

	var _input = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': input
	});

	/*
	    LogUI Client Library
	    Event Handlers / Mouse Click Group Event

	    A IIFE function yielding a generic mouse click event.

	    @module: Mouse Click Event Handler
	    @author: David Maxwell
	    @date: 2021-05-05
	*/
	RequiredFeatures.addFeature('WeakMap');
	var mouseClick = (function (root) {
	  var _handler = {};
	  var _currentMouseOver = null;
	  _handler.browserEvents = ['mousedown', 'mouseup'];

	  _handler.init = function () {
	    _currentMouseOver = new WeakMap();
	    return;
	  };

	  _handler.stop = function () {
	    _currentMouseOver = null;
	  };

	  _handler.logUIEventCallback = function (eventContext, browserEvent, trackingConfig) {
	    if (browserEvent.type == 'mousedown') {
	      _currentMouseOver.set(eventContext, browserEvent.timeStamp);
	    }

	    if (browserEvent.type == 'mouseup') {
	      if (_currentMouseOver.has(eventContext)) {
	        var difference = browserEvent.timeStamp - _currentMouseOver.get(eventContext);

	        var button = browserEvent.button;
	        var properties = getButtonConfig(trackingConfig, button);

	        if (!properties) {
	          // If no properties are specified, we ignore the event.
	          return;
	        } // If we get here, we should log this event.
	        // Construct the returnObject, and send it back. This gets sent to the EventPackager.


	        var returnObject = {};
	        returnObject['clickDuration'] = difference;
	        returnObject['type'] = 'mouseClick';
	        returnObject['button'] = properties.mapping;

	        if ('name' in properties) {
	          returnObject['name'] = properties.name;
	        }

	        _currentMouseOver["delete"](eventContext);

	        return returnObject;
	      }
	    }
	  };

	  var getButtonConfig = function getButtonConfig(trackingConfig, button) {
	    // Given a button number (0, 1, 2...), return the properties for that button.
	    // Mappings: primary (0), auxiliary (1), secondary (2)
	    if (!trackingConfig.properties) {
	      // No properties object was found for the given configuration.
	      return;
	    }

	    var mapping = {
	      0: 'primary',
	      1: 'auxiliary',
	      2: 'secondary',
	      3: 'auxiliary2',
	      4: 'auxiliary3'
	    };

	    if (!(button in mapping)) {
	      // The button ID clicked doesn't have a mapping in the object above.
	      return;
	    }

	    if (!trackingConfig.properties[mapping[button]]) {
	      // No configuration was found for the given mapping (e.g., no primary, auxiliary, secondary).
	      return;
	    }

	    trackingConfig.properties[mapping[button]].mapping = mapping[button];
	    return trackingConfig.properties[mapping[button]];
	  };

	  return _handler;
	})();

	var _mouseClick = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': mouseClick
	});

	/*
	    LogUI Client Library
	    Event Handlers / Mouse Hover Group Event

	    A IIFE function yielding a mouse hover event.

	    @module: Mouse Hover Event Handler
	    @author: David Maxwell
	    @date: 2020-10-06
	*/
	var mouseHover = (function (root) {
	  var _handler = {};
	  _handler.browserEvents = ['mouseenter', 'mouseleave'];

	  _handler.init = function () {
	    return;
	  };

	  _handler.logUIEventCallback = function (eventContext, browserEvent, trackingConfig) {
	    var customName = getEventName(trackingConfig, browserEvent.type);
	    var returnObject = {
	      type: browserEvent.type
	    };

	    if (customName) {
	      returnObject.name = customName;
	    }

	    return returnObject;
	  };

	  var getEventName = function getEventName(trackingConfig, eventName) {
	    var trackingConfigProperties = trackingConfig.properties;

	    if (trackingConfigProperties && trackingConfigProperties.hasOwnProperty(eventName) && trackingConfigProperties[eventName].hasOwnProperty('name')) {
	      return trackingConfigProperties[eventName].name;
	    }

	    return undefined;
	  };

	  return _handler;
	})();

	var _mouseHover = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': mouseHover
	});

	/*
	    LogUI Client Library
	    Event Handlers / Sample Event Handler

	    A IIFE function returning a sample event handler.
	    Copy and paste this module to create your own handler.

	    @module: Sample Event Handlers
	    @author: David Maxwell
	    @date: 2020-10-06
	*/
	RequiredFeatures.addFeature('IntersectionObserver');
	var sampleEventHandler = (function (root) {
	  var _handler = {};

	  _handler.init = function () {
	    return;
	  };

	  _handler.callback = function (browserEvent, trackingConfig) {
	    return true;
	  };

	  return _handler;
	})();

	var _sampleEventHandler = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': sampleEventHandler
	});

	/*
	    LogUI Client Library
	    Event Packager Module

	    An IIFE function returning the predispatching phase of LogUI.
	    Handles the collection of data from a variety of sources, packages it up into an object, and sends it to the dispatcher.

	    @module: Event Packager Module
	    @author: David Maxwell
	    @date: 2021-02-24
	*/
	var EventPackager = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    return true;
	  };

	  _public.stop = function () {};

	  _public.packageInteractionEvent = function (element, eventDetails, trackingConfig) {
	    var packageObject = getBasicPackageObject();
	    packageObject.eventType = 'interactionEvent';
	    packageObject.eventDetails = eventDetails;
	    packageObject.metadata = MetadataHandler.getMetadata(element, trackingConfig);
	    Dispatcher.sendObject(packageObject);
	  };

	  _public.packageCustomEvent = function (eventDetails) {
	    var packageObject = getBasicPackageObject();
	    packageObject.eventType = 'customEvent';
	    packageObject.eventDetails = eventDetails;
	    /**
	     * @author Alexandru Ianta
	     * For odo sight, when network events are captured as custom events, we want to make sure
	     * the network event timestamp is the timestamp being used as the eventTimestamp. 
	     * Ideally these would both be the same or very similar, but when something like
	     * a POST request is made just before the page unloads, LogUI will lose that event
	     * because it will unload from the page before the network request can be captured. 
	     * Odo-sight will send the network event to LogUI again once it is re-loaded on the 
	     * next page, but at this point sinificant amounts of time have passed. So to keep events
	     * ordered properly, for network request events, we overwrite timestamps.eventTimestamp 
	     * with the one provided in the eventDetails. 
	     * 
	     */

	    if (eventDetails.name === 'NETWORK_EVENT' && eventDetails.timeStamp !== undefined) {
	      packageObject.timestamps.eventTimestamp = new Date(eventDetails.timeStamp);
	    }

	    Dispatcher.sendObject(packageObject);
	  };

	  _public.packageBrowserEvent = function (eventDetails) {
	    var packageObject = getBasicPackageObject();
	    packageObject.eventType = 'browserEvent';
	    packageObject.eventDetails = eventDetails;
	    Dispatcher.sendObject(packageObject);
	  };

	  _public.packageStatusEvent = function (eventDetails) {
	    var packageObject = getBasicPackageObject();
	    packageObject.eventType = 'statusEvent';
	    packageObject.eventDetails = eventDetails;
	    Dispatcher.sendObject(packageObject);
	  };

	  var getBasicPackageObject = function getBasicPackageObject() {
	    var currentTimestamp = new Date();
	    var sessionStartTimestamp = Config.sessionData.getSessionStartTimestamp();
	    var libraryStartTimestamp = Config.sessionData.getLibraryStartTimestamp();
	    return {
	      eventType: null,
	      eventDetails: {},
	      sessionID: Config.sessionData.getSessionIDKey(),
	      timestamps: {
	        eventTimestamp: currentTimestamp,
	        sinceSessionStartMillis: currentTimestamp - sessionStartTimestamp,
	        sinceLogUILoadMillis: currentTimestamp - libraryStartTimestamp
	      },
	      applicationSpecificData: Config.applicationSpecificData.get()
	    };
	  };

	  return _public;
	})();

	function _createForOfIteratorHelper$5(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$6(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$6(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$6(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$6(o, minLen); }

	function _arrayLikeToArray$6(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	RequiredFeatures.addFeature('WeakMap');
	var DELAY_TIME = 50;
	var scrollable = (function (root) {
	  var _handler = {};
	  var tracking = null;
	  var globalHandles = null;
	  _handler.browserEvents = ['scroll'];

	  _handler.init = function () {
	    tracking = new WeakMap();
	    globalHandles = []; // Keep track of all handles for when this event handler is stopped.

	    return;
	  };

	  _handler.stop = function () {
	    var _iterator = _createForOfIteratorHelper$5(globalHandles),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var handleID = _step.value;
	        clearTimeout(handleID);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }

	    tracking = null;
	    globalHandles = null;
	  };

	  _handler.logUIEventCallback = function (eventContext, browserEvent, trackingConfig) {
	    var element = eventContext; // If tracking has the element in question, we know there's already a queue. So we should add to it.
	    // We shouldn't log here, as the queue is non-zero. So we add to it, and simply return.

	    if (tracking.has(element)) {
	      var existing = tracking.get(element);

	      var _handle = setTimeout(function () {
	        endScrollEvent(element, _handle);
	      }, DELAY_TIME);

	      globalHandles.push(_handle);
	      existing['handles'].push(_handle);
	      tracking.set(element, existing);
	      return;
	    } // If we get here, we know that the element has not yet been tracked.
	    // We can create the necessary data structure to track its scrolling interactions, and fire off an event for the start of scrolling.


	    var handle = setTimeout(function () {
	      endScrollEvent(element, handle);
	    }, DELAY_TIME);
	    globalHandles.push(handle);
	    var mappedObject = {
	      handles: [handle],
	      eventContext: eventContext,
	      trackingConfig: trackingConfig
	    };
	    tracking.set(element, mappedObject);
	    var returnObject = {
	      type: 'scrollStart'
	    };
	    var eventName = getEventName(trackingConfig, 'scrollStart');

	    if (eventName) {
	      returnObject['name'] = eventName;
	    }

	    return returnObject;
	  };

	  var endScrollEvent = function endScrollEvent(element, handle) {
	    if (tracking.has(element)) {
	      var trackedElementDetails = tracking.get(element);
	      var i = trackedElementDetails['handles'].indexOf(handle); // The timeout for the given handle has been met; remove it from the array of current timeout handles on this element.

	      trackedElementDetails['handles'].splice(i, 1); // Make sure we remove the entry from globalHandles, too!
	      // Re-use i here. We don't need it.

	      i = globalHandles.indexOf(handle);
	      globalHandles.splice(i, 1); // If the array has reached a length of zero, there are no more pending timeouts to remove.
	      // In this instance, the scroll event has been completed; remove from the tracking WeakMap and tell the Event Packager to package up a scroll complete.
	      // Using EventPackager here is J-A-N-K-Y -- in a future revision, it would be good to send it back to the EventCallbackHandler and tell that to package up.
	      // This feels like I'm cheating a little bit :-( Future self: we need EventCallbackHandler to handle asynchronous events being fired in.

	      if (trackedElementDetails['handles'].length == 0) {
	        tracking["delete"](element);
	        var returnObject = {
	          type: 'scrollEnd'
	        };
	        var eventName = getEventName(trackedElementDetails['trackingConfig'], 'scrollEnd');

	        if (eventName) {
	          returnObject['name'] = eventName;
	        } // This is hacky. This should not be called here. This should be like an async callback to the EventCallbackHandler.


	        EventPackager.packageInteractionEvent(element, returnObject, trackedElementDetails['trackingConfig']);
	      }
	    }

	    return;
	  };

	  var getEventName = function getEventName(trackingConfig, eventName) {
	    var trackingConfigProperties = trackingConfig.properties;

	    if (trackingConfigProperties && trackingConfigProperties.hasOwnProperty(eventName) && trackingConfigProperties[eventName].hasOwnProperty('name')) {
	      return trackingConfigProperties[eventName].name;
	    }

	    return undefined;
	  };

	  return _handler;
	})();

	var _scrollable = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': scrollable
	});

	/*
	    LogUI Client Library
	    Event Handlers Controller Module

	    A IIFE function yielding the event handler controller.
	    Provides access to custom event handlers and built-in basic handlers.

	    @module: Event Handler Controller
	    @author: David Maxwell
	    @date: 2020-09-21
	*/
	var _dirImport$1 = {};

	for (var _key6 in _scrollable) {
	  _dirImport$1[_key6 === 'default' ? "scrollable" : _key6] = _scrollable[_key6];
	}

	for (var _key5$1 in _sampleEventHandler) {
	  _dirImport$1[_key5$1 === 'default' ? "sampleEventHandler" : _key5$1] = _sampleEventHandler[_key5$1];
	}

	for (var _key4$1 in _mouseHover) {
	  _dirImport$1[_key4$1 === 'default' ? "mouseHover" : _key4$1] = _mouseHover[_key4$1];
	}

	for (var _key3$1 in _mouseClick) {
	  _dirImport$1[_key3$1 === 'default' ? "mouseClick" : _key3$1] = _mouseClick[_key3$1];
	}

	for (var _key2$1 in _input) {
	  _dirImport$1[_key2$1 === 'default' ? "input" : _key2$1] = _input[_key2$1];
	}

	for (var _key$1 in _formSubmission) {
	  _dirImport$1[_key$1 === 'default' ? "formSubmission" : _key$1] = _formSubmission[_key$1];
	}

	for (var key$1 in _click) {
	  _dirImport$1[key$1 === 'default' ? "click" : key$1] = _click[key$1];
	}

	var ImportedEventHandlers = _dirImport$1;
	var EventHandlerController = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    for (var eventHandler in ImportedEventHandlers) {
	      if (ImportedEventHandlers[eventHandler].hasOwnProperty('init')) {
	        ImportedEventHandlers[eventHandler].init();
	      }
	    }

	    return true;
	  };

	  _public.stop = function () {
	    for (var eventHandler in ImportedEventHandlers) {
	      if (ImportedEventHandlers[eventHandler].hasOwnProperty('stop')) {
	        ImportedEventHandlers[eventHandler].stop();
	      }
	    }
	  };

	  _public.eventHandlers = ImportedEventHandlers;

	  _public.getEventHandler = function (eventName) {
	    if (ImportedEventHandlers.hasOwnProperty(eventName)) {
	      return ImportedEventHandlers[eventName];
	    }

	    return false;
	  };

	  _public.getEventHandlerEvents = function (eventName) {
	    if (ImportedEventHandlers.hasOwnProperty(eventName)) {
	      if (ImportedEventHandlers[eventName].hasOwnProperty('browserEvents')) {
	        return ImportedEventHandlers[eventName]['browserEvents'];
	      } else {
	        Helpers.console("The event handler '".concat(eventName, "' does not have the required property 'browserEvents'."), 'Initialisation', true);
	        return false;
	      }
	    }

	    return undefined;
	  };

	  return _public;
	})();

	// Calculate the specificity for a selector by dividing it into simple selectors and counting them
	/**
	 * Calculates the specificity of CSS selectors
	 * http://www.w3.org/TR/css3-selectors/#specificity
	 *
	 * Returns an object with the following properties:
	 *  - selector: the input
	 *  - specificity: e.g. 0,1,0,0
	 *  - parts: array with details about each part of the selector that counts towards the specificity
	 *  - specificityArray: e.g. [0, 1, 0, 0]
	 */


	var calculateSingle = function (input) {
	  var selector = input,
	      findMatch,
	      typeCount = {
	    'a': 0,
	    'b': 0,
	    'c': 0
	  },
	      parts = [],
	      // The following regular expressions assume that selectors matching the preceding regular expressions have been removed
	  attributeRegex = /(\[[^\]]+\])/g,
	      idRegex = /(#[^\#\s\+>~\.\[:\)]+)/g,
	      classRegex = /(\.[^\s\+>~\.\[:\)]+)/g,
	      pseudoElementRegex = /(::[^\s\+>~\.\[:]+|:first-line|:first-letter|:before|:after)/gi,
	      // A regex for pseudo classes with brackets - :nth-child(), :nth-last-child(), :nth-of-type(), :nth-last-type(), :lang()
	  // The negation psuedo class (:not) is filtered out because specificity is calculated on its argument
	  // :global and :local are filtered out - they look like psuedo classes but are an identifier for CSS Modules
	  pseudoClassWithBracketsRegex = /(:(?!not|global|local)[\w-]+\([^\)]*\))/gi,
	      // A regex for other pseudo classes, which don't have brackets
	  pseudoClassRegex = /(:(?!not|global|local)[^\s\+>~\.\[:]+)/g,
	      elementRegex = /([^\s\+>~\.\[:]+)/g; // Find matches for a regular expression in a string and push their details to parts
	  // Type is "a" for IDs, "b" for classes, attributes and pseudo-classes and "c" for elements and pseudo-elements

	  findMatch = function (regex, type) {
	    var matches, i, len, match, index, length;

	    if (regex.test(selector)) {
	      matches = selector.match(regex);

	      for (i = 0, len = matches.length; i < len; i += 1) {
	        typeCount[type] += 1;
	        match = matches[i];
	        index = selector.indexOf(match);
	        length = match.length;
	        parts.push({
	          selector: input.substr(index, length),
	          type: type,
	          index: index,
	          length: length
	        }); // Replace this simple selector with whitespace so it won't be counted in further simple selectors

	        selector = selector.replace(match, Array(length + 1).join(' '));
	      }
	    }
	  }; // Replace escaped characters with plain text, using the "A" character
	  // https://www.w3.org/TR/CSS21/syndata.html#characters


	  (function () {
	    var replaceWithPlainText = function (regex) {
	      var matches, i, len, match;

	      if (regex.test(selector)) {
	        matches = selector.match(regex);

	        for (i = 0, len = matches.length; i < len; i += 1) {
	          match = matches[i];
	          selector = selector.replace(match, Array(match.length + 1).join('A'));
	        }
	      }
	    },
	        // Matches a backslash followed by six hexadecimal digits followed by an optional single whitespace character
	    escapeHexadecimalRegex = /\\[0-9A-Fa-f]{6}\s?/g,
	        // Matches a backslash followed by fewer than six hexadecimal digits followed by a mandatory single whitespace character
	    escapeHexadecimalRegex2 = /\\[0-9A-Fa-f]{1,5}\s/g,
	        // Matches a backslash followed by any character
	    escapeSpecialCharacter = /\\./g;

	    replaceWithPlainText(escapeHexadecimalRegex);
	    replaceWithPlainText(escapeHexadecimalRegex2);
	    replaceWithPlainText(escapeSpecialCharacter);
	  })(); // Remove anything after a left brace in case a user has pasted in a rule, not just a selector


	  (function () {
	    var regex = /{[^]*/gm,
	        matches,
	        i,
	        len,
	        match;

	    if (regex.test(selector)) {
	      matches = selector.match(regex);

	      for (i = 0, len = matches.length; i < len; i += 1) {
	        match = matches[i];
	        selector = selector.replace(match, Array(match.length + 1).join(' '));
	      }
	    }
	  })(); // Add attribute selectors to parts collection (type b)


	  findMatch(attributeRegex, 'b'); // Add ID selectors to parts collection (type a)

	  findMatch(idRegex, 'a'); // Add class selectors to parts collection (type b)

	  findMatch(classRegex, 'b'); // Add pseudo-element selectors to parts collection (type c)

	  findMatch(pseudoElementRegex, 'c'); // Add pseudo-class selectors to parts collection (type b)

	  findMatch(pseudoClassWithBracketsRegex, 'b');
	  findMatch(pseudoClassRegex, 'b'); // Remove universal selector and separator characters

	  selector = selector.replace(/[\*\s\+>~]/g, ' '); // Remove any stray dots or hashes which aren't attached to words
	  // These may be present if the user is live-editing this selector

	  selector = selector.replace(/[#\.]/g, ' '); // Remove the negation psuedo-class (:not) but leave its argument because specificity is calculated on its argument
	  // Remove non-standard :local and :global CSS Module identifiers because they do not effect the specificity

	  selector = selector.replace(/:not/g, '    ');
	  selector = selector.replace(/:local/g, '      ');
	  selector = selector.replace(/:global/g, '       ');
	  selector = selector.replace(/[\(\)]/g, ' '); // The only things left should be element selectors (type c)

	  findMatch(elementRegex, 'c'); // Order the parts in the order they appear in the original selector
	  // This is neater for external apps to deal with

	  parts.sort(function (a, b) {
	    return a.index - b.index;
	  });
	  return {
	    selector: input,
	    specificity: '0,' + typeCount.a.toString() + ',' + typeCount.b.toString() + ',' + typeCount.c.toString(),
	    specificityArray: [0, typeCount.a, typeCount.b, typeCount.c],
	    parts: parts
	  };
	};
	/**
	 * Compares two CSS selectors for specificity
	 * Alternatively you can replace one of the CSS selectors with a specificity array
	 *
	 *  - it returns -1 if a has a lower specificity than b
	 *  - it returns 1 if a has a higher specificity than b
	 *  - it returns 0 if a has the same specificity than b
	 */


	var compare = function (a, b) {
	  var aSpecificity, bSpecificity, i;

	  if (typeof a === 'string') {
	    if (a.indexOf(',') !== -1) {
	      throw 'Invalid CSS selector';
	    } else {
	      aSpecificity = calculateSingle(a)['specificityArray'];
	    }
	  } else if (Array.isArray(a)) {
	    if (a.filter(function (e) {
	      return typeof e === 'number';
	    }).length !== 4) {
	      throw 'Invalid specificity array';
	    } else {
	      aSpecificity = a;
	    }
	  } else {
	    throw 'Invalid CSS selector or specificity array';
	  }

	  if (typeof b === 'string') {
	    if (b.indexOf(',') !== -1) {
	      throw 'Invalid CSS selector';
	    } else {
	      bSpecificity = calculateSingle(b)['specificityArray'];
	    }
	  } else if (Array.isArray(b)) {
	    if (b.filter(function (e) {
	      return typeof e === 'number';
	    }).length !== 4) {
	      throw 'Invalid specificity array';
	    } else {
	      bSpecificity = b;
	    }
	  } else {
	    throw 'Invalid CSS selector or specificity array';
	  }

	  for (i = 0; i < 4; i += 1) {
	    if (aSpecificity[i] < bSpecificity[i]) {
	      return -1;
	    } else if (aSpecificity[i] > bSpecificity[i]) {
	      return 1;
	    }
	  }

	  return 0;
	};

	function _createForOfIteratorHelper$6(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$7(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$7(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$7(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$7(o, minLen); }

	function _arrayLikeToArray$7(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var DOMHandlerHelpers = (function (root) {
	  var _public = {};
	  _public.generators = {
	    trackingConfig: /*#__PURE__*/regenerator.mark(function trackingConfig() {
	      var trackingConfig, groupName, groupObject;
	      return regenerator.wrap(function trackingConfig$(_context) {
	        while (1) {
	          switch (_context.prev = _context.next) {
	            case 0:
	              trackingConfig = Config.elementTrackingConfig.get();
	              _context.t0 = regenerator.keys(trackingConfig);

	            case 2:
	              if ((_context.t1 = _context.t0()).done) {
	                _context.next = 12;
	                break;
	              }

	              groupName = _context.t1.value;
	              groupObject = {
	                name: groupName,
	                selector: trackingConfig[groupName].selector,
	                event: trackingConfig[groupName].event,
	                selectedElements: Helpers.$$(trackingConfig[groupName].selector),
	                eventsList: getEventsList(trackingConfig[groupName].event)
	              };

	              if (groupObject.eventsList) {
	                _context.next = 8;
	                break;
	              }

	              Helpers.console("Skipping group '".concat(groupName, "'"), 'Initialisation', true);
	              return _context.abrupt("continue", 2);

	            case 8:
	              _context.next = 10;
	              return groupObject;

	            case 10:
	              _context.next = 2;
	              break;

	            case 12:
	            case "end":
	              return _context.stop();
	          }
	        }
	      }, trackingConfig);
	    }),
	    uniqueElements: /*#__PURE__*/regenerator.mark(function uniqueElements() {
	      var observed, _iterator, _step, groupObject, _iterator2, _step2, element;

	      return regenerator.wrap(function uniqueElements$(_context2) {
	        while (1) {
	          switch (_context2.prev = _context2.next) {
	            case 0:
	              observed = new Map();
	              _iterator = _createForOfIteratorHelper$6(_public.generators.trackingConfig());
	              _context2.prev = 2;

	              _iterator.s();

	            case 4:
	              if ((_step = _iterator.n()).done) {
	                _context2.next = 28;
	                break;
	              }

	              groupObject = _step.value;
	              _iterator2 = _createForOfIteratorHelper$6(groupObject.selectedElements);
	              _context2.prev = 7;

	              _iterator2.s();

	            case 9:
	              if ((_step2 = _iterator2.n()).done) {
	                _context2.next = 18;
	                break;
	              }

	              element = _step2.value;

	              if (!observed.has(element)) {
	                _context2.next = 13;
	                break;
	              }

	              return _context2.abrupt("continue", 16);

	            case 13:
	              observed.set(element, true);
	              _context2.next = 16;
	              return element;

	            case 16:
	              _context2.next = 9;
	              break;

	            case 18:
	              _context2.next = 23;
	              break;

	            case 20:
	              _context2.prev = 20;
	              _context2.t0 = _context2["catch"](7);

	              _iterator2.e(_context2.t0);

	            case 23:
	              _context2.prev = 23;

	              _iterator2.f();

	              return _context2.finish(23);

	            case 26:
	              _context2.next = 4;
	              break;

	            case 28:
	              _context2.next = 33;
	              break;

	            case 30:
	              _context2.prev = 30;
	              _context2.t1 = _context2["catch"](2);

	              _iterator.e(_context2.t1);

	            case 33:
	              _context2.prev = 33;

	              _iterator.f();

	              return _context2.finish(33);

	            case 36:
	            case "end":
	              return _context2.stop();
	          }
	        }
	      }, uniqueElements, null, [[2, 30, 33, 36], [7, 20, 23, 26]]);
	    })
	  };

	  _public.processElement = function (element, groupObject) {
	    if (Config.DOMProperties.has(element)) {
	      var DOMProperties = Config.DOMProperties.get(element);

	      var _iterator3 = _createForOfIteratorHelper$6(groupObject.eventsList),
	          _step3;

	      try {
	        for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	          var event = _step3.value;

	          if (DOMProperties.hasEvent(event)) {
	            var existingEventGroupName = DOMProperties.getEventGroupName(event);
	            var existingSelector = Config.elementTrackingConfig.getElementGroup(existingEventGroupName).selector; // May not be necessary; good to have this sanity check in place, however.

	            if (existingEventGroupName == groupObject.name) {
	              continue;
	            }

	            var specificityComputation = compare(existingSelector, groupObject.selector) == -1;

	            if (Config.getConfigProperty('overrideEqualSpecificity')) {
	              specificityComputation = compare(existingSelector, groupObject.selector) <= 0;
	            }

	            if (specificityComputation) {
	              DOMProperties.deleteEventsWithGroup(existingEventGroupName);
	              DOMProperties.setEvent(event, groupObject.name);
	            }
	          } else {
	            DOMProperties.setEvent(event, groupObject.name); //Config.DOMProperties.set(DOMProperties);
	          }
	        }
	      } catch (err) {
	        _iterator3.e(err);
	      } finally {
	        _iterator3.f();
	      }
	    } else {
	      var _DOMProperties = DOMPropertiesObject(groupObject);

	      Config.DOMProperties.set(element, _DOMProperties);
	    }
	  };

	  function getEventsList(event) {
	    var eventsList = null;

	    if (EventHandlerController.getEventHandler(event)) {
	      eventsList = EventHandlerController.getEventHandlerEvents(event);

	      if (!eventsList) {
	        return undefined;
	      }
	    } else {
	      eventsList = [event];
	    }

	    return eventsList;
	  }
	  return _public;
	})();

	/*
	    LogUI Client Library
	    Event Callback Handler Module

	    An IIFE function returning functions for handling event callbacks associated with elements/events tracked under LogUI.

	    @module: Event Callback Handler Module
	    @author: David Maxwell
	    @date: 2020-02-25
	*/
	var EventCallbackHandler = (function (root) {
	  var _public = {};

	  _public.logUIEventCallback = function (browserEvent) {
	    var elementDOMProperties = Config.DOMProperties.get(browserEvent.currentTarget); // console.log("Event happened");
	    // console.log(browserEvent.target);
	    // console.log(browserEvent.currentTarget); // This may be the correct thing to use instead of .target - need to test this some more.
	    // console.log(browserEvent.eventPhase);
	    // console.log(elementDOMProperties);
	    // console.log('=====');
	    // This stops event propogation, preventing multiple events being fired.
	    // After testing, this doesn't seem to break hovering over children where a listener is present...
	    // browserEvent.stopPropagation();
	    // stopPropogation() unfortunately also stops other bound event listeners not related to LogUI from firing.
	    // Instead, we can check the eventPhase property of the event -- if we're at the target element (2), we can proceed.
	    // If we are not at the target event (!=2) we do not proceed further with the logging process.
	    // This should no longer be required (as of 2022-02-02) as we use currentTarget instead, alongside the check below to ensure that the object considered is covered by LogUI.
	    // if (browserEvent.eventPhase != 2) {
	    //     return;
	    // }
	    // Can we work out what the call is for, and check?
	    // like if we have a click on green, and a click on body, the element itself takes precedence?
	    // So if there are multiple ones, can we use CSS specificty to work out what one to take forward?

	    if (!elementDOMProperties) {
	      return; // In this scenario, there is no matching DOMProperties object for the element.
	    }

	    var groupName = elementDOMProperties.getEventGroupName(browserEvent.type);
	    var trackingConfig = Config.elementTrackingConfig.getElementGroup(groupName);
	    var eventHandler = EventHandlerController.getEventHandler(trackingConfig.event);
	    var packageEvent = false;

	    if (eventHandler) {
	      packageEvent = eventHandler.logUIEventCallback(this, browserEvent, trackingConfig);
	    } else {
	      packageEvent = _defaultEventCallbackHandler(this, browserEvent, trackingConfig);
	    }

	    if (packageEvent) {
	      EventPackager.packageInteractionEvent(this, packageEvent, trackingConfig);
	    }
	  };

	  var _defaultEventCallbackHandler = function _defaultEventCallbackHandler(eventContext, browserEvent, trackingConfig) {
	    var returnObject = {
	      type: browserEvent.type
	    };

	    if (trackingConfig.hasOwnProperty('name')) {
	      returnObject.name = trackingConfig.name;
	    }

	    return returnObject;
	  };

	  return _public;
	})();

	function _createForOfIteratorHelper$7(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$8(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$8(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$8(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$8(o, minLen); }

	function _arrayLikeToArray$8(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var Binder = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    var _iterator = _createForOfIteratorHelper$7(DOMHandlerHelpers.generators.uniqueElements()),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var element = _step.value;

	        _public.bind(element);
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	  };

	  _public.stop = function () {
	    var _iterator2 = _createForOfIteratorHelper$7(DOMHandlerHelpers.generators.uniqueElements()),
	        _step2;

	    try {
	      for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	        var element = _step2.value;

	        _public.unbind(element);
	      }
	    } catch (err) {
	      _iterator2.e(err);
	    } finally {
	      _iterator2.f();
	    }
	  };

	  _public.bind = function (element) {
	    var elementDOMProperties = Config.DOMProperties.get(element);

	    var _iterator3 = _createForOfIteratorHelper$7(elementDOMProperties.getEventList()),
	        _step3;

	    try {
	      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	        var eventName = _step3.value;
	        element.addEventListener(eventName, EventCallbackHandler.logUIEventCallback);
	      }
	    } catch (err) {
	      _iterator3.e(err);
	    } finally {
	      _iterator3.f();
	    }
	  };

	  _public.unbind = function (element) {
	    var elementDOMProperties = Config.DOMProperties.get(element);

	    var _iterator4 = _createForOfIteratorHelper$7(elementDOMProperties.getEventList()),
	        _step4;

	    try {
	      for (_iterator4.s(); !(_step4 = _iterator4.n()).done;) {
	        var eventName = _step4.value;
	        element.removeEventListener(eventName, EventCallbackHandler.logUIEventCallback);
	      }
	    } catch (err) {
	      _iterator4.e(err);
	    } finally {
	      _iterator4.f();
	    }
	  };

	  return _public;
	})();

	/*
	    LogUI Client Library
	    Browser Events / Context Menu Module

	    A IIFE function yielding a module that provides functionality for tracking the appearance of the context menu.

	    @module: Context Menu Tracking Module
	    @author: David Maxwell
	    @date: 2021-03-04
	*/
	var contextMenu = (function (root) {
	  var _handler = {};

	  _handler.init = function () {
	    if (Config.browserEventsConfig.get('contextMenu', true)) {
	      root.document.addEventListener('contextmenu', callback);
	    }
	  };

	  _handler.stop = function () {
	    root.document.removeEventListener('contextmenu', callback);
	  };

	  var callback = function callback(event) {
	    EventPackager.packageBrowserEvent({
	      type: 'contextMenuFired'
	    });
	  };

	  return _handler;
	})(window);

	var _contextMenu = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': contextMenu
	});

	/*
	    LogUI Client Library
	    Browser Events / Mouse Tracker Module

	    A IIFE function yielding a module that provides functionality for tracking mouse movements.

	    @module: URL Change Browser Event
	    @author: David Maxwell
	    @date: 2021-03-02
	*/
	var CURSORPOSITION_TRACK_FREQUENCY = 200;
	var cursorPosition = (function (root) {
	  var _handler = {};
	  var _trackLeaving = null;
	  var _updateFrequency = CURSORPOSITION_TRACK_FREQUENCY;
	  var _updateIntervalID = null;
	  var _lastEvent = null;
	  var _hadFocus = null;

	  _handler.init = function () {
	    if (Config.browserEventsConfig.get('trackCursor', true)) {
	      var configUpdateFrequencyValue = Config.browserEventsConfig.get('cursorUpdateFrequency', CURSORPOSITION_TRACK_FREQUENCY);

	      if (configUpdateFrequencyValue <= 0) {
	        _updateFrequency = false;
	      } else {
	        _updateFrequency = configUpdateFrequencyValue;
	      }

	      _trackLeaving = Config.browserEventsConfig.get('cursorLeavingPage', true);
	      root.document.addEventListener('mousemove', movementCallback);

	      if (_trackLeaving) {
	        root.document.addEventListener('mouseleave', pageLeaveCallback);
	        root.document.addEventListener('mouseenter', pageEnterCallback);
	      }

	      intervalTimerSet();
	    }
	  };

	  _handler.stop = function () {
	    root.document.removeEventListener('mousemove', movementCallback);
	    root.document.removeEventListener('mouseleave', pageLeaveCallback);
	    root.document.removeEventListener('mouseenter', pageEnterCallback);
	    intervalTimerClear();
	    _trackLeaving = null;
	    _updateFrequency = CURSORPOSITION_TRACK_FREQUENCY;
	    _lastEvent = null;
	    _hadFocus = null;
	  };

	  var movementCallback = function movementCallback(event) {
	    if (!_updateFrequency) {
	      handleMousePosition(event, root.document.hasFocus());
	    }

	    _lastEvent = event;
	    _hadFocus = root.document.hasFocus();
	  };

	  var intervalTimerCallback = function intervalTimerCallback() {
	    if (!_lastEvent) {
	      return;
	    }

	    handleMousePosition(_lastEvent, _hadFocus);
	  };

	  var intervalTimerSet = function intervalTimerSet() {
	    if (_updateFrequency && !_updateIntervalID) {
	      _updateIntervalID = setInterval(intervalTimerCallback, _updateFrequency);
	    }
	  };

	  var intervalTimerClear = function intervalTimerClear() {
	    clearInterval(_updateIntervalID);
	    _updateIntervalID = null;
	  };

	  var getBasicTrackingObject = function getBasicTrackingObject(event, hasFocus) {
	    return {
	      clientX: event.clientX,
	      clientY: event.clientY,
	      screenX: event.screenX,
	      screenY: event.screenY,
	      pageX: event.pageX,
	      pageY: event.pageY,
	      pageHadFocus: hasFocus
	    };
	  };

	  var handleMousePosition = function handleMousePosition(event, hasFocus) {
	    var returnObject = getBasicTrackingObject(event, hasFocus);
	    returnObject.type = 'cursorTracking';
	    returnObject.trackingType = 'positionUpdate';
	    EventPackager.packageBrowserEvent(returnObject);
	  };

	  var pageLeaveCallback = function pageLeaveCallback(event) {
	    var returnObject = getBasicTrackingObject(event, _hadFocus);
	    returnObject.type = 'cursorTracking';
	    returnObject.trackingType = 'cursorLeftViewport';
	    intervalTimerClear();
	    EventPackager.packageBrowserEvent(returnObject);
	  };

	  var pageEnterCallback = function pageEnterCallback(event) {
	    var returnObject = getBasicTrackingObject(event, _hadFocus);
	    returnObject.type = 'cursorTracking';
	    returnObject.trackingType = 'cursorEnteredViewport';
	    intervalTimerSet();
	    EventPackager.packageBrowserEvent(returnObject);
	  };

	  return _handler;
	})(window);

	var _cursorPosition = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': cursorPosition
	});

	/*
	    LogUI Client Library
	    Browser Events / Page Focus Event

	    A IIFE function yielding a module that listens for when the page focus is lost or gained.

	    @module: URL Change Browser Event
	    @author: David Maxwell
	    @date: 2021-03-02
	*/
	var pageFocus = (function (root) {
	  var _handler = {};

	  _handler.init = function () {
	    if (Config.browserEventsConfig.get('pageFocus', true)) {
	      root.addEventListener('blur', callback);
	      root.addEventListener('focus', callback);
	    }
	  };

	  _handler.stop = function () {
	    root.removeEventListener('blur', callback);
	    root.removeEventListener('focus', callback);
	  };

	  var callback = function callback(event) {
	    var pageHasFocus = event.type === 'focus';
	    EventPackager.packageBrowserEvent({
	      type: 'viewportFocusChange',
	      hasFocus: pageHasFocus
	    });
	  };

	  return _handler;
	})(window);

	var _pageFocus = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': pageFocus
	});

	/*
	    LogUI Client Library
	    Browser Events / Scroll Event

	    A IIFE function yielding a module that listens for page scrolls.
	    Also provides functionality to pause listeners when scrolling is taking place.

	    @module: Scroll Browser Event
	    @author: David Maxwell
	    @date: 2021-03-02
	*/
	var scroll = (function (root) {
	  var _handler = {};
	  var _isScrolling = false;

	  _handler.init = function () {
	    if (Config.browserEventsConfig.get('eventsWhileScrolling', true)) {
	      Config.CSSRules.addRule('.disable-hover, disable-hover *', 'pointer-events: none !important;');
	      root.addEventListener('scroll', callback);
	    }
	  };

	  _handler.stop = function () {
	    root.removeEventListener('scroll', callback);
	  };

	  var callback = function callback(event) {
	    // Setting the timeout to zero should mean the timeout fires when the callback has completed.
	    // See https://stackoverflow.com/a/25614886
	    _isScrolling = setTimeout(function () {
	      root.document.body.classList.remove('disable-hover');
	    }, 0);

	    if (!root.document.body.classList.contains('disable-hover')) {
	      root.document.body.classList.add('disable-hover');
	    }
	  };

	  return _handler;
	})(window);

	var _scroll = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': scroll
	});

	/*
	    LogUI Client Library
	    Browser Events / URL Change Event

	    A IIFE function yielding a module that listens for changes to the URL.

	    @module: URL Change Browser Event
	    @author: David Maxwell
	    @date: 2021-03-02
	*/
	var urlChange = (function (root) {
	  var _handler = {};
	  var _existingPath = root.location.href;

	  _handler.init = function () {
	    if (Config.browserEventsConfig.get('URLChanges', true)) {
	      root.addEventListener('popstate', callback);
	    }
	  };

	  _handler.stop = function () {
	    root.removeEventListener('popstate', callback);
	  };

	  var callback = function callback(event) {
	    var previousPath = _existingPath;
	    var currentPath = root.location.href;
	    _existingPath = currentPath;
	    EventPackager.packageBrowserEvent({
	      type: 'URLChange',
	      previousURL: previousPath,
	      newURL: currentPath
	    });
	  };

	  return _handler;
	})(window);

	var _urlChange = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': urlChange
	});

	/*
	    LogUI Client Library
	    Browser Events / Page Resize Event

	    A IIFE function yielding a module that listens for page resize events.
	    Adds some intelligent code that ensures the start and end resize events are logged -- not all of the ones in the middle.

	    @module: Page Resize Event Module
	    @author: David Maxwell
	    @date: 2021-03-04
	*/
	var viewportResize = (function (root) {
	  var _handler = {};
	  var _timeoutID = null;

	  _handler.init = function () {
	    if (Config.browserEventsConfig.get('pageResize', true)) {
	      root.addEventListener('resize', callback);
	    }
	  };

	  _handler.stop = function () {
	    root.removeEventListener('resize', callback);
	    clearTimeout(_timeoutID);
	    _timeoutID = null;
	  };

	  var callback = function callback(event) {
	    clearTimeout(_timeoutID);
	    _timeoutID = setTimeout(function () {
	      EventPackager.packageBrowserEvent({
	        type: 'viewportResize',
	        viewportWidth: event.target.innerWidth,
	        viewportHeight: event.target.innerHeight,
	        stringRepr: "".concat(event.target.innerWidth, "x").concat(event.target.innerHeight)
	      });
	    }, 200);
	  };

	  return _handler;
	})(window);

	var _viewportResize = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': viewportResize
	});

	/*
	    LogUI Client Library
	    Browser Events Controller Module

	    IIFE function that provides a controller for maintaining browser events (i.e., not pertaining to a specific page element, rather document or window).
	    Provides functionality to spin up and stop event listeners.

	    @module: Browser Events Controller Module
	    @author: David Maxwell
	    @date: 2020-03-02
	*/
	var _dirImport$2 = {};

	for (var _key5$2 in _viewportResize) {
	  _dirImport$2[_key5$2 === 'default' ? "viewportResize" : _key5$2] = _viewportResize[_key5$2];
	}

	for (var _key4$2 in _urlChange) {
	  _dirImport$2[_key4$2 === 'default' ? "urlChange" : _key4$2] = _urlChange[_key4$2];
	}

	for (var _key3$2 in _scroll) {
	  _dirImport$2[_key3$2 === 'default' ? "scroll" : _key3$2] = _scroll[_key3$2];
	}

	for (var _key2$2 in _pageFocus) {
	  _dirImport$2[_key2$2 === 'default' ? "pageFocus" : _key2$2] = _pageFocus[_key2$2];
	}

	for (var _key$2 in _cursorPosition) {
	  _dirImport$2[_key$2 === 'default' ? "cursorPosition" : _key$2] = _cursorPosition[_key$2];
	}

	for (var key$2 in _contextMenu) {
	  _dirImport$2[key$2 === 'default' ? "contextMenu" : key$2] = _contextMenu[key$2];
	}

	var BrowserEvents = _dirImport$2;
	var BrowserEventsController = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    for (var browserEventName in BrowserEvents) {
	      BrowserEvents[browserEventName].init();
	    }
	  };

	  _public.stop = function () {
	    for (var browserEventName in BrowserEvents) {
	      var browserEvent = BrowserEvents[browserEventName];

	      if (browserEvent.hasOwnProperty('stop')) {
	        browserEvent.stop();
	      }
	    }
	  };

	  return _public;
	})();

	function _createForOfIteratorHelper$8(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$9(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$9(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$9(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$9(o, minLen); }

	function _arrayLikeToArray$9(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var MutationObserverController = (function (root) {
	  var _public = {};
	  var _mutationObserver = null;

	  _public.init = function () {
	    _mutationObserver = new MutationObserver(observerCallback);
	    var options = {
	      childList: true,
	      attributes: false,
	      characterData: false,
	      subtree: true
	    };

	    _mutationObserver.observe(root.document, options);
	  };

	  _public.stop = function () {
	    _mutationObserver.disconnect();

	    _mutationObserver = null;
	  };

	  var observerCallback = function observerCallback(mutationsList) {
	    var _iterator = _createForOfIteratorHelper$8(mutationsList),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var record = _step.value;

	        if (record.type == 'childList') {
	          var _iterator2 = _createForOfIteratorHelper$8(record.addedNodes),
	              _step2;

	          try {
	            for (_iterator2.s(); !(_step2 = _iterator2.n()).done;) {
	              var element = _step2.value;

	              if (element.nodeType == 1) {
	                processAddedElement(element); // There may be child elements that need to be processed, too.
	                // The recurive function processDescendants handles this.

	                processDescendants(element);
	              }
	            }
	          } catch (err) {
	            _iterator2.e(err);
	          } finally {
	            _iterator2.f();
	          }
	        }
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	  };

	  var processDescendants = function processDescendants(element) {
	    var childArray = Array.from(element.children);
	    childArray.forEach(function (childElement) {
	      processAddedElement(childElement);
	      processDescendants(childElement);
	    });
	  };

	  var processAddedElement = function processAddedElement(element) {
	    var shallBind = false;

	    var _iterator3 = _createForOfIteratorHelper$8(DOMHandlerHelpers.generators.trackingConfig()),
	        _step3;

	    try {
	      for (_iterator3.s(); !(_step3 = _iterator3.n()).done;) {
	        var groupObject = _step3.value;

	        if (element.matches(groupObject.selector)) {
	          shallBind = true;
	          DOMHandlerHelpers.processElement(element, groupObject);
	        }
	      }
	    } catch (err) {
	      _iterator3.e(err);
	    } finally {
	      _iterator3.f();
	    }

	    if (shallBind) {
	      Binder.bind(element);
	    }
	  };

	  return _public;
	})(window);

	function _createForOfIteratorHelper$9(o, allowArrayLike) { var it; if (typeof Symbol === "undefined" || o[Symbol.iterator] == null) { if (Array.isArray(o) || (it = _unsupportedIterableToArray$a(o)) || allowArrayLike && o && typeof o.length === "number") { if (it) o = it; var i = 0; var F = function F() {}; return { s: F, n: function n() { if (i >= o.length) return { done: true }; return { done: false, value: o[i++] }; }, e: function e(_e) { throw _e; }, f: F }; } throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); } var normalCompletion = true, didErr = false, err; return { s: function s() { it = o[Symbol.iterator](); }, n: function n() { var step = it.next(); normalCompletion = step.done; return step; }, e: function e(_e2) { didErr = true; err = _e2; }, f: function f() { try { if (!normalCompletion && it["return"] != null) it["return"](); } finally { if (didErr) throw err; } } }; }

	function _unsupportedIterableToArray$a(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray$a(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray$a(o, minLen); }

	function _arrayLikeToArray$a(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }
	var DOMHandler = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    runElementInitialisation();
	    BrowserEventsController.init();
	    Binder.init();
	    MutationObserverController.init();
	    return true;
	  };

	  _public.stop = function () {
	    MutationObserverController.stop();
	    BrowserEventsController.stop();
	    Binder.stop();
	  };

	  var runElementInitialisation = function runElementInitialisation() {
	    var _iterator = _createForOfIteratorHelper$9(DOMHandlerHelpers.generators.trackingConfig()),
	        _step;

	    try {
	      for (_iterator.s(); !(_step = _iterator.n()).done;) {
	        var groupObject = _step.value;

	        for (var i in Object.keys(groupObject.selectedElements)) {
	          var element = groupObject.selectedElements[i];
	          DOMHandlerHelpers.processElement(element, groupObject); // console.log(element);
	          // console.log(Config.DOMProperties.get(element));
	          // console.log('=====');
	        }
	      }
	    } catch (err) {
	      _iterator.e(err);
	    } finally {
	      _iterator.f();
	    }
	  };

	  return _public;
	})();

	/*
	    LogUI Client Library
	    Specific LogUI Framework Events Module

	    An IIFE function returning functions for handling LogUI specific events.
	    When fired, these functions gather the necessary data and send them to the relevant packager.

	    @module: Specific LogUI Framework Events Module
	    @author: David Maxwell
	    @date: 2021-03-06
	*/
	var SpecificFrameworkEvents = (function (root) {
	  var _public = {};

	  _public.init = function () {
	    root.addEventListener('logUIStarted', _public.logUIStartedEvent);
	    return true;
	  };

	  _public.stop = function () {
	    root.removeEventListener('logUIStarted', _public.logUIStartedEvent);

	    _public.logUIStoppedEvent();
	  };

	  _public.logUIStartedEvent = function () {
	    var eventDetails = {
	      type: 'started',
	      browserAgentString: root.navigator.userAgent,
	      screenResolution: {
	        width: root.screen.width,
	        height: root.screen.height,
	        depth: root.screen.colorDepth
	      },
	      viewportResolution: {
	        width: root.innerWidth,
	        height: root.innerHeight
	      }
	    };
	    EventPackager.packageStatusEvent(eventDetails);
	  };

	  _public.logUIStoppedEvent = function () {
	    var eventDetails = {
	      type: 'stopped'
	    };
	    EventPackager.packageStatusEvent(eventDetails);
	  };

	  _public.logUIUpdatedApplicationSpecificData = function () {
	    EventPackager.packageStatusEvent({
	      type: 'applicationSpecificDataUpdated'
	    });
	  };

	  return _public;
	})(window);

	var main = (function (root) {
	  var _public = {};
	  /* Public build variables */

	  _public.buildVersion = '0.5.4a';
	  _public.buildEnvironment = 'production';
	  _public.buildDate = 'Wed Oct 25 2023 10:45:21 GMT-0600 (Mountain Daylight Time)';
	  _public.Config = Config;
	  /* API calls */

	  _public.init = /*#__PURE__*/function () {
	    var _ref = asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee(suppliedConfigObject) {
	      return regenerator.wrap(function _callee$(_context) {
	        while (1) {
	          switch (_context.prev = _context.next) {
	            case 0:
	              root.addEventListener('logUIShutdownRequest', _public.stop);

	              if (suppliedConfigObject) {
	                _context.next = 3;
	                break;
	              }

	              throw Error('LogUI requires a configuration object to be passed to the init() function.');

	            case 3:
	              if (Config.init(suppliedConfigObject)) {
	                _context.next = 5;
	                break;
	              }

	              throw Error('The LogUI configuration component failed to initialise. Check console warnings to see what went wrong.');

	            case 5:
	              if (MetadataHandler.init()) {
	                _context.next = 7;
	                break;
	              }

	              throw Error('The LogUI metadata handler component failed to initialise. Check console warnings to see what went wrong.');

	            case 7:
	              if (EventPackager.init()) {
	                _context.next = 9;
	                break;
	              }

	              throw Error('The LogUI event packaging component failed to initialise. Check console warnings to see what went wrong.');

	            case 9:
	              if (SpecificFrameworkEvents.init()) {
	                _context.next = 11;
	                break;
	              }

	              throw Error('The LogUI events component failed to initialise. Check console warnings to see what went wrong.');

	            case 11:
	              _context.next = 13;
	              return Dispatcher.init(suppliedConfigObject);

	            case 13:
	              if (_context.sent) {
	                _context.next = 15;
	                break;
	              }

	              throw Error('The LogUI dispatcher component failed to initialise. Check console warnings to see what went wrong.');

	            case 15:
	              if (DOMHandler.init()) {
	                _context.next = 17;
	                break;
	              }

	              throw Error('The LogUI DOMHandler component failed to initialise. Check console warnings to see what went wrong.');

	            case 17:
	              if (EventHandlerController.init()) {
	                _context.next = 19;
	                break;
	              }

	              throw Error('The LogUI event handler controller component failed to initialise. Check console warnings to see what went wrong.');

	            case 19:
	              root.addEventListener('unload', _public.stop);

	            case 20:
	            case "end":
	              return _context.stop();
	          }
	        }
	      }, _callee);
	    }));

	    return function (_x) {
	      return _ref.apply(this, arguments);
	    };
	  }();

	  _public.isActive = function () {
	    return Config.isActive() && Dispatcher.isActive();
	  };

	  _public.stop = /*#__PURE__*/asyncToGenerator( /*#__PURE__*/regenerator.mark(function _callee2() {
	    return regenerator.wrap(function _callee2$(_context2) {
	      while (1) {
	        switch (_context2.prev = _context2.next) {
	          case 0:
	            if (_public.isActive()) {
	              _context2.next = 2;
	              break;
	            }

	            throw Error('LogUI may only be stopped if it is currently running.');

	          case 2:
	            root.removeEventListener('unload', _public.stop);
	            root.removeEventListener('logUIShutdownRequest', _public.stop); // https://stackoverflow.com/questions/42304996/javascript-using-promises-on-websocket

	            DOMHandler.stop();
	            EventHandlerController.stop();
	            SpecificFrameworkEvents.stop();
	            EventPackager.stop();
	            MetadataHandler.stop();
	            _context2.next = 11;
	            return Dispatcher.stop();

	          case 11:
	            Config.reset();
	            root.dispatchEvent(new Event('logUIStopped'));

	          case 13:
	          case "end":
	            return _context2.stop();
	        }
	      }
	    }, _callee2);
	  }));

	  _public.logCustomMessage = function (messageObject) {
	    if (!_public.isActive()) {
	      throw Error('Custom messages may only be logged when the LogUI client is active.');
	    }

	    EventPackager.packageCustomEvent(messageObject);
	  };

	  _public.updateApplicationSpecificData = function (updatedObject) {
	    if (!_public.isActive()) {
	      throw Error('Application specific data can only be updated when the LogUI client is active.');
	    }

	    Config.applicationSpecificData.update(updatedObject);
	    SpecificFrameworkEvents.logUIUpdatedApplicationSpecificData();
	  };

	  _public.deleteApplicationSpecificDataKey = function (key) {
	    Config.applicationSpecificData.deleteKey(key);
	    SpecificFrameworkEvents.logUIUpdatedApplicationSpecificData();
	  };

	  _public.clearSessionID = function () {
	    if (_public.isActive()) {
	      throw Error('The session ID can only be reset when the LogUI client is inactive.');
	    }

	    Config.sessionData.clearSessionIDKey();
	  };

	  return _public;
	})(window);

	return main;

}());
