import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: { default: 'Hommi', template: '%s · Hommi' },
  description: 'Bills, groceries, tasks, medicines, documents and chat for your family',
  applicationName: 'Hommi',
  appleWebApp: { capable: true, title: 'Hommi', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  robots: { index: false, follow: false },
};
export const viewport = { themeColor: '#0B6B5D', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
