'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import AgenticChatPanel from '@/components/AgenticChatPanel';
import { useAuth } from '@/lib/auth';
import { Spinner, Icon } from '@/components/ui';

function ChatPageContent() {
  const { family, t, lang } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = searchParams.get('mode') === 'ai' ? 'ai' : 'family';
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'ai' || qMode === 'family') {
      setMode(qMode);
    }
  }, [searchParams]);

  const switchMode = (m) => {
    setMode(m);
    router.replace(`/chat?mode=${m}`, { scroll: false });
  };

  return (
    <div className="chat-container-page">
      <div className="chat-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
        {/* Mode Toggle Switch directly at top - removes redundant kudumbachat and anandhu text */}
        <div style={{ display: 'inline-flex', padding: 3, background: 'var(--surface-2)', borderRadius: 24, border: '1px solid var(--line)', width: '100%', maxWidth: 440 }}>
          <button
            type="button"
            onClick={() => switchMode('family')}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 13.5,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'family' ? 'var(--surface)' : 'transparent',
              color: mode === 'family' ? 'var(--text)' : 'var(--muted)',
              boxShadow: mode === 'family' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name="family" size={15} />
            <span>{lang === 'ml' ? 'കുടുംബ ചാറ്റ്' : 'Family Chat'}</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('ai')}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 13.5,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'ai' ? 'var(--brand)' : 'transparent',
              color: mode === 'ai' ? '#FFFFFF' : 'var(--muted)',
              boxShadow: mode === 'ai' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Icon name="sparkles" size={15} />
            <span>Hommi AI</span>
          </button>
        </div>
      </div>

      <div className="card chat-card-wrap">
        {mode === 'family' ? <ChatPanel /> : <AgenticChatPanel />}
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ChatPageContent />
    </Suspense>
  );
}
