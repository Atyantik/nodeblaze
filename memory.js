import v8 from 'node:v8';
import { freemem } from 'node:os';

// Function to convert bytes to megabytes
const bytesToMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);

const memoryUsage = process.memoryUsage();

console.log(':: FREE MEM ::');
console.log(`${bytesToMB(freemem())} MB`);
console.log('\n\n');

console.log(':: MEMORY USAGE ::');

console.log(`RSS: ${bytesToMB(memoryUsage.rss)} MB`);
console.log(`Heap Total: ${bytesToMB(memoryUsage.heapTotal)} MB`);
console.log(`Heap Used: ${bytesToMB(memoryUsage.heapUsed)} MB`);
console.log(`External: ${bytesToMB(memoryUsage.external)} MB`);
console.log(`Array Buffers: ${bytesToMB(memoryUsage.arrayBuffers)} MB`);

console.log('\n\n');

// Check current heap statistics
const heapStats = v8.getHeapStatistics();
console.log(':: Heap Statistics ::');
for (const [key, value] of Object.entries(heapStats)) {
  console.log(`${key}: ${bytesToMB(value)} MB`);
}

// Simulate heavy memory usage (for demonstration purposes only)
const largeArray = new Array(1e7).fill('Node.js memory test');

console.log('\n\n');
const memoryUsageAfterAllocation = process.memoryUsage();
console.log(':: Memory Usage after allocation ::');
console.log(`RSS: ${bytesToMB(memoryUsageAfterAllocation.rss)} MB`);
console.log(`Heap Total: ${bytesToMB(memoryUsageAfterAllocation.heapTotal)} MB`);
console.log(`Heap Used: ${bytesToMB(memoryUsageAfterAllocation.heapUsed)} MB`);
console.log(`External: ${bytesToMB(memoryUsageAfterAllocation.external)} MB`);
console.log(`Array Buffers: ${bytesToMB(memoryUsageAfterAllocation.arrayBuffers)} MB`);
console.log('\n\n');

console.log(':: FREE MEM ::');
console.log(`${bytesToMB(freemem())} MB`);
console.log('\n\n');