import { URLPattern } from "urlpattern-polyfill/urlpattern";
import { RouteError } from "./error.util.js";
import { ENCODINGS } from "./http.util.js";
import { getBodyAsText, getFullUrl } from "./request.util.js";
import { constructUrlFromPatternAndParams } from "./router.util.js";
import { getFormData } from "./form.util.js";
Error.stackTraceLimit = 50;

/**
 * Retrieves the client's IP address from a request. It supports various platforms and server setups,
 * including Cloudflare Workers, AWS Lambda@Edge, Node.js/Express.js, Google Cloud Functions, Azure Functions,
 * Vercel, and Heroku. The function prioritizes different headers to find the IP based on the platform.
 *
 * @param {Request} request - The HTTP request object.
 * @returns {string | null} The client's IP address if available, otherwise null.
 */
function getClientIp(request) {
  try {
    // Cloudflare Workers
    if (request.cf?.ip) {
      return request.cf.ip;
    }
    const requestHeaders = new Headers(request.headers);

    // AWS Lambda@Edge (and other platforms that set 'X-Forwarded-For')
    const xForwardedFor = requestHeaders.get("x-forwarded-for");
    if (xForwardedFor) {
      return xForwardedFor.split(",")[0].trim();
    }

    // Node.js / Express.js (and similar environments)
    if (request.connection?.remoteAddress) {
      return request.connection.remoteAddress;
    }
    if (request.socket?.remoteAddress) {
      return request.socket.remoteAddress;
    }
    if (request.ip) {
      return request.ip; // Express.js specific
    }

    // Google Cloud Functions / Firebase Functions
    const xClientIp = requestHeaders.get("x-client-ip");
    if (xClientIp) {
      return xClientIp;
    }

    // Azure Functions
    const xAzureForwardedFor = requestHeaders.get("x-azure-forwarded-for");
    if (xAzureForwardedFor) {
      return xAzureForwardedFor.split(",")[0].trim();
    }

    // Vercel and some other platforms
    const xRealIp = requestHeaders.get("x-real-ip");
    if (xRealIp) {
      return xRealIp;
    }

    // Heroku and other platforms that use a reverse proxy
    const xForwarded = requestHeaders.get("forwarded");
    if (xForwarded) {
      const match = xForwarded.match(/for="\[?([^\]]+)\]?"/i);
      return match ? match[1] : null;
    }
  } catch (ex) {
    console.log("Error while getting client IP: ", ex);
  }

  // Fallback if IP address cannot be determined
  return null;
}
/**
 * Creates a proxy route configuration. The function proxies requests to a specified URL and optionally
 * caches responses and bypasses parsing. It also handles forwarding headers, client IP, and decoding
 * Brotli-compressed responses.
 * options: {
 *	 cache?: boolean;
 * }
 *
 * @param {string} path - The path pattern for the route.
 * @param {string | URL} proxyUrl - The URL to which the request should be proxied.
 * @param {Object} [options] - Optional settings for the proxy route such as caching and parsing bypass.
 * @returns {Route} A route configuration object.
 */
export const proxyRoute = (path, proxyUrl, options) => ({
  path,
  cache: options?.cache ?? true,
  isGraphQL: options?.isGraphQL ?? false,
  handler: async (req, params) => {
    let url = "";
    if (!(proxyUrl instanceof URL) && typeof proxyUrl === "function") {
      url = await proxyUrl(req, params);
    } else {
      url = proxyUrl.toString();
    }
    const fullUrl = getFullUrl(req);
    // Create requestURL object from the request's url
    const requestUrl = new URL(fullUrl);
    // Create proxyUrlObject from the proxyUrl
    const proxyUrlObject = new URL(url);

    /**
     * Update the proxyURLObject with the request's url
     */
    proxyUrlObject.search = requestUrl.search;
    proxyUrlObject.pathname = constructUrlFromPatternAndParams(new URLPattern({
      pathname: proxyUrlObject.pathname
    }), params);
    const error = new RouteError();
    try {
      const proxyHeaders = new Headers(req.headers);

      /**
       * Avoid the following headers from being sent to the proxy
       */
      proxyHeaders.delete("host");
      proxyHeaders.delete("connection");
      proxyHeaders.delete("Strict-Transport-Security");
      proxyHeaders.delete("Content-Security-Policy");
      proxyHeaders.delete("Public-Key-Pins");
      proxyHeaders.set("host", proxyUrlObject.host);
      proxyHeaders.set("X-Forwarded-Host", requestUrl.host);
      proxyHeaders.set("X-Forwarded-Proto", requestUrl.protocol.split(":")[0]);
      const clientIp = getClientIp(req);
      if (clientIp) {
        proxyHeaders.set("X-Forwarded-For", clientIp);
      }
      const proxyRequestInit = {
        method: req.method,
        credentials: req.credentials,
        headers: proxyHeaders
      };
      if (proxyHeaders.get("content-type")?.includes?.("multipart/form-data") && !options?.isGraphQL) {
        proxyHeaders.delete("content-length");
        proxyHeaders.delete("content-type");
        proxyRequestInit.body = await getFormData(req);
      }
      if (options?.isGraphQL && !['GET', 'HEAD'].includes(req.method)) {
        proxyHeaders.set("Content-Type", "application/json");
        proxyRequestInit.body = await getBodyAsText(req);
      }
      let response = await fetch(proxyUrlObject.toString(), proxyRequestInit);

      // Modify response to IDENTITY content-encoding
      // @todo: Once bun has inbuilt support for Brotli,
      // this won't be necessary
      const responseText = await response.text();
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('transfer-encoding');
      responseHeaders.set("content-encoding", ENCODINGS.IDENTITY);
      responseHeaders.set("content-length", responseText.length.toString());
      response = new Response(responseText, {
        status: response.status,
        headers: responseHeaders,
        statusText: response.statusText
      });
      if (!response.ok) {
        console.error("proxyUrlObject:: ", proxyUrlObject);
        console.error("proxyRequestInit ::", proxyRequestInit);
        console.error("response ::", response);
        const responseError = new RouteError(`Proxy request failed to url: ${requestUrl.toString()}`);
        responseError.statusCode = response.status;
        responseError.responseText = await response.text();
        throw responseError;
      }
      return response;
    } catch (ex) {
      if (ex instanceof RouteError) {
        throw ex;
      }
      if (ex instanceof Error) {
        error.message = ex.message;
        error.stack = ex.stack;
      }
      throw error;
    }
  }
});