'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _objectSpread = _interopDefault(require('@babel/runtime/helpers/objectSpread2'));
var _slicedToArray = _interopDefault(require('@babel/runtime/helpers/slicedToArray'));
var _createForOfIteratorHelper = _interopDefault(require('@babel/runtime/helpers/createForOfIteratorHelper'));
var getOwnPropertyDescriptors = _interopDefault(require('object.getownpropertydescriptors'));

var tick = typeof process === 'object' ? process.nextTick : function (fn) {
  return setTimeout(function () {
    return fn();
  }, 0);
};
/**
 * Calls the specified callback with the result of the promise.
 *
 * Note that if the callback throws a synchronous error, it will trigger an unhandled exception.
 *
 * @param {Promise} promise
 * @param {Function<Err, Any>} cb - An errback.
 */

function asCallback(promise, cb) {
  var callback = function callback() {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    return tick(function () {
      return cb.apply(void 0, args);
    });
  };

  promise.then(function (res) {
    return callback(null, res);
  }, callback);
}

function delay(time, value) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, time, value);
  });
}

function immediate(value) {
  return new Promise(function (resolve) {
    return setImmediate(resolve, value);
  });
}

var nextTick = typeof process === 'object' ? function nextTick(value) {
  return new Promise(function (resolve) {
    return process.nextTick(resolve, value);
  });
} : function nextTick(value) {
  return Promise.resolve(value).then(function (value) {
    return value;
  });
};

var fromEntries = Object.fromEntries || function fromEntries(entries) {
  var obj = {};

  var _iterator = _createForOfIteratorHelper(entries),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var _step$value = _slicedToArray(_step.value, 2),
          key = _step$value[0],
          value = _step$value[1];

      obj[key] = value;
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return obj;
};

/**
 * Promise.all but for objects instead of arrays.
 *
 * @param {Object<string, * | Promise<*>>} object
 * @return {Promise<Object<string, *>>} The object, with its values resolved.
 */

function objectAll(object) {
  if (!object || typeof object !== 'object') {
    return Promise.reject(new TypeError('objectAll requires an object'));
  }

  var entries = [];

  var _loop = function _loop(key) {
    if (hasOwnProperty.call(object, key)) {
      entries.push(Promise.resolve(object[key]).then(function (resolved) {
        return [key, resolved];
      }));
    }
  };

  for (var key in object) {
    _loop(key);
  }

  return Promise.all(entries).then(fromEntries);
}

class TimeoutError extends Error {}

/**
 * Like Promise.all, but without examining or collecting the resolved values from the Promises.
 */
