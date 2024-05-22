/**
 * Creates a memoized version of a function that depends on a Request object. It uses a WeakMap to cache the results
 * based on the Request object to avoid memory leaks. This is particularly useful for caching results of operations
 * that are expensive and request-specific.
 *
 * @param {F} fn - The function to be memoized. It should accept a Request object as its first argument.
 * @returns {F} The memoized function.
 * @template F - A function type that takes a Request and any number of additional arguments.
 */
export function requestMemoize(fn) {
  const cache = new WeakMap();

  return function (req, ...args) {
    // Check if the cache has a result for this request
    if (cache.has(req)) {
      return cache.get(req);
    }

    // Call the function and store the result in the cache
    const result = fn.apply(this, [req, ...args]);
    cache.set(req, result);
    return result;
  };
}

/**
 * Creates a memoized version of a function with a reference object as a cache key. It uses a WeakMap associated with
 * the reference object to store function results. This approach is useful when memoization needs to be tied to the
 * lifecycle of a particular object, preventing memory leaks.
 *
 * @param {F} fn - The function to be memoized.
 * @param {{ current: any }} ref - A reference object used as the key for caching.
 * @returns {F} The memoized function.
 * @template F - A function type that takes any number of arguments.
 */
export function memoizeByRef(fn, ref) {
  const objCache = new WeakMap();
  return function (...args) {
    if (!objCache.has(ref.current)) {
      objCache.set(ref.current, new Map());
    }
    const cache = objCache.get(ref.current);
    const key = JSON.stringify(args);
    // Check if the cache has a result for this request
    if (cache.has(key)) {
      return cache.get(key);
    }

    // Call the function and store the result in the cache
    const result = fn.apply(this, [...args]);
    cache.set(key, result);
    return result;
  };
}
