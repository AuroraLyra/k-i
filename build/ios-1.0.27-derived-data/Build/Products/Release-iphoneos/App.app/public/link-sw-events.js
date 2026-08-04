self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = String(event.notification.data?.url || self.location.origin || '').trim();
  if (!targetUrl) return;

  event.waitUntil((async () => {
    const target = new URL(targetUrl, self.location.origin);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const notificationAction = event.action === 'accepted' ? 'accepted' : event.action === 'rejected' ? 'rejected' : 'open';
    const eventData = {
      type: 'LINK_NOTIFICATION_CLICK',
      url: target.href,
      kind: event.notification.data?.kind === 'call' ? 'call' : event.notification.data?.kind === 'voom' ? 'voom' : 'message',
      action: notificationAction,
      title: String(event.notification.data?.title || '').trim(),
      body: String(event.notification.data?.body || '').trim(),
      messages: Array.isArray(event.notification.data?.messages) ? event.notification.data.messages : undefined,
      tag: String(event.notification.data?.tag || '').trim(),
      icon: String(event.notification.data?.icon || '').trim(),
      conversationId: String(event.notification.data?.conversationId || '').trim(),
      callId: String(event.notification.data?.callId || '').trim(),
      callMode: event.notification.data?.callMode === 'video' ? 'video' : event.notification.data?.callMode === 'voice' ? 'voice' : undefined
    };

    for (const client of windows) {
      const clientUrl = new URL(client.url);
      if (clientUrl.origin !== target.origin) continue;
      await client.focus();
      client.postMessage(eventData);
      return;
    }

    if (eventData.kind === 'call' && notificationAction !== 'open') {
      if (notificationAction === 'rejected') {
        target.pathname = '/home';
        target.search = '';
        target.hash = '';
      }
      target.searchParams.set('linkCallAction', notificationAction);
      if (eventData.conversationId) target.searchParams.set('linkConversationId', eventData.conversationId);
      if (eventData.callId) target.searchParams.set('linkCallId', eventData.callId);
      if (eventData.callMode) target.searchParams.set('linkCallMode', eventData.callMode);
    }
    await self.clients.openWindow(target.href);
  })());
});

const linkMediaRouteSegment = '/__link-media/';
const linkMediaCacheName = 'link-large-media-v1';
const linkMediaOpfsDirectoryName = 'link-large-media-v1';
const linkMediaIndexedDbName = 'link-large-media-v1';
const linkMediaIndexedDbStoreName = 'media';
let linkMediaIndexedDbPromise;

function getLinkMediaLocator(url) {
  const markerIndex = url.pathname.indexOf(linkMediaRouteSegment);
  if (markerIndex < 0) return null;
  const parts = url.pathname.slice(markerIndex + linkMediaRouteSegment.length).split('/');
  const backend = parts.shift();
  const id = decodeURIComponent(parts.join('/')).trim();
  if (!id || !['opfs', 'idb', 'cache'].includes(backend)) return null;
  return { backend, id };
}

function getLinkMediaMimeType(id) {
  const extension = String(id.split('.').pop() || '').toLowerCase();
  if (extension === 'woff2') return 'font/woff2';
  if (extension === 'woff') return 'font/woff';
  if (extension === 'otf') return 'font/otf';
  if (extension === 'ttf') return 'font/ttf';
  if (extension === 'svg') return 'image/svg+xml';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'avif') return 'image/avif';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'webm') return 'audio/webm';
  if (extension === 'ogg') return 'audio/ogg';
  if (extension === 'aac') return 'audio/aac';
  if (extension === 'flac') return 'audio/flac';
  return 'application/octet-stream';
}

function createLinkMediaHeaders(id, storage, byteLength) {
  return {
    'Content-Type': getLinkMediaMimeType(id),
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(byteLength),
    'X-Link-Media-Storage': storage
  };
}

function parseLinkMediaRange(rangeHeader, byteLength) {
  const match = String(rangeHeader || '').match(/^bytes=(\d*)-(\d*)$/i);
  if (!match) return null;

  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return null;

  if (!startText) {
    const suffixLength = Math.max(0, Number.parseInt(endText, 10) || 0);
    if (!suffixLength) return null;
    return {
      start: Math.max(0, byteLength - suffixLength),
      end: byteLength - 1
    };
  }

  const start = Math.max(0, Number.parseInt(startText, 10) || 0);
  const end = endText ? Math.min(byteLength - 1, Number.parseInt(endText, 10) || 0) : byteLength - 1;
  return start <= end && start < byteLength ? { start, end } : null;
}

