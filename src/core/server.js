import { corsConfig, setCORSHeaders } from "./utils/cors.util.js";
import { getFormData } from "./utils/form.util.js";
import {
  ENCODINGS,
  cacheResponseObject,
  convertToCacheableObject,
  getRequestId as defaultGetRequestId,
} from "./utils/http.util.js";
import { getBodyAsText } from "./utils/request.util.js";
import {
  errorResponse,
  jsonResponse,
  notFoundResponse,
} from "./utils/response.util.js";
import { findMatchedRoute } from "./utils/router.util.js";
import http from "node:http";
import { Readable } from "node:stream";
import { finished } from "node:stream/promises";

const writeResponse = async (httpRes, response) => {
  httpRes.writeHead(response.status, Object.fromEntries(response.headers));

  if (response?.body instanceof ReadableStream) {
    // Convert the web ReadableStream to Node.js Readable stream
    const nodeReadableStream = Readable.fromWeb(response.body);

    // Pipe the converted stream to the response
    nodeReadableStream.pipe(httpRes);

    // Ensure the stream is properly finished
    await finished(nodeReadableStream);
  } else if (response?.body instanceof Readable) {
    // Directly pipe Node.js Readable stream to the response
    response.body.pipe(httpRes);

    // Ensure the stream is properly finished
    await finished(response.body);
  } else {
    // For non-stream responses, directly end the response with the body
    httpRes.end(response.body);
  }
};

/**
 * A set to keep track of ongoing background revalidation requests.
 */
const bgRequests = new Set();
export const run = async (routes, options) => {
  const cache = options?.cache;
  const getRequestId = options?.getRequestId || defaultGetRequestId;

  /**
   * Starts a server with defined hostname and port. The server handles incoming HTTP requests
   * and routes them based on the defined route handlers, while also handling CORS and caching.
   */
  const server = http.createServer(async (req, res) => {
    // Ignore requests for favicon.ico
    if (req.url.includes("/favicon.ico")) {
      writeResponse(res, notFoundResponse());
      return;
    }

    /**
     * Health Check should be defined before any request and needs does not
     * need to be cached!
     */
    if (req.url.includes("/healthcheck")) {
      writeResponse(
        res,
        jsonResponse({
          success: true,
          message: "Health Check is good.",
        })
      );
      return;
    }

    /**
     * Enable cors for all requests
     * @todo Add support for cors config per route and based on
     * domains that we already have in the list
     */
    if (corsConfig.enabled && req.method === "OPTIONS") {
      const headers = new Headers();
      setCORSHeaders(headers);
      res.writeHead(204, Object.fromEntries(headers));
      res.end();
      return;
    }

    // Find route based on request
    const r = findMatchedRoute(req, routes);

    // Collect form data
    await getFormData(req);

    if (!r?.route?.handler) {
      writeResponse(res, notFoundResponse());
      return;
    }

    const requestHeaders = new Headers(req.headers);
    // Respect no-cache
    const cacheRequest = !requestHeaders
      .get("cache-control")
      ?.includes?.("no-cache");

    let workWithCache = !!(
      // cache is available
      (
        cache &&
        // request is allowing cache
        cacheRequest &&
        // route is allowing cache
        r.route?.cache &&
        // Valid methods are used caching
        (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase()) ||
          r.route?.isGraphQL)
      )
    );
    /**
     * For graphql, do not cache any request
     * if the body contains mutate. mutation
     */
    if (r.route.isGraphQL) {
      const requestBody = await getBodyAsText(req);
      if (requestBody) {
        try {
          const parsedBody = JSON.parse(requestBody);
          if (!!parsedBody.mutate || !!parsedBody.mutation) {
            workWithCache = false;
          }
        } catch (ex) {
          console.error("Error while parsing graphql body.", ex);
          workWithCache = false;
        }
      }
    }
    const requestId = await getRequestId(req, r.route.isGraphQL);

    // array of acceptable encodings in the request
    const requestAcceptableEncodings = (
      requestHeaders.get("accept-encoding") || ENCODINGS.IDENTITY
    )
      .split(",")
      .map((t) => t.trim());

    try {
      let data;
      // Only execute stale while revalidate if the route is cacheable
      if (workWithCache) {
        // Get the cached data
        data = cache.get(requestId);

        // If the cache data body is not empty, execute stale while revalidate
        if (data?.body?.length) {
          // Revalidate in background
          (async () => {
            try {
              // If a background request is in progress, don't revalidate
              if (bgRequests.has(requestId)) return;
              bgRequests.add(requestId);
              const routeData = await r.route.handler(req, r.params);
              let resObj = await convertToCacheableObject(routeData, [
                ENCODINGS.BROTLI,
              ]);
              resObj = await cacheResponseObject(requestId, resObj);
            } catch (ex) {
              console.log(ex);
              // On error, it means two things here, either the handler failed,
              // or the caching failed. Either way, we need to remove the cache
              // to avoid serving stale data
              cache.delete(requestId);
            } finally {
              bgRequests.delete(requestId);
            }
          })();
          const headers = new Headers(data.headers);
          headers.set("X-Cache", "HIT");
          data.headers = Array.from(headers.entries());
        } else {
          data = undefined;
        }
      }
      // If there is no cached data, execute the handler
      if (!data) {
        const routeData = await r.route.handler(req, r.params);
        data = await convertToCacheableObject(
          routeData instanceof Response ? routeData.clone() : routeData,
          requestAcceptableEncodings
        );
        if (workWithCache) {
          // cache routeData in background
          (async () => {
            try {
              if (bgRequests.has(requestId)) return;
              bgRequests.add(requestId);
              cacheResponseObject(
                requestId,
                await convertToCacheableObject(
                  routeData instanceof Response ? routeData.clone() : routeData,
                  [ENCODINGS.BROTLI]
                )
              );
            } catch (ex) {
              console.error(ex);
            } finally {
              bgRequests.delete(requestId);
            }
          })();
        }
      }
      if (!data?.body?.length) {
        writeResponse(res, notFoundResponse());
        return;
      }

      const responseHeaders = new Headers(data.headers);
      if (!responseHeaders.get("x-cache")) {
        responseHeaders.set("X-Cache", "MISS");
      }
      setCORSHeaders(responseHeaders);
      writeResponse(
        res,
        new Response(data.body, {
          status: data.status,
          headers: responseHeaders,
        })
      );
      return;
    } catch (ex) {
      const errorRes = errorResponse(ex);
      setCORSHeaders(errorRes.headers);
      errorRes.headers.set("X-Cache", "ERROR");
      writeResponse(res, errorRes);
      return;
    }
  });

  server.timeout = 60000;
  server.headersTimeout = 0;
  server.keepAliveTimeout = 60000;

  server.listen(options?.port || 3000, options?.hostname || "localhost", () => {
    console.log(
      `Server running at http://${options?.hostname || "localhost"}:${
        options?.port || 3000
      }/`
    );
  });

  return server;
};
