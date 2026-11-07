'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui';
import { getAllPermissions, requestMicrophone, requestCamera, requestNotifications } from '@/lib/permissions';

export default function PermissionsPrompt() {
  const [show, setShow] = useState(false);
  const [perms, setPerms] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Only show if user hasn't dismissed it in the last 7 days
    const dismissedAt = localStorage.getItem('fh_perm_dismissed_at');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 7 * 864e5) {
      return;
    }

    getAllPermissions().then((p) => {
      setPerms(p);
      const needsPrompt = p.microphone === 'prompt' || p.camera === 'prompt' || p.notifications === 'prompt';
      if (needsPrompt) {
        // Small delay so page renders first
        setTimeout(() => setShow(true), 800);
      }
    }).catch(() => {});
  }, []);

  const dismiss = () => {
    localStorage.setItem('fh_perm_dismissed_at', String(Date.now()));
    setShow(false);
  };

  const enableAll = async () => {
    setBusy(true);
    try {
      if (perms?.notifications === 'prompt') {
        await requestNotifications().catch(() => {});
      }
      if (perms?.microphone === 'prompt') {
        await requestMicrophone().catch(() => {});
      }
      if (perms?.camera === 'prompt') {
        await requestCamera().catch(() => {});
      }
    } finally {
      setBusy(false);
      dismiss();
    }
  };

  if (!show || !perms) return null;

  return (
    <div className="permissions-prompt-overlay" role="dialog" aria-modal="true" aria-label="Permissions prompt">
      <div className="permissions-prompt-card card">
        <div className="row between" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
          <div className="row center" style={{ gap: 10 }}>
            <span className="permissions-apple-icon">
              <Icon name="sun" size={20} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Enable Device Permissions</h3>
              <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                Hommie works best when voice notes, photos, and notifications are allowed.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 28, height: 28, border: 0 }}
            onClick={dismiss}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="permissions-prompt-list">
          <div className="permissions-prompt-item">
            <span className="permissions-item-icon" style={{ background: 'rgba(52, 199, 89, 0.15)', color: '#34C759' }}>
              <Icon name="mic" size={17} />
            </span>
            <div className="grow">
              <div className="bold small">Microphone</div>
              <div className="tiny muted">Record and send voice messages in chat</div>
            </div>
            <span className={`tiny bold ${perms.microphone === 'granted' ? 'color-ok' : 'muted'}`}>
              {perms.microphone === 'granted' ? 'Allowed' : 'Recommended'}
            </span>
          </div>

          <div className="permissions-prompt-item">
            <span className="permissions-item-icon" style={{ background: 'rgba(0, 113, 227, 0.15)', color: '#0071E3' }}>
              <Icon name="photo" size={17} />
            </span>
            <div className="grow">
              <div className="bold small">Camera</div>
              <div className="tiny muted">Snap photos of bills, receipts, and family moments</div>
            </div>
            <span className={`tiny bold ${perms.camera === 'granted' ? 'color-ok' : 'muted'}`}>
              {perms.camera === 'granted' ? 'Allowed' : 'Recommended'}
            </span>
          </div>

          <div className="permissions-prompt-item">
            <span className="permissions-item-icon" style={{ background: 'rgba(255, 149, 0, 0.15)', color: '#FF9500' }}>
              <Icon name="bell" size={17} />
            </span>
            <div className="grow">
              <div className="bold small">Notifications</div>
              <div className="tiny muted">Get alerted on due bills, chores, and new messages</div>
            </div>
            <span className={`tiny bold ${perms.notifications === 'granted' ? 'color-ok' : 'muted'}`}>
              {perms.notifications === 'granted' ? 'Allowed' : 'Recommended'}
            </span>
          </div>
        </div>

        <div className="row between" style={{ marginTop: 16, gap: 10 }}>
          <button
            type="button"
            className="btn ghost sm"
            onClick={dismiss}
            style={{ color: 'var(--muted)' }}
          >
            Maybe later
          </button>
          <button
            type="button"
            className="btn sm"
            style={{ background: 'var(--brand)', color: 'var(--on-brand)', borderRadius: 999 }}
            onClick={enableAll}
            disabled={busy}
          >
            {busy ? 'Enabling...' : 'Enable Access'}
          </button>
        </div>
      </div>
    </div>
  );
}
