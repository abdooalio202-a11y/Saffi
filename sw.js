/* صفّي — يخلي الموقع يشتغل كتطبيق وبدون إنترنت.
   الصفحة نفسها: نجيبها من الإنترنت أول (حتى التحديثات تطلع فوراً)، وإذا ماكو إنترنت نفتح النسخة المحفوظة. */
const CACHE = 'saffi-v1';
const CORE = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => null)))));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Supabase والذكاء الاصطناعي: دائماً من الإنترنت، ما نحفظها
  if (/supabase\.co$/.test(url.hostname) || url.pathname.startsWith('/functions/')) return;

  // فتح الصفحة: من الإنترنت أول، وإذا ماكو نرجع للمحفوظة
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put('/index.html', copy));
        return res;
      }).catch(() => caches.match('/index.html').then(r => r || caches.match('/')))
    );
    return;
  }

  // الخطوط: نستعمل المحفوظ ونحدّثه بالخلفية
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }

  // باقي ملفات الموقع (الأيقونات...): المحفوظ أول
  if (url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
});
