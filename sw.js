/* 离线缓存。只在 http(s) 托管下注册 —— 直接双击 index.html 时浏览器不给你 SW。
   页面走「先网络后缓存」：改了 index.html 一刷新就是新的，不会卡在旧版本；
   assets 走「先缓存后网络」；跨域请求（天气接口）一律不缓存，直接透传。 */
const C = 'runkit-v3';
const SCOPE = self.location.href.replace(/sw\.js.*$/, '');
const INDEX = SCOPE + 'index.html';
const SHELL = ['index.html', 'manifest.webmanifest', 'icon.svg',
               'icon-192.png', 'icon-512.png', 'icon-180.png'].map(f => SCOPE + f);

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(C)
      .then(k => Promise.all(SHELL.map(u =>
        fetch(u, {cache: 'reload'}).then(r => r.ok ? k.put(u, r) : null).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin !== location.origin) return;          // 天气/地理编码接口不插嘴

  if (req.mode === 'navigate') {                      // 页面：先网络
    e.respondWith(
      fetch(req).then(r => {
        const c = r.clone();
        caches.open(C).then(k => k.put(INDEX, c)).catch(() => {});
        return r;
      }).catch(() => caches.match(INDEX).then(r => r || caches.match(req)).then(
        r => r || new Response('离线，且没有缓存', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}})))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res && res.ok) { const c = res.clone(); caches.open(C).then(k => k.put(req, c)).catch(() => {}); }
      return res;
    }))
  );
});
