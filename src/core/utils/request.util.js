import { URL } from 'node:url';
import { IncomingMessage } from 'node:http';
import { requestMemoize } from './memoize.util.js';

export const getBodyAsText = requestMemoize(collectRequestBody);

async function collectRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    
    // Check if 'req' is an instance of 'IncomingMessage'
    if (req instanceof IncomingMessage) {
      if (req.method === 'GET' || req.method === 'HEAD') {
        resolve('');
        return;
      }
      req.on('data', chunk => {
        chunks.push(chunk);
      });
      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString());
      });
      req.on('error', err => {
        reject(err);
      });
    } else if (req instanceof Request) {
      // Check if 'req' is an instance of 'Request' (Fetch API)
      const reader = req.body.getReader();
      reader.read().then(function processText({ done, value }) {
        if (done) {
          resolve(Buffer.concat(chunks).toString());
          return;
        }
        chunks.push(value);
        return reader.read().then(processText);
      }).catch(err => {
        reject(err);
      });
    }
    else {
      reject(new Error('The request object is neither an IncomingMessage nor a Request'));
    }
  });
}

/**
 * Returns the full URL of a request, considering possible proxy headers.
 *
 * @param {http.IncomingMessage} req - The HTTP request object.
 * @returns {string} The full URL.
 */
export const getFullUrl = requestMemoize((req) => {
  // Extract the protocol from X-Forwarded-Proto or fall back to the request connection encryption state
  const protocol = req.headers['x-forwarded-proto'] || (req?.connection?.encrypted ? 'https' : 'http');
  
  // Extract the host from X-Forwarded-Host or fall back to the host header
  const host = req.headers['x-forwarded-host'] || req.headers.host;

  // Get the full URL including protocol, host, and path
  const fullUrl = new URL(req.url, `${protocol}://${host}`);

  return fullUrl.href;
});
