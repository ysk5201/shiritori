// オフラインでも遊べるように、アプリのファイルを端末に保存する。
// 公開時に __VERSION__ が版番号に置き換わり、更新のたびに新しいキャッシュに入れ替わる。
const VERSION = '__VERSION__';
const CACHE = `mawashiritori-${VERSION}`;
const ASSETS = [
  './',
  `style.css?v=${VERSION}`,
  `js/app.js?v=${VERSION}`,
  `js/kana.js?v=${VERSION}`,
  `js/topics.js?v=${VERSION}`,
  `js/cpu.js?v=${VERSION}`,
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // ページ本体は最新を優先し、オフラインのときだけ保存したものを使う
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./')));
    return;
  }
  // JS・CSS などは URL に版番号が付いているので、保存したものを優先する
  event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)));
});
