import { getHeapStatistics } from "node:v8";

/**
 * Retrieves the amount of memory in bytes allocated to the process
 * with heap limit
 *
 * @returns {number} The number of memory bytes available to the process.
 */
export function getFreeMemoryInBytes() {
  return getHeapStatistics().heap_size_limit;
}
