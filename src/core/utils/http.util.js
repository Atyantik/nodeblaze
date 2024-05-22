import { getCacheInstance } from "./cache.util.js";
import {
  brotliCompress,
  brotliDecompress,
  deflateCompress,
  deflateDecompress,
  gzipCompress,
  gzipDecompress,
} from "./compress.util.js";
import { hash } from "./hash.util.js";
import { requestMemoize } from "./memoize.util.js";
import { getBodyAsText, getFullUrl } from "./request.util.js";

export const ENCODINGS = {
  BROTLI: "br",
  GZIP: "gzip",
  DEFLATE: "deflate",
  IDENTITY: "identity",
};
/**
 * Generates a unique request identifier for an HTTP request. This function leverages memoization to cache and
 * retrieve identifiers for identical requests efficiently, using the `requestMemoize` utility. The identifier
 * is created by first extracting the URL from the request and an optional unique header ('x-unique-id').
 * It then uses the `getUrlId` function to generate a hashed identifier based on the URL and the unique header.
 *
 * @param {Request} request - The HTTP request object for which the unique ID is generated.
 * @param {boolean} useBodyText - When need to use body text for considering cache key.
 * @returns {string} A unique identifier for the request, prefixed with 'req:'.
 *
 * @example
 * // Generate a request ID
 * const reqId = await getRequestId(new Request('http://example.com/path'), false);
 * // returns 'req:<hashed_value_of_the_URL>'
 *
 * @note This function is memoized, so calling it multiple times with the same request
 * will return the same identifier without recomputing it.
 */
export const getRequestId = requestMemoize(async (request, useBodyText) => {
  const urlId = getUrlId(getFullUrl(request));
  const bodyId = useBodyText ? await getBodyId(request) : "";
  const headersId = getHeadersId(request);
  const hashes = [urlId, bodyId, headersId].filter(Boolean).join(":");
  const uniqueHash = hash(hashes);
  return `req:${uniqueHash}`;
});

const getHeadersId = (request) => {
  const requestHeaders = new Headers(request.headers);
  const uniqueHeaders = [
    requestHeaders.get("x-unique-id") || "",
    requestHeaders.get("authorization") || "",
  ].filter(Boolean);
  const allHeaders = uniqueHeaders.join(":");
  return `h:${hash(allHeaders)}`;
};

const getBodyId = async (request) => {
  const body = await getBodyAsText(request);
  return `b:${hash(body)}`;
};

/**
 * Generates a unique identifier for a given URL. This function processes the URL by sorting its query parameters
 * and optionally prepending a prefix, then hashes the result to create a unique identifier.
 * 
 * @param {string | URL} url - The URL (or URL string) for which the unique ID is generated.
 * @param {string} [prefix=''] - An optional prefix added before the URL pathname in the ID generation process.
 * @returns {string} A unique identifier for the URL, prefixed with 'u:'.
 *
 * @example
 * // With a URL string and no prefix
 * getUrlId('http://example.com/path?b=2&a=1');
 * // returns 'u:<hashed_value_of_/path?a=1&b=2>'
 *
 * @example
 * // With a URL object and a prefix
 * getUrlId(new URL('http://example.com/path?b=2&a=1'), 'prefix-');
 * // returns 'u:<hashed_value_of_prefix-/path?a=1&b=2>'
 */
export const getUrlId = (url, prefix = '') => {
	const urlObj = new URL(url);

	// Sort the search parameters by their keys
	urlObj.search = new URLSearchParams(
		Array.from(urlObj.searchParams).sort((a, b) => a[0].localeCompare(b[0])),
	).toString();

	// Construct the URL with sorted search parameters
	const exceptHost = prefix
		+ urlObj.pathname
		+ (urlObj.search ? urlObj.search : "");

	const uniqueUrlKey = hash(exceptHost);

	return `u:${uniqueUrlKey}`;
};

