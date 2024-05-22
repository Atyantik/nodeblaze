import { promisify } from 'node:util';
import {
  brotliCompress as nodeBrotliCompress,
  brotliDecompress as nodeBrotliDecompress,
  gzip,
  gunzip,
  deflate,
  inflate,
  constants,
} from 'node:zlib';

const brotliOptions = {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11, // Moderate compression level (1-11)
    [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT, // Text mode for better compatibility
  },
};

// Promisify zlib functions with Brotli options
export const gzipCompress = promisify(gzip);
export const gzipDecompress = promisify(gunzip);
export const deflateCompress = promisify(deflate);
export const deflateDecompress = promisify(inflate);
export const brotliCompress = promisify((data, callback) => nodeBrotliCompress(data, brotliOptions, callback));
export const brotliDecompress = promisify(nodeBrotliDecompress);