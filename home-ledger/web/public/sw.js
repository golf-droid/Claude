/* Service worker แบบเรียบง่าย: ให้เปิดแอปได้แม้ออฟไลน์
   - หน้าเว็บ (navigate): ลองเน็ตก่อน ถ้าไม่ได้ค่อยใช้ของที่แคชไว้
   - ไฟล์สแตติกของแอป: ใช้แคชก่อนแล้วอัปเดตเบื้องหลัง
   - คำขอไป Supabase: ไม่แคชเด็ดขาด (ข้อมูลต้องสดเสมอ) */
const CACHE = 'home-ledger-v1'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase และ CDN อื่น ๆ ปล่อยผ่าน

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html').then((r) => r || caches.match('/')))
    )
    return
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