/**
 * Compresses data using a specified encoding. Supports 'br' (Brotli),
 * 'gzip', and 'deflate' encodings. For 'identity' encoding, it returns
 * the original data.
 *
 * @param {string | ArrayBuffer | NodeJS.ArrayBufferView} data - The data to compress, either as a string or Uint8Array.
 * @param {string} encoding - The compression encoding to use.
 * @returns {Promise<Buffer>} A promise that resolves to the compressed data as a Uint8Array.
 */
export const compressData = async (data, encoding) => {
  switch (encoding) {
    case ENCODINGS.BROTLI:
      return brotliCompress(data);
    case ENCODINGS.GZIP:
      return gzipCompress(data);
    case ENCODINGS.DEFLATE:
      return deflateCompress(data);
    case ENCODINGS.IDENTITY:
      return typeof data === "string" ? Buffer.from(data, 'utf-8') : data;
    default:
      throw new Error("Invalid encoding provided for compressData");
  }
};

/**
 * Compresses the content of an HTTP response using a specified encoding.
 * It first decompresses the response (if needed) and then recompresses it.
 *
 * @param {Response} response - The HTTP response object to compress.
 * @param {string} [dataEncoding='br'] - The encoding to use for compression (default is Brotli).
 * @returns {Promise<Buffer>} A promise that resolves to the compressed response content.
 */
export async function compressResponse(
  response,
  dataEncoding = ENCODINGS.BROTLI
) {
  const decompressedData = await response.text();
  const compressedData = await compressData(decompressedData, dataEncoding);
  return compressedData;
}

/**
 * Compresses a string using a specified encoding.
 *
 * @param {string} data - The string data to compress.
 * @param {string} [dataEncoding='br'] - The encoding to use for compression (default is Brotli).
 * @returns {Promise<Buffer>} A promise that resolves to the compressed data as a Uint8Array.
 */
export async function compressString(data, dataEncoding = ENCODINGS.BROTLI) {
  return compressData(data, dataEncoding);
}

/**
 * Converts data or an HTTP response into a cacheable object. It compresses
 * the data and sets appropriate response headers.
 *
 * @param {JsonValue | Response} [data] - The data or HTTP response to convert.
 * @param {string[]} [acceptableEncodings=['br', 'gzip', 'deflate']] - An array of acceptable encodings for compression.
 * @returns {Promise<ResponseCacheableObject>} A promise that resolves to the cacheable response object.
 * @throws {Error} Throws an error if no acceptable encodings are provided.
 */
export const convertToCacheableObject = async (
  data,
  acceptableEncodings = [ENCODINGS.BROTLI, ENCODINGS.GZIP, ENCODINGS.DEFLATE]
) => {
  if (!acceptableEncodings || !acceptableEncodings.length) {
    throw new Error("Please provide array of acceptable encodings");
  }

  const preferredEncodings = [
    ENCODINGS.BROTLI,
    ENCODINGS.GZIP,
    ENCODINGS.DEFLATE,
    ENCODINGS.IDENTITY,
  ];

  const dataEncoding =
    preferredEncodings.find((enc) => acceptableEncodings.includes(enc)) ||
    ENCODINGS.IDENTITY;

  let compressedData;
  let responseHeaders;
  let status;

  if (data instanceof Response) {
    compressedData = await compressResponse(data, dataEncoding);
    responseHeaders = new Headers(data.headers);
    status = data.status;
  } else {
    responseHeaders = new Headers();
    let stringData = "";
    if (typeof data === "string") {
      stringData = data;
      responseHeaders.set("content-type", "text/plain");
    } else if (typeof data === "object" && data !== null) {
      stringData = JSON.stringify(data);
      responseHeaders.set("content-type", "application/json");
    }
    compressedData = await compressString(stringData, dataEncoding);
    status = 200;
  }
  responseHeaders.set("content-encoding", dataEncoding);
  responseHeaders.set("content-length", compressedData.length);

  return {
    body: compressedData,
    status,
    headers: Array.from(responseHeaders.entries()),
  };
};