function createLinkMediaResponse(blob, id, storage, request) {
  const byteLength = blob.size;
  const range = parseLinkMediaRange(request.headers.get('range'), byteLength);
  if (request.headers.has('range')) {
    if (!range) {
      return new Response('', {
        status: 416,
        headers: {
          'Content-Range': `bytes */${byteLength}`,
          'Accept-Ranges': 'bytes'
        }
      });
    }

    const chunk = blob.slice(range.start, range.end + 1, blob.type || getLinkMediaMimeType(id));
    return new Response(chunk, {
      status: 206,
      headers: {
        ...createLinkMediaHeaders(id, storage, chunk.size),
        'Content-Range': `bytes ${range.start}-${range.end}/${byteLength}`
      }
    });
  }

  return new Response(blob, {
    headers: createLinkMediaHeaders(id, storage, byteLength)
  });
}

async function readLinkMediaFromOpfs(id, request) {
  try {
    if (!self.navigator?.storage?.getDirectory) return null;
    const root = await self.navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle(linkMediaOpfsDirectoryName);
    const file = await (await directory.getFileHandle(id)).getFile();
    return createLinkMediaResponse(file.type ? file : new Blob([file], { type: getLinkMediaMimeType(id) }), id, 'opfs', request);
  } catch {
    return null;
  }
}

function getLinkMediaIndexedDb() {
  if (!self.indexedDB) return Promise.resolve(null);
  if (linkMediaIndexedDbPromise) return linkMediaIndexedDbPromise;

  linkMediaIndexedDbPromise = new Promise((resolve) => {
    const openRequest = self.indexedDB.open(linkMediaIndexedDbName, 1);
    openRequest.addEventListener('upgradeneeded', () => {
      if (!openRequest.result.objectStoreNames.contains(linkMediaIndexedDbStoreName)) {
        openRequest.result.createObjectStore(linkMediaIndexedDbStoreName);
      }
    });
    openRequest.addEventListener('success', () => resolve(openRequest.result));
    openRequest.addEventListener('error', () => resolve(null));
    openRequest.addEventListener('blocked', () => resolve(null));
  });
  return linkMediaIndexedDbPromise;
}

async function readLinkMediaFromIndexedDb(id, request) {
  try {
    const db = await getLinkMediaIndexedDb();
    if (!db) return null;
    const transaction = db.transaction(linkMediaIndexedDbStoreName, 'readonly');
    const readRequest = transaction.objectStore(linkMediaIndexedDbStoreName).get(id);
    const value = await new Promise((resolve, reject) => {
      readRequest.addEventListener('success', () => resolve(readRequest.result));
      readRequest.addEventListener('error', () => reject(readRequest.error));
    });
    if (!(value instanceof Blob)) return null;
    const blob = value.type ? value : new Blob([value], { type: getLinkMediaMimeType(id) });
    return createLinkMediaResponse(blob, id, 'idb', request);
  } catch {
    return null;
  }
}

async function readLinkMediaFromCache(request, id) {
  try {
    const response = await (await caches.open(linkMediaCacheName)).match(request);
    if (!response) return null;
    if (!request.headers.has('range')) return response;
    return createLinkMediaResponse(await response.blob(), id, 'cache', request);
  } catch {
    return null;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const locator = getLinkMediaLocator(url);
  if (!locator) return;

  event.respondWith((async () => {
    const response = locator.backend === 'opfs'
      ? await readLinkMediaFromOpfs(locator.id, event.request)
        || await readLinkMediaFromIndexedDb(locator.id, event.request)
        || await readLinkMediaFromCache(event.request, locator.id)
      : locator.backend === 'idb'
        ? await readLinkMediaFromIndexedDb(locator.id, event.request)
          || await readLinkMediaFromOpfs(locator.id, event.request)
          || await readLinkMediaFromCache(event.request, locator.id)
        : await readLinkMediaFromCache(event.request, locator.id)
          || await readLinkMediaFromIndexedDb(locator.id, event.request)
          || await readLinkMediaFromOpfs(locator.id, event.request);

    return response || new Response('LINK media not found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'LINK_KEEP_ALIVE_PING') return;
  self.__LINK_LAST_KEEP_ALIVE_PING__ = event.data.at || Date.now();
});