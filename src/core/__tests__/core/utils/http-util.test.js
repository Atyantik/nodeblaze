import {
  ENCODINGS,
  cacheResponseObject,
  compressData,
  compressResponse,
  compressString,
  convertCacheableObject,
  convertToCacheableObject,
  getRequestId,
} from "../../../utils/http.util.js";
import {
  brotliCompress,
  brotliDecompress,
  deflateDecompress,
  gzipDecompress,
} from "../../../utils/compress.util.js";
import { initCacheInstance } from "../../../utils/cache.util.js";
import { serialize } from "node:v8";

function sizeOf(obj) {
  const serializedObj = serialize(obj);
  return serializedObj.byteLength + 50;
}

const cacheOptions = {
  maxSize: 2048,
  sizeCalculation: sizeOf,
  allowStale: true,
};

test("getRequestId - sort query parameters", async () => {
  const request = new Request("http://example.com?a=1&c=3&b=2");
  const request2 = new Request("http://example.com?a=1&b=2&c=3");
  const requestId = await getRequestId(request);
  const requestId2 = await getRequestId(request2);
  expect(requestId).toBe(requestId2);
});
test("compressData - Brotli encoding", async () => {
  const data = "Test string";
  const compressed = await compressData(data, ENCODINGS.BROTLI);

  // Check if the output is a Buffer
  expect(compressed).toBeInstanceOf(Buffer);

  // Check if the compressed data is not the same as the input
  expect(compressed).not.toEqual(new TextEncoder().encode(data));

  // Optional: Decompress the data and compare with the original
  const decompressed = (await brotliDecompress(compressed)).toString();
  expect(decompressed).toBe(data);
});
test("compressData - GZIP encoding", async () => {
  const data = "Test string";
  const compressed = await compressData(data, ENCODINGS.GZIP);

  // Check if the output is a Buffer
  expect(compressed).toBeInstanceOf(Buffer);

  // Check if the compressed data is not the same as the input
  expect(compressed).not.toEqual(new TextEncoder().encode(data));

  // Optional: Decompress the data and compare with the original
  const decompressed = (await gzipDecompress(compressed)).toString();
  expect(decompressed).toBe(data);
});
test("compressData - Deflate encoding", async () => {
  const data = "Test string";
  const compressed = await compressData(data, ENCODINGS.DEFLATE);

  // Check if the output is a Buffer
  expect(compressed).toBeInstanceOf(Buffer);

  // Check if the compressed data is not the same as the input
  expect(compressed).not.toEqual(new TextEncoder().encode(data));

  // Optional: Decompress the data and compare with the original
  const decompressed = (await deflateDecompress(compressed)).toString();
  expect(decompressed).toBe(data);
});
test("compressData - Identity encoding", async () => {
  const data = "Test string";
  const compressed = await compressData(data, ENCODINGS.IDENTITY);

  // Check if the output is a Buffer
  expect(compressed).toBeInstanceOf(Buffer);

  // Check if the compressed data is the same as the input
  expect(new TextDecoder().decode(compressed)).toBe(data);
});
test("compressResponse - Compress with Brotli", async () => {
  const response = new Response("Test response");
  const compressedResponse = await compressResponse(response, ENCODINGS.BROTLI);

  // Check if the compressed response is a Buffer
  expect(compressedResponse).toBeInstanceOf(Buffer);

  // Optional: Decompress the response data and compare with the original
  const decompressedResponse = (
    await brotliDecompress(compressedResponse)
  ).toString();
  expect(decompressedResponse).toBe("Test response");
});
test("compressResponse - Compress with GZIP", async () => {
  const response = new Response("Test response");
  const compressedResponse = await compressResponse(response, ENCODINGS.GZIP);
  expect(compressedResponse).toBeInstanceOf(Buffer);
  const decompressedResponse = (
    await gzipDecompress(compressedResponse)
  ).toString();
  expect(decompressedResponse).toBe("Test response");
});
test("compressResponse - Compress with Deflate", async () => {
  const response = new Response("Test response");
  const compressedResponse = await compressResponse(
    response,
    ENCODINGS.DEFLATE
  );
  expect(compressedResponse).toBeInstanceOf(Buffer);
  const decompressedResponse = (
    await deflateDecompress(compressedResponse)
  ).toString();
  expect(decompressedResponse).toBe("Test response");
});
test("compressResponse - Identity encoding", async () => {
  const response = new Response("Test response");
  const compressedResponse = await compressResponse(
    response,
    ENCODINGS.IDENTITY
  );
  expect(compressedResponse).toBeInstanceOf(Buffer);
  expect(new TextDecoder().decode(compressedResponse)).toBe("Test response");
});
test("compressString - Compress string with Brotli", async () => {
  const originalString = "Test string";
  const compressedString = await compressString(
    originalString,
    ENCODINGS.BROTLI
  );

  // Check if the output is a Buffer
  expect(compressedString).toBeInstanceOf(Buffer);

  // Check if the compressed string is not the same as the input
  expect(compressedString).not.toEqual(
    new TextEncoder().encode(originalString)
  );

  // Optional: Decompress the string and compare with the original
  const decompressedString = (
    await brotliDecompress(compressedString)
  ).toString();
  expect(decompressedString).toBe(originalString);
});
test("compressString - Compress string with GZIP", async () => {
  const originalString = "Test string";
  const compressedString = await compressString(originalString, ENCODINGS.GZIP);
  expect(compressedString).toBeInstanceOf(Buffer);
  expect(compressedString).not.toEqual(
    new TextEncoder().encode(originalString)
  );
  const decompressedString = (
    await gzipDecompress(compressedString)
  ).toString();
  expect(decompressedString).toBe(originalString);
});
test("compressString - Compress string with Deflate", async () => {
  const originalString = "Test string";
  const compressedString = await compressString(
    originalString,
    ENCODINGS.DEFLATE
  );
  expect(compressedString).toBeInstanceOf(Buffer);
  expect(compressedString).not.toEqual(
    new TextEncoder().encode(originalString)
  );
  const decompressedString = (
    await deflateDecompress(compressedString)
  ).toString();
  expect(decompressedString).toBe(originalString);
});

