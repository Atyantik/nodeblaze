import { getCacheInstance } from "../../../utils/cache.util";

test("CacheManager throws error if not initialized", () => {
  expect(() => getCacheInstance()).toThrow("CacheManager instance not initiated");
});