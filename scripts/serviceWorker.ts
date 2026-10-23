import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const SERVICE_WORKER_FILE = 'sw.js';
const CACHE_PREFIX = 'mana-duel-';

interface ExtendableEvent {
  waitUntil(promise: Promise<unknown>): void;
}

interface FetchEvent extends ExtendableEvent {
  request: Request;
  respondWith(response: Promise<Response>): void;
}

export interface WorkerScope {
  registration: { scope: string };
  location: { origin: string };
  clients: { claim(): Promise<void> };
  skipWaiting(): Promise<void>;
  fetch(request: Request): Promise<Response>;
  addEventListener(type: 'install' | 'activate', listener: (event: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: FetchEvent) => void): void;
}

export function serviceWorker(
  scope: WorkerScope,
  caches: CacheStorage,
  prefix: string,
  version: string,
  files: string[],
): void {
  const cacheName = prefix + version;
  const home = scope.registration.scope;
  const urls = [home, ...files.map((file) => new URL(file, home).href)];

  scope.addEventListener('install', (event) => {
    event.waitUntil(
      caches
        .open(cacheName)
        .then((cache) => cache.addAll(urls))
        .then(() => scope.skipWaiting()),
    );
  });

  scope.addEventListener('activate', (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names.filter((name) => name.startsWith(prefix) && name !== cacheName).map((name) => caches.delete(name)),
          ),
        )
        .then(() => scope.clients.claim()),
    );
  });

  scope.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || new URL(request.url).origin !== scope.location.origin) return;
    if (request.mode === 'navigate') {
      event.respondWith(
        scope
          .fetch(request)
          .catch(() =>
            caches.match(home, { cacheName, ignoreVary: true }).then((cached) => cached ?? Response.error()),
          ),
      );
      return;
    }
    event.respondWith(
      caches.match(request, { cacheName, ignoreVary: true }).then((cached) => cached ?? scope.fetch(request)),
    );
  });
}

export function serviceWorkerSource(version: string, files: string[]): string {
  const args = [CACHE_PREFIX, version, files].map((value) => JSON.stringify(value)).join(', ');
  return `(${serviceWorker.toString()})(self, caches, ${args});\n`;
}

function publicFiles(dir: string): { file: string; content: Buffer }[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return {
        file: path
          .slice(dir.length + 1)
          .split('\\')
          .join('/'),
        content: readFileSync(path),
      };
    });
}

export function serviceWorkerPlugin(): Plugin {
  let publicDir = '';
  return {
    name: 'mana-duel-service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const emitted = Object.values(bundle).map((output) => ({
        file: output.fileName,
        content: output.type === 'chunk' ? output.code : output.source,
      }));
      const entries = [...emitted, ...(publicDir ? publicFiles(publicDir) : [])]
        .filter(({ file }) => file !== SERVICE_WORKER_FILE)
        .sort((a, b) => a.file.localeCompare(b.file));
      const hash = createHash('sha256');
      for (const { file, content } of entries) hash.update(file).update(content);
      this.emitFile({
        type: 'asset',
        fileName: SERVICE_WORKER_FILE,
        source: serviceWorkerSource(
          hash.digest('hex').slice(0, 12),
          entries.map(({ file }) => file),
        ),
      });
    },
  };
}
