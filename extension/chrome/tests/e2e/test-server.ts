import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';

export interface FixtureServer {
  origin: string;
  url(path: string): string;
  close(): Promise<void>;
}

const FIXTURES: Record<string, { content: string; contentType: string; filename: string }> = {
  '/downloads/downly-e2e-note.txt': {
    content: 'Downly E2E fixture\n',
    contentType: 'text/plain; charset=utf-8',
    filename: 'downly-e2e-note.txt',
  },
  '/downloads/downly-e2e-report.pdf': {
    content: '%PDF-1.4\n% Downly E2E fixture\n',
    contentType: 'application/pdf',
    filename: 'downly-e2e-report.pdf',
  },
};

export async function startFixtureServer(): Promise<FixtureServer> {
  const server = createServer((request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;

    if (pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(`
        <!doctype html>
        <html lang="en">
          <head><title>Downly E2E fixtures</title></head>
          <body>
            <a href="/downloads/downly-e2e-note.txt">Download text fixture</a>
            <a href="/downloads/downly-e2e-report.pdf">Download report fixture</a>
          </body>
        </html>
      `);
      return;
    }

    const fixture = FIXTURES[pathname];
    if (!fixture) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }

    response.writeHead(200, {
      'content-disposition': `attachment; filename="${fixture.filename}"`,
      'content-length': Buffer.byteLength(fixture.content),
      'content-type': fixture.contentType,
    });
    response.end(fixture.content);
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${address.port}`;

  return {
    origin,
    url(path: string) {
      return new URL(path, origin).toString();
    },
    close() {
      return closeServer(server);
    },
  };
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