function voidAll(iter) {
  return new Promise(function (resolve, reject) {
    var n = 0,
        total = 0,
        ready = false;

    try {
      var _iterator = _createForOfIteratorHelper(iter),
          _step;

      try {
        for (_iterator.s(); !(_step = _iterator.n()).done;) {
          var value = _step.value;
          Promise.resolve(value).then(function () {
            ++n;
            if (ready && n === total) resolve();
          }, reject);
          ++total;
        }
      } catch (err) {
        _iterator.e(err);
      } finally {
        _iterator.f();
      }

      ready = true; // n === 0 here because Promise.resolve(...).then(...) will only evaluate the then'd functions
      // after at least one turn of the microtask queue. Thus the only case where we can resolve is
      // if the iterable was empty.

      if (!total) resolve();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Wait for the given EventEmitter to emit the given event. Optionally reject the promise if an
 * error event occurs while waiting.
 *
 * @param {EventEmitter} emitter The emitter to wait on.
 * @param {String} event The event to wait for.
 * @param {Boolean=} waitError Whether to reject if an error occurs, defaults to false.
 * @return {Promise<*>} A promise that resolves or rejects based on events emitted by the emitter.
 */
function waitOn(emitter, event, waitError) {
  if (waitError) {
    return new Promise(function (resolve, reject) {
      function unbind() {
        emitter.removeListener('error', onError);
        emitter.removeListener(event, onEvent);
      }

      function onEvent(value) {
        unbind();
        resolve(value);
      }

      function onError(err) {
        unbind();
        reject(err);
      }

      emitter.on('error', onError);
      emitter.on(event, onEvent);
    });
  }

  return new Promise(function (resolve) {
    return emitter.once(event, resolve);
  });
}

/**
 * Return a promise that resolves to the same value as the given promise. If it takes more than the
 * specified delay to do so, the returned promise instead rejects with a timeout error.
 *
 * @param {Promise<*>} promise The promise to resolve.
 * @param {Number} delay The millisecond delay before a timeout occurs.
 * @param {String|Error=} message The error message or Error object to reject with if the operation
 *   times out.
 * @return {Promise<*>} The promise that times out.
 */

function withTimeout(promise, delay, message) {
  var timeout;
  var timeoutPromise = new Promise(function (resolve, reject) {
    // Instantiate the error here to capture a more useful stack trace.
    var error = message instanceof Error ? message : new TimeoutError(message || 'Operation timed out.');
    timeout = setTimeout(reject, delay, error);
  });
  return Promise.race([promise, timeoutPromise]).then(function (value) {
    clearTimeout(timeout);
    return value;
  }, function (err) {
    clearTimeout(timeout);
    throw err;
  });
}

/**
 * Build a callback for the given promise resolve/reject functions.
 *
 * @param {Boolean|String[]} options.variadic See the documentation for promisify.
 */
function callbackBuilder(resolve, reject, options) {
  var variadic;

  if (options) {
    variadic = options.variadic;
  }

  var called = false;
  return function callback(err, value) {
    if (called) {
      throw new Error('the deferred callback has already been called');
    }

    called = true;

    if (err) {
      reject(err);
    } else if (Array.isArray(variadic)) {
      var obj = {};

      for (var i = 0; i < variadic.length; i++) {
        obj[variadic[i]] = arguments[i + 1];
      }

      resolve(obj);
    } else if (variadic) {
      var args = new Array(arguments.length - 1);

      for (var _i = 0; _i < args.length; ++_i) {
        args[_i] = arguments[_i + 1];
      }

      resolve(args);
    } else {
      resolve(value);
    }
  };
}

var sentinel = Object.create(null);
/**
 * Wrap a function that may return a promise or call a callback, making it always return a promise.
 * If catchExceptions is true, synchronous exceptions from the function will reject that promise.
 *
 * @param {Function} fn The asynchronous function.
 * @param {Boolean|String[]} options.variadic See the documentation for promisify.
 * @param {Boolean=} options.catchExceptions Whether to catch synchronous exceptions, defaults to true.
 * @return {Function: Promise} A promise-returning variant of the function.
 */

function wrapAsync(fn, options) {
  var catchExceptions = options && options.catchExceptions;

  if (typeof catchExceptions !== 'boolean') {
    catchExceptions = true;
  }
  /**
   * @param {...args} var_args The arguments to the wrapped function.
   * @return {Promise<*>} A promise that resolves to the result of the computation.
   */


  return function asyncWrapper() {
    var _arguments = arguments,
        _this = this;

    var syncErr = sentinel;
    var promise = new Promise(function (resolve, reject) {
      var cb = callbackBuilder(resolve, reject, options),
          args = Array.from(_arguments);
      args.push(cb);
      var res;

      try {
        res = fn.apply(_this, args);
      } catch (e) {
        if (catchExceptions) {
          reject(e);
        } else {
          syncErr = e; // Resolve to avoid an unhandled rejection if the function called the callback before
          // throwing the synchronous exception.

          resolve();
        }

        return;
      }

      if (res && typeof res.then === 'function') {
        resolve(res);
      }
    }); // Throw the synchronous error here instead of inside the Promise callback so that it actually
    // throws outside.

    if (syncErr !== sentinel) throw syncErr;
    return promise;
  };
}

var staticProperties = /*#__PURE__*/Object.freeze({
  __proto__: null,
  asCallback: asCallback,
  delay: delay,
  immediate: immediate,
  nextTick: nextTick,
  objectAll: objectAll,
  TimeoutError: TimeoutError,
  voidAll: voidAll,
  waitOn: waitOn,
  withTimeout: withTimeout,
  wrapAsync: wrapAsync
});

function patchPromise() {
  var props = {};

  for (var _i = 0, _Object$entries = Object.entries(staticProperties); _i < _Object$entries.length; _i++) {
    var entry = _Object$entries[_i];
    var fnName = entry[0],
        fn = entry[1];

    if (Promise[fnName] && Promise[fnName] !== fn) {
      throw new Error(`Promise already defines ${fnName}.`);
    }

    props[fnName] = {
      configurable: true,
      enumerable: false,
      writable: true,
      value: fn
    };
  }

  Object.defineProperties(Promise, props);
}
function unpatchPromise() {
  for (var _i2 = 0, _Object$entries2 = Object.entries(staticProperties); _i2 < _Object$entries2.length; _i2++) {
    var entry = _Object$entries2[_i2];
    var fnName = entry[0],
        fn = entry[1];

    if (Promise[fnName] === fn) {
      delete Promise[fnName];
    }
  }
}
var statics = _objectSpread({}, staticProperties);

/**
 * Calls the specified callback with the result of the promise.
 *
 * Note that if the callback throws a synchronous error, then we will trigger an unhandled
 * rejection.
 *
 * @param {Promise} promise
 * @param {Function<Err, Any>} cb - An errback.
 */

function asCallback$1(cb) {
  asCallback(this, cb);
}

/**
 * The same promise, but with a timeout.
 *
 * @param {Promise<*>} promise The promise to resolve.
 * @param {Number} delay The millisecond delay before a timeout occurs.
 * @param {String|Error=} message The error message or Error object to reject with if the operation
 *   times out.
 * @return {Promise<*>} The promise that times out.
 */

function timeout(delay, message) {
  return withTimeout(this, delay, message);
}

var methods = {
  asCallback: asCallback$1,
  timeout
};
/**
 * Patches the global `Promise` built-in to define `asCallback` and others as instance methods,
 * so you can do e.g. `Promise.resolve(true).asCallback(cb)`.
 *
 * Idempotent.
 *
 * @throws {Error} If `Promise` already defines one or more of the instance methods.
 */

function patchPromise$1() {
  var props = {};

  for (var _i = 0, _Object$entries = Object.entries(methods); _i < _Object$entries.length; _i++) {
    var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
        name = _Object$entries$_i[0],
        method = _Object$entries$_i[1];

    if (Promise.prototype[name] && Promise.prototype[name] !== method) {
      throw new Error(`\`Promise\` already defines method \`${name}\``);
    }

    props[name] = {
      configurable: true,
      enumerable: false,
      writable: true,
      value: method
    };
  }

  Object.defineProperties(Promise.prototype, props);
}
/**
 * Undoes `patchPromise`.
 *
 * A no-op if `patchPromise` had not been called.
 */

function unpatchPromise$1() {
  for (var _i2 = 0, _Object$entries2 = Object.entries(methods); _i2 < _Object$entries2.length; _i2++) {
    var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
        name = _Object$entries2$_i[0],
        method = _Object$entries2$_i[1];

    if (Promise.prototype[name] === method) {
      delete Promise.prototype[name];
    }
  }
}

/**
 * Calls the given function and returns a promise that fulfills according to the formers result.
 * A convenience function that make the 'promise = deferred(), fn(promise.defer()), await promise' pattern a one-liner.
 *
 * @param {function(callback)} fn A function that takes a Node style callback as its argument.
 * @return {Promise}
 */

function callAsync(fn) {
  return new Promise(function (resolve, reject) {
    return fn(callbackBuilder(resolve, reject));
  });
}

/**
 * Create a Defer object that supports the resolve and reject methods that would otherwise be
 * provided to the function given to Promise. Also hosts the promise field which contains the
 * corresponding Promise object.
 */
class Defer {
  constructor() {
    var _this = this;

    this.promise = new Promise(function (resolve, reject) {
      _this.resolve = resolve;
      _this.reject = reject;
    });
  }

}

function defer() {
  return new Defer();
}

/**
 * Create a capture context, similar to sync but without the global state.
 *
 * @param {Boolean|String[]} options.variadic See the documentation for promisify.
 */

function deferred(options) {
  var args = null;
  var promise = new Promise(function (resolve, reject) {
    return args = [resolve, reject, options];
  });

  promise.defer = function defer() {
    if (!args) throw new Error('defer has already been called');
    var callback = callbackBuilder.apply(undefined, args);
    args = null;
    return callback;
  };

  return promise;
}

var kCustomPromisifiedSymbol = Symbol.for('util.promisify.custom');
/**
 * Promisify the given function.
 *
 * @param {Function} orig The function to promisify.
 * @param {Boolean|String[]} options.variadic The variadic option informs how promisify will handle
 *   more than one value - by default, promisify will only resolve the promise with the first value.
 *     false    - only resolve the promise with the first value, default behavior
 *     true     - resolve the promise with an array containing the variadic arguments
 *     String[] - the names of the arguments to the callback, which will be used to create an object
 *       of values.
 * @return {Function: Promise} The promisified function.
 */

function promisify(orig, options) {
  if (typeof orig !== 'function') {
    throw new TypeError('promisify requires a function');
  }

  if (orig[kCustomPromisifiedSymbol]) {
    var _fn = orig[kCustomPromisifiedSymbol];

    if (typeof _fn !== 'function') {
      throw new TypeError('The [util.promisify.custom] property must be a function');
    }

    Object.defineProperty(_fn, kCustomPromisifiedSymbol, {
      value: _fn,
      enumerable: false,
      writable: false,
      configurable: true
    });
    return _fn;
  }

  function fn() {
    var _this = this;

    var args = Array.from(arguments);
    return new Promise(function (resolve, reject) {
      args.push(callbackBuilder(resolve, reject, options));

      try {
        orig.apply(_this, args);
      } catch (err) {
        reject(err);
      }
    });
  }

  Object.setPrototypeOf(fn, Object.getPrototypeOf(orig));
  Object.defineProperty(fn, kCustomPromisifiedSymbol, {
    value: fn,
    enumerable: false,
    writable: false,
    configurable: true
  });
  return Object.defineProperties(fn, getOwnPropertyDescriptors(orig));
}
/**
 * Promisify the given name on the given object, and create a copy of the object.
 *
 * @param {*} obj A value that can have properties.
 * @param {String} methodName The method to promisify.
 * @param {Boolean|String[]} options.variadic See the documentation for promisify.
 * @return {Object} The promisified object.
 */


function promisifyMethod(obj, methodName, options) {
  if (!obj) {
    // This object could be anything, including a function, a real object, or an array.
    throw new TypeError('promisify.method requires a truthy value');
  }

  return promisify(obj[methodName].bind(obj), options);
}
/**
 * Promisify the given names on the given object, and create a copy of the object.
 *
 * @param {*} obj A value that can have properties.
 * @param {String[]} methodNames The methods to promisify.
 * @param {Boolean|String[]} options.variadic See the documentation for promisify.
 * @return {Object} The promisified object.
 */


function promisifyMethods(obj, methodNames, options) {
  if (!obj) {
    // This object could be anything, including a function, a real object, or an array.
    throw new TypeError('promisify.methods requires a truthy value');
  }

  var out = {};

  var _iterator = _createForOfIteratorHelper(methodNames),
      _step;

  try {
    for (_iterator.s(); !(_step = _iterator.n()).done;) {
      var methodName = _step.value;
      out[methodName] = promisify(obj[methodName].bind(obj), options);
    }
  } catch (err) {
    _iterator.e(err);
  } finally {
    _iterator.f();
  }

  return out;
}
/**
 * Promisify all functions on the given object.
 *
 * @param {*} obj A value that can have properties.
 * @param {Boolean|String[]} options.variadic See the documentation for promisify.
 * @return {Object} The promisified object.
 */

function promisifyAll(obj, options) {
  if (!obj) {
    // This object could be anything, including a function, a real object, or an array.
    throw new TypeError('promisify.all requires a truthy value');
  }

  var out = {};

  for (var name in obj) {
    if (typeof obj[name] === 'function') {
      out[name] = promisify(obj[name].bind(obj), options);
    }
  }

  return out;
}
promisify.custom = kCustomPromisifiedSymbol;
promisify.all = promisifyAll;
promisify.method = promisifyMethod;
promisify.methods = promisifyMethods;
promisify.promisifyAll = promisifyAll;
promisify.promisifyMethods = promisifyMethods;

function patchPromise$2() {
  patchPromise();
  patchPromise$1();
}
function unpatchPromise$2() {
  unpatchPromise();
  unpatchPromise$1();
}

exports.TimeoutError = TimeoutError;
exports.asCallback = asCallback;
exports.callAsync = callAsync;
exports.defer = defer;
exports.deferred = deferred;
exports.delay = delay;
exports.immediate = immediate;
exports.nextTick = nextTick;
exports.objectAll = objectAll;
exports.patchPromise = patchPromise$2;
exports.promisify = promisify;
exports.promisifyAll = promisifyAll;
exports.promisifyMethod = promisifyMethod;
exports.promisifyMethods = promisifyMethods;
exports.unpatchPromise = unpatchPromise$2;
exports.voidAll = voidAll;
exports.waitOn = waitOn;
exports.withTimeout = withTimeout;
exports.wrapAsync = wrapAsync;
