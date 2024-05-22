import { initCacheInstance, getCacheInstance } from "../../../utils/cache.util";
import path from "node:path";
import os from "node:os";
import { serialize } from "node:v8";
import { stat } from "node:fs/promises";

function sizeOf(obj) {
  const serializedObj = serialize(obj);
  return serializedObj.byteLength + 50;
}
const mockCacheData = {
  body: new Uint8Array(Buffer.from("Hello, World")),
  status: 200,
  headers: [["content-type", "text/plain"]]
};
const cacheOptions = {
  maxSize: 2048,
  sizeCalculation: sizeOf,
  allowStale: true
};

// Mocking file path
const cacheFilePath = path.join(os.tmpdir(), "cache.bin");
describe("CacheManager Tests", () => {
  describe("CacheManager with initialization", () => {
    let cacheManager;
    beforeAll(async () => {
      cacheManager = await initCacheInstance(cacheOptions);
    });
		afterAll(async () => {
			cacheManager.destroy();
		})
    test("CacheManager initialization", async () => {
      const cache = getCacheInstance();
      expect(cache).toBeDefined();
    });
    test("CacheManager is a singleton", async () => {
      const cache1 = getCacheInstance();
      const cache2 = getCacheInstance();
      expect(cache1).toBe(cache2);
    });
    test("CacheManager persists data", async () => {
      const cache = getCacheInstance();

      // Simulate adding data to the cache
      cache.set("newKey", mockCacheData);

      // Simulate dumping cache to file
      // @ts-ignore
      await cacheManager.dumpCache();

      // Check if serializeToFile was called with the expected data
      expect(await stat(cacheFilePath)).toBeDefined();
    });

		test("CacheManager re-reads from presisted data", async () => {
      let cache = getCacheInstance();

      // Simulate adding data to the cache
      cache.set("newKey", mockCacheData);

      // Simulate dumping cache to file
      // @ts-ignore
      await cacheManager.dumpCache();

      // Check if serializeToFile was called with the expected data
      expect(await stat(cacheFilePath)).toBeDefined();

			// Destroy cache
			cacheManager.destroy();

			await initCacheInstance(cacheOptions);

			// create new cache
			cache = getCacheInstance();
			const mockData = await cache.get("newKey");

			expect(mockData).toMatchObject(mockCacheData);
    });
  });
});