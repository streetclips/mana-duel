import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import {
  SERVICE_WORKER_FILE,
  serviceWorker,
  serviceWorkerPlugin,
  serviceWorkerSource,
  type WorkerScope,
} from '../scripts/serviceWorker';
import { LOCALES, withLocale } from '../src/i18n';
import { commonText } from '../src/ui/text/common';

const SCOPE = 'https://game.test/mana-duel/';

interface Manifest {
  id: string;
  name: string;
  short_name: string;
  description: string;
  lang: string;
  start_url: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose?: string }[];
}

function readManifest(locale: string): Manifest {
  return JSON.parse(readFileSync(new URL(`../public/manifest.${locale}.webmanifest`, import.meta.url), 'utf8'));
}

function pngSize(path: URL): string {
  const png = readFileSync(path);
  return `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
}

describe('the web app manifests', () => {
  it('name the game in each language as its title does', () => {
    for (const locale of LOCALES) {
      const manifest = readManifest(locale);
      const text = withLocale(locale, () => commonText());
      expect(manifest.lang).toBe(locale);
      expect(manifest.name).toBe(text.title);
      expect(manifest.description).toBe(text.description);
      expect(manifest.short_name.length).toBeLessThanOrEqual(12);
    }
  });

  it('describe the same standalone app in every language', () => {
    const [first, ...others] = LOCALES.map(readManifest);
    for (const manifest of others) {
      expect({ ...manifest, name: '', short_name: '', description: '', lang: '' }).toEqual({
        ...first,
        name: '',
        short_name: '',
        description: '',
        lang: '',
      });
    }
    expect(first).toMatchObject({ id: './', start_url: './', display: 'standalone' });
  });

  it('list icons that exist at their stated sizes, one of them maskable', () => {
    const { icons } = readManifest('es');
    for (const icon of icons) {
      const path = new URL(`../public/${icon.src}`, import.meta.url);
      if (icon.type === 'image/png') expect(pngSize(path)).toBe(icon.sizes);
      else expect(readFileSync(path, 'utf8')).toContain('<svg');
    }
    expect(icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
    expect(icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
    expect(pngSize(new URL('../public/icons/apple-touch-icon.png', import.meta.url))).toBe('180x180');
  });
});

type Listener = (event: never) => void;

class FakeCaches {
  readonly stores = new Map<string, Map<string, Response>>();

  open(name: string): Promise<Cache> {
    const store = this.stores.get(name) ?? new Map<string, Response>();
    this.stores.set(name, store);
    const cache = {
      addAll: (urls: string[]) => {
        for (const url of urls) store.set(url, new Response(`cached ${url}`));
        return Promise.resolve();
      },
    };
    return Promise.resolve(cache as unknown as Cache);
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.stores.keys()]);
  }

  delete(name: string): Promise<boolean> {
    return Promise.resolve(this.stores.delete(name));
  }

  match(request: Request | string, options?: { cacheName?: string }): Promise<Response | undefined> {
    const url = typeof request === 'string' ? request : request.url;
    const store = options?.cacheName ? this.stores.get(options.cacheName) : undefined;
    return Promise.resolve(store?.get(url)?.clone());
  }
}

interface Worker {
  caches: FakeCaches;
  claimed: () => boolean;
  install(): Promise<void>;
  activate(): Promise<void>;
  fetch(request: Partial<Request>): Promise<Response> | undefined;
  setOnline(online: boolean): void;
}

function worker(start: (scope: WorkerScope, caches: CacheStorage) => void): Worker {
  const caches = new FakeCaches();
  const listeners = new Map<string, Listener>();
  let claimed = false;
  let online = true;
  const scope: WorkerScope = {
    registration: { scope: SCOPE },
    location: { origin: new URL(SCOPE).origin },
    clients: {
      claim: () => {
        claimed = true;
        return Promise.resolve();
      },
    },
    skipWaiting: () => Promise.resolve(),
    fetch: (request) =>
      online ? Promise.resolve(new Response(`network ${request.url}`)) : Promise.reject(new TypeError('offline')),
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
  };
  start(scope, caches as unknown as CacheStorage);
  const dispatch = (type: string, event: object): void => (listeners.get(type) as (event: object) => void)(event);
  const lifecycle = async (type: string): Promise<void> => {
    let done: Promise<unknown> = Promise.resolve();
    dispatch(type, { waitUntil: (promise: Promise<unknown>) => (done = promise) });
    await done;
  };
  return {
    caches,
    claimed: () => claimed,
    install: () => lifecycle('install'),
    activate: () => lifecycle('activate'),
    fetch: (request) => {
      let response: Promise<Response> | undefined;
      dispatch('fetch', {
        request: { method: 'GET', mode: 'cors', ...request },
        respondWith: (promise: Promise<Response>) => (response = promise),
      });
      return response;
    },
    setOnline: (value) => {
      online = value;
    },
  };
}

const text = (response: Promise<Response> | undefined): Promise<string> | undefined => response?.then((r) => r.text());

describe('the service worker', () => {
  const files = ['index.html', 'assets/index-abc.js', 'cards/ember_snap.svg'];

  it('caches the start page and every file of the build when it installs', async () => {
    const sw = worker((scope, caches) => serviceWorker(scope, caches, 'mana-duel-', 'v1', files));
    await sw.install();
    expect([...(sw.caches.stores.get('mana-duel-v1')?.keys() ?? [])]).toEqual([
      SCOPE,
      `${SCOPE}index.html`,
      `${SCOPE}assets/index-abc.js`,
      `${SCOPE}cards/ember_snap.svg`,
    ]);
  });

  it('drops the caches of older versions and takes over the open pages when it activates', async () => {
    const sw = worker((scope, caches) => serviceWorker(scope, caches, 'mana-duel-', 'v2', files));
    await sw.caches.open('mana-duel-v1');
    await sw.caches.open('other-app');
    await sw.install();
    await sw.activate();
    expect([...sw.caches.stores.keys()].sort()).toEqual(['mana-duel-v2', 'other-app']);
    expect(sw.claimed()).toBe(true);
  });

  it('serves files from the cache and anything else from the network', async () => {
    const sw = worker((scope, caches) => serviceWorker(scope, caches, 'mana-duel-', 'v1', files));
    await sw.install();
    await expect(text(sw.fetch({ url: `${SCOPE}cards/ember_snap.svg` }))).resolves.toBe(
      `cached ${SCOPE}cards/ember_snap.svg`,
    );
    await expect(text(sw.fetch({ url: `${SCOPE}assets/new.js` }))).resolves.toBe(`network ${SCOPE}assets/new.js`);
  });

  it('loads the page from the network while online and from the cache while offline', async () => {
    const sw = worker((scope, caches) => serviceWorker(scope, caches, 'mana-duel-', 'v1', files));
    await sw.install();
    const page = { url: `${SCOPE}?lang=en`, mode: 'navigate' as const };
    await expect(text(sw.fetch(page))).resolves.toBe(`network ${SCOPE}?lang=en`);
    sw.setOnline(false);
    await expect(text(sw.fetch(page))).resolves.toBe(`cached ${SCOPE}`);
  });

  it('leaves requests to other origins and other methods to the browser', async () => {
    const sw = worker((scope, caches) => serviceWorker(scope, caches, 'mana-duel-', 'v1', files));
    await sw.install();
    expect(sw.fetch({ url: 'https://openrouter.ai/api/v1/models' })).toBeUndefined();
    expect(sw.fetch({ url: `${SCOPE}index.html`, method: 'POST' })).toBeUndefined();
  });

  it('runs from the source the build writes', async () => {
    const source = serviceWorkerSource('v1', files);
    const sw = worker((scope, caches) => {
      runInNewContext(source, { self: scope, caches, URL, Response });
    });
    await sw.install();
    expect(sw.caches.stores.get('mana-duel-v1')?.size).toBe(files.length + 1);
  });
});

describe('the service worker build', () => {
  let dir = '';

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  function build(bundle: Record<string, object>): string {
    const plugin = serviceWorkerPlugin();
    (plugin.configResolved as (config: { publicDir: string }) => void)({ publicDir: dir });
    let emitted = '';
    (plugin.generateBundle as (this: object, options: object, bundle: object) => void).call(
      { emitFile: (file: { fileName: string; source: string }) => (emitted = `${file.fileName}\n${file.source}`) },
      {},
      bundle,
    );
    return emitted;
  }

  it('lists the bundle and the public files, and changes its version with their content', () => {
    dir = mkdtempSync(join(tmpdir(), 'mana-duel-sw-'));
    mkdirSync(join(dir, 'cards'));
    writeFileSync(join(dir, 'cards', 'ember_snap.svg'), '<svg/>');
    writeFileSync(join(dir, '.DS_Store'), '');
    const bundle = {
      'index.html': { type: 'asset', fileName: 'index.html', source: '<html>' },
      'assets/index-abc.js': { type: 'chunk', fileName: 'assets/index-abc.js', code: 'run()' },
    };
    const first = build(bundle);
    expect(first.split('\n')[0]).toBe(SERVICE_WORKER_FILE);
    expect(first).toContain('["assets/index-abc.js","cards/ember_snap.svg","index.html"]');
    expect(first).not.toContain('.DS_Store');
    expect(build(bundle)).toBe(first);
    writeFileSync(join(dir, 'cards', 'ember_snap.svg'), '<svg viewBox="0 0 120 80"/>');
    expect(build(bundle)).not.toBe(first);
  });
});
