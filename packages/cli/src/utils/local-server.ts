import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { URL } from 'node:url';

export interface LocalServerHandle {
  port: number;
  waitForCallback: () => Promise<Record<string, string>>;
  close: () => void;
}

/**
 * Starts a local HTTP server on a random available port.
 * Returns the port and a promise that resolves when the browser
 * redirects to /callback with query parameters.
 *
 * Used for the browser→CLI token handoff pattern:
 * 1. CLI passes `port` to the auth session start request
 * 2. After browser auth, vocoder.app redirects to localhost:<port>/callback?token=...
 * 3. `waitForCallback()` resolves with the query params
 */
export function startCallbackServer(): Promise<LocalServerHandle> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let callbackResolve: ((params: Record<string, string>) => void) | null = null;
    let callbackReject: ((err: Error) => void) | null = null;

    const callbackPromise = new Promise<Record<string, string>>((res, rej) => {
      callbackResolve = res;
      callbackReject = rej;
    });

    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end();
        return;
      }

      let pathname: string;
      let params: Record<string, string>;

      try {
        const parsed = new URL(req.url, 'http://localhost');
        pathname = parsed.pathname;
        params = Object.fromEntries(parsed.searchParams.entries());
      } catch {
        res.writeHead(400);
        res.end('Bad request');
        return;
      }

      if (pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<!DOCTYPE html><html><head><title>Authenticated</title></head>' +
          '<body style="font-family:sans-serif;text-align:center;padding:3rem;">' +
          '<h2>Authenticated</h2>' +
          '<p>Return to your terminal to continue. You can close this tab.</p>' +
          '</body></html>',
      );

      if (callbackResolve) {
        callbackResolve(params);
        callbackResolve = null;
      }

      setImmediate(() => server.close());
    });

    server.on('error', (err) => {
      if (!settled) {
        settled = true;
        if (callbackReject) callbackReject(err);
        reject(err);
      }
    });

    // Bind to a random port on localhost only
    server.listen(0, '127.0.0.1', () => {
      if (settled) return;
      settled = true;

      const port = (server.address() as AddressInfo).port;

      resolve({
        port,
        waitForCallback: () => callbackPromise,
        close: () => server.close(),
      });
    });
  });
}
