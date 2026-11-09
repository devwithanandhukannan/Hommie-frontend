import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: { default: 'Hommi', template: '%s · Hommi' },
  description: 'Bills, groceries, tasks, medicines, documents and chat for your family',
  applicationName: 'Hommi',
  appleWebApp: { capable: true, title: 'Hommi', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/favicon.ico?v=2', sizes: 'any' },
      { url: '/favicon.svg?v=2', type: 'image/svg+xml' },
      { url: '/favicon-96x96.png?v=2', sizes: '96x96', type: 'image/png' },
      { url: '/icon.svg?v=2', type: 'image/svg+xml' },
      { url: '/web-app-manifest-192x192.png?v=2', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png?v=2', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png?v=2',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  robots: { index: false, follow: false },
};
// viewportFit "cover" lets the app use the full screen on notched phones; the CSS adds the safe-area padding.
export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F6F5F1' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0F0E' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