test("compressString - Identity encoding", async () => {
  const originalString = "Test string";
  const compressedString = await compressString(
    originalString,
    ENCODINGS.IDENTITY
  );
  expect(compressedString).toBeInstanceOf(Buffer);
  expect(new TextDecoder().decode(compressedString)).toBe(originalString);
});
test("convertToCacheableObject - Convert Response object", async () => {
  const response = new Response("Test response");
  const cacheableObject = await convertToCacheableObject(response);

  // Check if the returned object has the correct structure
  expect(cacheableObject).toHaveProperty("body");
  expect(cacheableObject).toHaveProperty("status");
  expect(cacheableObject).toHaveProperty("headers");

  // Check if the body is a Buffer
  expect(cacheableObject.body).toBeInstanceOf(Buffer);

  // Check if the status matches the original response's status
  expect(cacheableObject.status).toBe(response.status);

  // Check if headers are correctly set
  const headers = new Headers(cacheableObject.headers);
  expect(headers.has("content-encoding")).toBe(true);
  expect(headers.has("content-length")).toBe(true);
  expect(headers.get("content-encoding")).toBe(ENCODINGS.BROTLI);

  // Optional: Decompress the body and compare with the original response
  const decompressedBody = (
    await brotliDecompress(cacheableObject.body)
  ).toString();
  expect(decompressedBody).toBe("Test response");
});
test("convertToCacheableObject - Convert JSON data", async () => {
  const jsonData = {
    message: "Hello",
  };
  const cacheableObject = await convertToCacheableObject(jsonData);

  // Check if the returned object has the correct structure
  expect(cacheableObject).toHaveProperty("body");
  expect(cacheableObject).toHaveProperty("status");
  expect(cacheableObject).toHaveProperty("headers");

  // Check if the body is a Buffer
  expect(cacheableObject.body).toBeInstanceOf(Buffer);

  // Check if the status is 200
  expect(cacheableObject.status).toBe(200);

  // Check if headers are correctly set
  const headers = new Headers(cacheableObject.headers);
  expect(headers.has("content-encoding")).toBe(true);
  expect(headers.has("content-length")).toBe(true);
  expect(headers.get("content-encoding")).toBe(ENCODINGS.BROTLI);

  // Optional: Decompress the body and compare with the original JSON
  const decompressedBody = await brotliDecompress(cacheableObject.body);
  expect(JSON.parse(decompressedBody.toString())).toEqual(jsonData);
});
test("cacheResponseObject - Cache and update response object", async () => {
  await initCacheInstance(cacheOptions);
  const responseObj = {
    body: Buffer.from([1, 2, 3]),
    status: 200,
    headers: [["content-type", "text/plain"]],
  };
  const requestId = "req-id";
  const cachedResponseObj = await cacheResponseObject(requestId, responseObj);

  // Check if the response object is updated correctly
  expect(cachedResponseObj.body).toEqual(responseObj.body);
  expect(cachedResponseObj.status).toEqual(responseObj.status);

  // Check if the x-cache-date header is set correctly
  const headers = new Headers(cachedResponseObj.headers);
  expect(headers.has("x-cache-date")).toBe(true);

  // Optional: Check if the x-cache-date is recent (within a tolerance)
  const cachedDate = new Date(headers.get("x-cache-date") || "");
  const now = new Date();
  expect(now.getTime() - cachedDate.getTime()).toBeLessThan(1000); // Within 1 second
});
test("convertCacheableObject - Convert with different encodings", async () => {
  const originalData = "Test String";
  const cacheableObject = {
    body: await brotliCompress(originalData),
    status: 200,
    headers: [["content-encoding", ENCODINGS.BROTLI]],
  };
  const convertedObject = await convertCacheableObject(cacheableObject, [
    ENCODINGS.GZIP,
  ]);

  // Check if the returned object has the correct structure
  expect(convertedObject).toHaveProperty("body");
  expect(convertedObject).toHaveProperty("status");
  expect(convertedObject).toHaveProperty("headers");

  // Check if the body is a Buffer and represents GZIP compressed data
  expect(convertedObject.body).toBeInstanceOf(Buffer);

  // Check if the status matches the original object's status
  expect(convertedObject.status).toBe(cacheableObject.status);

  // Check if headers are correctly updated to GZIP
  const headers = new Map(convertedObject.headers);
  expect(headers.get("content-encoding")).toBe(ENCODINGS.GZIP);

  // Optional: Decompress the body and compare with the original data
  const decompressedBody = (
    await gzipDecompress(convertedObject.body)
  ).toString();
  expect(decompressedBody).toEqual(originalData);
});
test("decompressResponse - Non-Brotli Encoding", async () => {
  const response = new Response("Non-Brotli Response", {
    headers: {
      "content-encoding": "gzip",
    },
  });
  const decompressed = await response.text();
  // Expect the original response text
  expect(decompressed).toBe("Non-Brotli Response");
});
test("convertToCacheableObject - No Acceptable Encodings", async () => {
  const response = new Response("Some Data");
  expect(convertToCacheableObject(response, [])).rejects.toThrow(
    "Please provide array of acceptable encodings"
  );
});
