'use client';
import { useEffect, useState, useRef } from 'react';
import { Btn, Icon } from '@/components/ui';

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [platform, setPlatform] = useState('android'); // 'android' | 'ios' | 'other'
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    // 1. Don't show if already running in standalone PWA mode
    const isStandalone =
      (typeof window !== 'undefined' &&
        (window.matchMedia?.('(display-mode: standalone)').matches ||
          window.navigator?.standalone === true)) ||
      false;

    if (isStandalone) return;

    // 2. Check if user dismissed recently (5 days)
    const dismissedAt = localStorage.getItem('fh_pwa_dismissed_at');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 5 * 864e5) {
      // Check manual trigger listener even if auto-prompt is suppressed
      const onManualOpen = () => setShow(true);
      window.addEventListener('open-pwa-install', onManualOpen);
      return () => window.removeEventListener('open-pwa-install', onManualOpen);
    }

    // 3. Detect iOS Safari
    const ua = navigator.userAgent || '';
    const isIos = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    const isMobile = isIos || /android|mobile/i.test(ua);

    if (isIos) {
      setPlatform('ios');
      // Delay so initial view loads cleanly
      const t = setTimeout(() => setShow(true), 1600);
      return () => clearTimeout(t);
    }

    // 4. Android / Chromium beforeinstallprompt handler
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setPlatform('android');
      setTimeout(() => setShow(true), 1200);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Fallback if beforeinstallprompt didn't fire but on mobile browser
    let mobileTimer = null;
    if (isMobile) {
      mobileTimer = setTimeout(() => {
        if (!deferredPromptRef.current) {
          setPlatform('mobile-generic');
          setShow(true);
        }
      }, 3000);
    }

    const onManualOpen = () => setShow(true);
    window.addEventListener('open-pwa-install', onManualOpen);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('open-pwa-install', onManualOpen);
      if (mobileTimer) clearTimeout(mobileTimer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem('fh_pwa_dismissed_at', String(Date.now()));
    setShow(false);
  };

  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      try {
        await deferredPromptRef.current.prompt();
        const choice = await deferredPromptRef.current.userChoice;
        if (choice?.outcome === 'accepted') {
          dismiss();
          return;
        }
      } catch {
        // Fallback
      }
    }
    dismiss();
  };

  if (!show) return null;

  return (
    <div className="pwa-install-overlay" role="dialog" aria-modal="true" aria-label="Install App">
      <div className="pwa-install-card card">
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 12 }}>
          <div className="row center" style={{ gap: 12 }}>
            <img
              src="/apple-touch-icon.png?v=2"
              alt="Hommi App"
              width={50}
              height={50}
              style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            />
            <div>
              <div className="bold" style={{ fontSize: 17, letterSpacing: -0.2 }}>
                Install Hommi App
              </div>
              <div className="tiny muted">Family Hub · Mobile PWA</div>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={dismiss}
            aria-label="Close"
            style={{ fontSize: 18, color: 'var(--muted)' }}
          >
            ✕
          </button>
        </div>

        <p className="small" style={{ margin: '0 0 16px', color: 'var(--text-soft)', lineHeight: 1.5 }}>
          Install Hommi on your mobile phone for full-screen view, instant voice messages, and fast home screen access.
        </p>

        {platform === 'ios' ? (
          <div className="pwa-ios-guide">
            <div className="pwa-ios-step">
              <span className="pwa-step-num">1</span>
              <span>
                Tap the <strong>Share</strong> button <span className="pwa-inline-icon">⎋</span> at the bottom of Safari.
              </span>
            </div>
            <div className="pwa-ios-step">
              <span className="pwa-step-num">2</span>
              <span>
                Scroll down and tap <strong>Add to Home Screen</strong> <span className="pwa-inline-icon">⊞</span>.
              </span>
            </div>
            <Btn tone="brand" onClick={dismiss} style={{ width: '100%', marginTop: 14 }}>
              Got it
            </Btn>
          </div>
        ) : (
          <div className="row" style={{ gap: 10 }}>
            <Btn tone="brand" onClick={handleInstallClick} style={{ flex: 1 }}>
              Install App
            </Btn>
            <Btn tone="subtle" onClick={dismiss} style={{ flex: 1 }}>
              Not now
            </Btn>
          </div>
        )}
      </div>
    </div>
  );
}

