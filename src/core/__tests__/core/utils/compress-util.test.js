import { brotliCompress, brotliDecompress, gzipCompress, gzipDecompress, deflateCompress, deflateDecompress } from "../../../utils/compress.util";

// Sample data for testing
const sampleData = "Hello World!";


// brotliCompress & brotliDecompress
test("brotliCompress and brotliDecompress", async () => {
  const compressed = await brotliCompress(sampleData);
  expect(compressed instanceof Buffer).toBe(true);
  const decompressed = await brotliDecompress(compressed);
  expect(decompressed.toString()).toBe(sampleData);
});

// gzipCompress & gzipDecompress
test("gzipCompress and gzipDecompress", async () => {
  const compressed = await gzipCompress(sampleData);
  expect(compressed instanceof Buffer).toBe(true);
  const decompressed = await gzipDecompress(compressed);
  expect(decompressed.toString()).toBe(sampleData);
});

// deflateCompress & deflateDecompress
test("deflateCompress and deflateDecompress", async () => {
  const compressed = await deflateCompress(sampleData);
  expect(compressed instanceof Buffer).toBe(true);
  const decompressed = await deflateDecompress(compressed);
  expect(decompressed.toString()).toBe(sampleData);
});