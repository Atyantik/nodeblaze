// cacheManager.js
import { LRUCache } from "lru-cache";
import {
	serializeToFile,
	deserializeFromFile,
} from "./storage.util.js";
import path from "node:path";
import os from "node:os";

export class CacheManager {
  static #instance = null;
  cache = null;
  filePath = null;

  static async initInstance(options) {
    if (CacheManager.#instance) {
      console.info("Cache already initiated. Use CacheManager.getInstance()");
      return;
    }
    CacheManager.#instance = new CacheManager(options);
    await CacheManager.#instance.loadCache();
    return CacheManager.#instance;
  }

  static getCacheInstance() {
    if (!CacheManager.#instance) {
      throw new Error(
        "CacheManager instance not initiated. Use CacheManager.initInstance(options: CacheOptions)"
      );
    }
    return CacheManager.#instance.cache;
  }

  constructor(options) {
    if (CacheManager.#instance) {
      throw new Error(
        "CacheManager instance already created. Use CacheManager.getInstance()"
      );
    }

    this.cache = new LRUCache(options);
    this.filePath = path.join(os.tmpdir(), "cache.bin");
  }

	async destroy() {
		this.cache?.clear?.();
		this.cache = null;
		CacheManager.#instance = null;
	}

  async loadCache() {
    try {
      const data = await deserializeFromFile(this.filePath);
      if (data.length) {
        this.cache.load(data);
      }
    } catch (ex) {
      if (ex.code !== 'ENOENT') {
        console.log(ex);
      }
      console.log("Cache not found. Starting with empty cache.");
    }
  }

  async dumpCache() {
    const dump = this.cache.dump();
    if (dump.length) {
      await serializeToFile(dump, this.filePath);
    }
  }
}

// Export the getInstance method
export const getCacheInstance = CacheManager.getCacheInstance;
export const initCacheInstance = CacheManager.initInstance;
