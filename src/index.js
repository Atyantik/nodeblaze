import v8 from 'node:v8';
import { routes as rawRoutes } from "./__routes.js";
import { run } from "./core/server.js";
import { getCacheInstance, initCacheInstance } from "./core/utils/cache.util.js";
import { getRequestId } from "./core/utils/http.util.js";
import { getFreeMemoryInBytes } from "./core/utils/memory.util.js";
import { compileRoute } from "./core/utils/router.util.js";

/**
 * Performs garbage collection
 * and get the usable bytes for the cache based on
 * the system's available memory.
 */
global?.gc?.();
const availableBytes = getFreeMemoryInBytes();

// 80% of memory allocated to the process (v8.getHeapStatistics().heap_size_limit)
const usableBytes = Math.floor(availableBytes * 0.8);

/**
 * Calculates the size of an object in bytes. This is used in the cache's size calculation logic.
 *
 * @param {ResponseCacheableObject} obj - The object whose size needs to be calculated.
 * @returns {number} The size of the object in bytes.
 */
function sizeOf(obj) {
  const serializedObj = v8.serialize(obj);
  return Buffer.byteLength(serializedObj) + 500;
}

/**
 * Configuration options for the LRUCache. It includes settings for
 * maximum cache size, size calculation method, and stale item handling.
 */
const options = {
  maxSize: usableBytes,
  sizeCalculation: sizeOf,
  // return stale items before removing from cache?
  allowStale: true
};
await initCacheInstance(options);
const cache = getCacheInstance();
/**
 * Compiles raw routes into a format suitable
 * for matching against incoming requests.
 */
const routes = compileRoute(rawRoutes);

// Server configuration and initialization
const port = +(process.env.PORT || "3000") || 3000;
const hostname = process.env.HOST || process.env.HOSTNAME || "0.0.0.0";

/**
 * Starts a Bun server with defined hostname and port. The server handles incoming HTTP requests
 * and routes them based on the defined route handlers, while also handling CORS and caching.
 */
await run(routes, {
  cache,
  hostname,
  port,
  getRequestId
});
