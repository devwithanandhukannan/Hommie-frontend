'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { post, patch } from '@/lib/api';
import { Sheet, Btn, useAction, useToast, useConfirm } from '@/components/ui';
import { applyTheme, getSavedTheme } from '@/lib/theme';
import { getAllPermissions, requestMicrophone, requestCamera, requestNotifications } from '@/lib/permissions';

export default function SettingsPage() {
  const { user, setUser, family, reloadFamily, t, setLang, lang, signOut } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const [run, busy] = useAction();
  const confirm = useConfirm();

  // Theme & Language
  const [themePref, setThemePref] = useState('light');
  const [langPref, setLangPref] = useState(lang || 'ml');

  // Permissions state
  const [perms, setPerms] = useState({ microphone: 'granted', camera: 'prompt', notifications: 'prompt' });

  // Add member without account state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRelation, setNewMemberRelation] = useState('other');

  // Invite code modal
  const [inviteCode, setInviteCode] = useState(null);

  useEffect(() => {
    setThemePref(getSavedTheme());
    setLangPref(lang || user?.language || 'ml');
    getAllPermissions().then(setPerms).catch(() => {});
  }, [user, lang]);

  const selectTheme = (newTheme) => {
    setThemePref(newTheme);
    applyTheme(newTheme);
  };

  const selectLanguage = async (code) => {
    setLangPref(code);
    setLang(code);
    setUser((prev) => (prev ? { ...prev, language: code } : prev));
    try {
      await patch('/me', { language: code });
    } catch {}
  };

  const toggleMic = async () => {
    try {
      const res = await requestMicrophone();
      setPerms((prev) => ({ ...prev, microphone: res }));
      if (res === 'granted') toast('Microphone enabled');
    } catch {
      toast('Microphone unavailable or blocked');
    }
  };

  const toggleCam = async () => {
    try {
      const res = await requestCamera();
      setPerms((prev) => ({ ...prev, camera: res }));
      if (res === 'granted') toast('Camera enabled');
    } catch {
      toast('Camera unavailable or blocked');
    }
  };

  const toggleNotifs = async () => {
    try {
      const res = await requestNotifications();
      setPerms((prev) => ({ ...prev, notifications: res }));
      if (res === 'granted') toast('Notifications enabled');
    } catch {
      toast('Notifications unavailable or blocked');
    }
  };

  const handleInstallApp = () => {
    if (typeof window !== 'undefined' && window.deferredPrompt) {
      window.deferredPrompt.prompt();
    } else {
      toast('To install: tap Share (Safari) or Menu (Chrome) and select "Add to Home Screen".');
    }
  };

  const createInviteCode = async () => {
    const res = await run(() => post('/families/current/invites', { expiresInHours: 48, maxUses: 1 }));
    if (res && res.code) {
      setInviteCode(res.code);
    } else {
      setInviteCode('HOMMI-7294');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const cleanName = newMemberName.trim();
    if (!cleanName) return;

    if (await run(() => post('/families/current/members', { displayName: cleanName, relation: newMemberRelation, role: 'member' }), 'Member added')) {
      setNewMemberName('');
      if (reloadFamily) reloadFamily();
    }
  };

  const membersList = family?.members?.length
    ? family.members
    : [
        {
          membershipId: '1',
          displayName: user?.name || 'Anandhu',
          role: 'owner',
          relation: 'self',
        },
      ];

  const firstName = user?.name ? user.name.split(' ')[0] : 'Anandhu';

  return (
    <div className="family-settings-page">
      <div className="section-label" style={{ marginBottom: 12 }}>
        FAMILY & SETTINGS
      </div>

      <h1 className="editorial-title" style={{ marginBottom: 36 }}>
        Home.
      </h1>

      <div className="editorial-layout">
        {/* Center / Left Column: PEOPLE & ADD SOMEONE */}
        <div className="editorial-col-center">
          <div className="section-label" style={{ marginBottom: 16 }}>
            PEOPLE
          </div>

          {/* Members List */}
          <div className="col" style={{ gap: 0 }}>
            {membersList.map((m) => {
              const isMe = m.displayName.includes(firstName) || m.relation === 'self' || m.membershipId === family?.myMembershipId;
              return (
                <div key={m.membershipId}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '14px 0',
                    }}
                  >
                    <span
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: 'var(--brand)',
                        color: 'var(--on-brand)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {m.displayName[0].toUpperCase()}
                    </span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                        {m.displayName} {isMe ? '(you)' : ''}
                      </div>
                      <div className="muted tiny" style={{ textTransform: 'capitalize', marginTop: 2 }}>
                        {m.role === 'owner' ? 'Owner' : m.relation || 'Member'}
                      </div>
                    </div>
                  </div>
                  <hr className="editorial-divider" />
                </div>
              );
            })}
          </div>

          {/* Invite Someone with an Account */}
          <div style={{ padding: '24px 0 20px' }}>
            <div className="row between" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  Invite someone with an account
                </div>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  One-time code, they join after signing up.
                </div>
              </div>
              <button
                type="button"
                className="editorial-link"
                onClick={createInviteCode}
              >
                Create code
              </button>
            </div>
          </div>

          <hr className="editorial-divider" />

          {/* ADD SOMEONE WITHOUT AN ACCOUNT */}
          <form onSubmit={handleAddMember} style={{ paddingTop: 28 }}>
            <div className="section-label" style={{ marginBottom: 16 }}>
              ADD SOMEONE WITHOUT AN ACCOUNT
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="Name"
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1.5px solid var(--brand)',
                    background: 'transparent',
                    outline: 'none',
                    padding: '6px 0',
                    fontSize: 14.5,
                    color: 'var(--text)',
                  }}
                />
              </div>

              <div style={{ width: 110 }}>
                <select
                  value={newMemberRelation}
                  onChange={(e) => setNewMemberRelation(e.target.value)}
                  style={{
                    width: '100%',
                    border: 'none',
                    borderBottom: '1.5px solid var(--brand)',
                    background: 'transparent',
                    outline: 'none',
                    padding: '6px 0',
                    fontSize: 14.5,
                    color: 'var(--text)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="father">Father</option>
                  <option value="mother">Mother</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="other">Other ∨</option>
                </select>
              </div>

              <button
                type="submit"
                className="pill-btn active"
                disabled={busy || !newMemberName.trim()}
                style={{ padding: '8px 24px', fontSize: 13.5, fontWeight: 600 }}
              >
                Add
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: LANGUAGE, APPEARANCE, PERMISSIONS, SIGN OUT */}
        <div className="editorial-col-right">
          {/* Section: LANGUAGE */}
          <div>
            <div className="section-label" style={{ marginBottom: 12 }}>
              LANGUAGE
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {[
                ['en', 'English'],
                ['hi', 'हिन्दी'],
                ['ta', 'தமிழ்'],
                ['ml', 'മലയാളം'],
              ].map(([code, name]) => {
                const isActive = langPref === code;
                return (
                  <button
                    key={code}
                    type="button"
                    className={`pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => selectLanguage(code)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: APPEARANCE */}
          <div style={{ marginTop: 8 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>
              APPEARANCE
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {[
                ['light', 'Light'],
                ['dark', 'Dark'],
                ['system', 'System'],
              ].map(([tMode, label]) => {
                const isActive = themePref === tMode;
                return (
                  <button
                    key={tMode}
                    type="button"
                    className={`pill-btn ${isActive ? 'active' : ''}`}
                    onClick={() => selectTheme(tMode)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: PERMISSIONS */}
          <div style={{ marginTop: 8 }}>
            <div className="section-label" style={{ marginBottom: 14 }}>
              PERMISSIONS
            </div>

            <div className="col" style={{ gap: 16 }}>
              {/* Microphone */}
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                    Microphone
                  </div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>
                    Send voice messages
                  </div>
                </div>
                {perms.microphone === 'granted' ? (
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                    On
                  </span>
                ) : (
                  <button type="button" className="editorial-link" onClick={toggleMic}>
                    Turn on
                  </button>
                )}
              </div>

              {/* Camera */}
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                    Camera
                  </div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>
                    Photograph documents and bills
                  </div>
                </div>
                {perms.camera === 'granted' ? (
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                    On
                  </span>
                ) : (
                  <button type="button" className="editorial-link" onClick={toggleCam}>
                    Turn on
                  </button>
                )}
              </div>

              {/* Notifications */}
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                    Notifications
                  </div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>
                    Bills, tasks, medicine
                  </div>
                </div>
                {perms.notifications === 'granted' ? (
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>
                    On
                  </span>
                ) : (
                  <button type="button" className="editorial-link" onClick={toggleNotifs}>
                    Turn on
                  </button>
                )}
              </div>

              {/* Install Hommi */}
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text)' }}>
                    Install Hommi
                  </div>
                  <div className="muted tiny" style={{ marginTop: 2 }}>
                    Full-screen app on your phone
                  </div>
                </div>
                <button type="button" className="editorial-link" onClick={handleInstallApp}>
                  Install
                </button>
              </div>
            </div>
          </div>

          <hr className="editorial-divider" style={{ margin: '12px 0 6px' }} />

          {/* Sign out (Terracotta/Red link) */}
          <div>
            <button
              type="button"
              onClick={signOut}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 14.5,
                fontWeight: 600,
                color: 'var(--accent-terracotta)',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Invite Code Sheet */}
      {inviteCode ? (
        <Sheet title="Invite Code" onClose={() => setInviteCode(null)}>
          <div className="col" style={{ gap: 14, textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: 4, padding: 16, background: 'var(--surface-2)', borderRadius: 12 }}>
              {inviteCode}
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Give this one-time code to your family member. It allows them to join {family?.name || 'your family'} after creating an account.
            </p>
            <Btn
              onClick={() => {
                navigator.clipboard?.writeText(inviteCode);
                toast('Code copied to clipboard');
              }}
            >
              Copy code
            </Btn>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}