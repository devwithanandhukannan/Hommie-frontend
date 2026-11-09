export default function manifest() {
  return {
    id: '/',
    name: 'Hommi',
    short_name: 'Hommi',
    description: 'A calm home for your family: tasks, groceries, bills, medicine and chat.',
    lang: 'en',
    dir: 'ltr',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#F6F5F1',
    theme_color: '#0F6B58',
    categories: ['lifestyle', 'productivity'],
    icons: [
      { src: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    // Long-press the app icon: the three things people do most.
    shortcuts: [
      { name: 'Tell Hommi', short_name: 'Tell Hommi', url: '/dashboard?add=1', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Add grocery', short_name: 'Grocery', url: '/planner?tab=grocery', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Pay a bill', short_name: 'Bills', url: '/money?tab=bills', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
