/* Работа без интернета. Список файлов держите полным: новый файл приложения добавляйте сюда и увеличивайте V. */
const V = 'cennik-6';
const FILES = ['./', 'index.html', 'engine.js', 'app.js', 'font.js', 'manifest.webmanifest', 'icons/180.png', 'icons/192.png', 'icons/512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(V).then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x.startsWith('cennik-') && x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())));
// сначала сеть, чтобы обновления приходили сразу; если она молчит 3 секунды или её нет — из кэша
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const cached = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : undefined));
  const net = fetch(e.request, { cache: 'no-cache' }).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(k => k.put(e.request, c)); } return r; });
  const slow = new Promise(ok => setTimeout(ok, 3000)).then(cached);
  e.respondWith(Promise.race([net.catch(() => cached()), slow.then(r => r || net)]).then(r => r || Response.error()));
});