/**
 * Caches a response object with a unique request ID and updates the
 * 'x-cache-date' header to the current time.
 *
 * @param {string} requestId - The unique request ID associated with the response object.
 * @param {ResponseCacheableObject} responseObj - The response object to cache.
 * @returns {Promise<ResponseCacheableObject>} A promise that resolves to the updated response object.
 */
export const cacheResponseObject = async (requestId, responseObj) => {
  // Set cache-date header
  const headers = new Headers(responseObj.headers);
  headers.set("x-cache-date", new Date().toISOString());
  responseObj.headers = Array.from(headers.entries());

  const cache = getCacheInstance();
  cache.set(requestId, responseObj);
  return responseObj;
};

/**
 * Converts a cached response object to match a set of acceptable encodings,
 * re-compressing the content if necessary.
 *
 * @param {ResponseCacheableObject} cacheableObj - The cached response object to convert.
 * @param {string[]} acceptableEncodings - An array of acceptable content encodings.
 * @returns {Promise<ResponseCacheableObject>} A promise that resolves to the converted response object.
 * @throws {Error} Throws an error if no expected encoding is found or no acceptable encodings are provided.
 */
export const convertCacheableObject = async (
  cacheableObj,
  acceptableEncodings
) => {
  const newResponseObj = {
    body: new Uint8Array(),
    status: cacheableObj.status,
    headers: cacheableObj.headers,
  };
  const headers = new Headers(cacheableObj.headers);
  const currentEncoding = headers.get("content-encoding");

  if (!acceptableEncodings || !acceptableEncodings.length) {
    throw new Error("Please provide array of acceptable encodings");
  }

  // Define the order of preference for compression methods
  const preferredEncodings = [
    ENCODINGS.BROTLI,
    ENCODINGS.GZIP,
    ENCODINGS.DEFLATE,
    ENCODINGS.IDENTITY,
  ];

  // Find the first supported encoding
  const expectedEncoding =
    preferredEncodings.find((enc) => acceptableEncodings.includes(enc)) ||
    ENCODINGS.IDENTITY;

  if (currentEncoding === expectedEncoding) return cacheableObj;

  let decompressedData;
  if (currentEncoding === ENCODINGS.BROTLI) {
    decompressedData = (await brotliDecompress(cacheableObj.body)).toString();
  } else if (currentEncoding === ENCODINGS.GZIP) {
    decompressedData = (await gzipDecompress(cacheableObj.body)).toString();
  } else if (currentEncoding === ENCODINGS.DEFLATE) {
    decompressedData = (await deflateDecompress(cacheableObj.body)).toString();
  } else if (currentEncoding === ENCODINGS.IDENTITY) {
    decompressedData = new TextDecoder().decode(cacheableObj.body);
  }

  let convertedCompressedData = new Uint8Array();
  switch (expectedEncoding) {
    case ENCODINGS.BROTLI:
      convertedCompressedData = await brotliCompress(decompressedData);
      break;
    case ENCODINGS.GZIP:
      convertedCompressedData = await gzipCompress(decompressedData);
      break;
    case ENCODINGS.DEFLATE:
      convertedCompressedData = await deflateCompress(decompressedData);
      break;
    case ENCODINGS.IDENTITY:
      convertedCompressedData = new TextEncoder().encode(decompressedData);
      break;
  }
  if (!convertedCompressedData.length) {
    throw new Error("No expected encoding found");
  }
  newResponseObj.body = convertedCompressedData;
  const newResponseObjHeaders = new Headers(cacheableObj.headers);
  newResponseObjHeaders.set("content-encoding", expectedEncoding);
  newResponseObjHeaders.set(
    "content-length",
    convertedCompressedData.length.toString()
  );
  newResponseObj.headers = Array.from(newResponseObjHeaders.entries());
  return newResponseObj;
};
