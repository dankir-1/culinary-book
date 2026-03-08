const CACHE_NAME = 'culinary-book-v1';
const STATIC_CACHE_NAME = 'culinary-static-v1';
const DYNAMIC_CACHE_NAME = 'culinary-dynamic-v1';

// Файлы для кэширования при установке
const STATIC_ASSETS = [
  '/',
  '/culinary-book.html',
  '/culinary-book.css',
  '/culinary-book.js',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Установка Service Worker и кэширование статических файлов
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Активация Service Worker и очистка старых кэшей
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Перехват запросов и работа с кэшем
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Пропускаем chrome-extension и другие не-http запросы
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Если есть в кэше - возвращаем оттуда
        if (response) {
          console.log('Service Worker: Serving from cache:', request.url);
          return response;
        }
        
        // Если нет в кэше - делаем запрос
        return fetch(request)
          .then(response => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Кэшируем только GET запросы на наши файлы
            if (request.method === 'GET' && 
                (url.origin === self.location.origin || 
                 url.pathname.includes('icon-'))) {
              
              const responseToCache = response.clone();
              
              caches.open(DYNAMIC_CACHE_NAME)
                .then(cache => {
                  console.log('Service Worker: Caching new resource:', request.url);
                  cache.put(request, responseToCache);
                });
            }
            
            return response;
          })
          .catch(() => {
            // Если запрос не удался, пробуем вернуть из кэша
            console.log('Service Worker: Fetch failed, trying cache fallback');
            
            // Для HTML страниц возвращаем главную страницу
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/culinary-book.html');
            }
            
            // Для картинок возвращаем заглушку
            if (request.headers.get('accept').includes('image/')) {
              return new Response('', {
                status: 200,
                statusText: 'OK',
                headers: { 'Content-Type': 'image/svg+xml' }
              });
            }
          });
      })
  );
});

// Обработка фоновых событий синхронизации
self.addEventListener('sync', event => {
  if (event.tag === 'sync-favorites') {
    event.waitUntil(syncFavorites());
  }
});

// Синхронизация избранных рецептов
async function syncFavorites() {
  try {
    const favorites = localStorage.getItem('favorites');
    if (favorites) {
      console.log('Service Worker: Syncing favorites...');
      // Здесь можно добавить синхронизацию с сервером
    }
  } catch (error) {
    console.error('Service Worker: Sync failed:', error);
  }
}

// Обработка push-уведомлений (если понадобится)
self.addEventListener('push', event => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'У вас новые рецепты!',
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      vibrate: [100, 50, 100],
      data: data,
      actions: [
        {
          action: 'open',
          title: 'Открыть приложение'
        },
        {
          action: 'close',
          title: 'Закрыть'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Кулинарная книга', options)
    );
  }
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
