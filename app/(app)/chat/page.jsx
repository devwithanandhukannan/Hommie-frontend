'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import AgenticChatPanel from '@/components/AgenticChatPanel';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

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
      <div className="chat-header-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 className="bold" style={{ fontSize: 18, margin: 0 }}>
            {mode === 'ai'
              ? (lang === 'ml' ? '✨ Hommi AI ഏജന്റ്' : '✨ Hommi AI Agent')
              : t('chat.title')}
          </h1>
          <div className="small muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mode === 'ai'
              ? (lang === 'ml' ? 'വീട്ടുസഹായി · ഓർമ്മപ്പെടുത്തലുകൾ, പാചകം, ചിലവുകൾ' : 'Household Assistant · Recipes, Tasks, Expenses')
              : family?.members.map((m) => m.displayName).join(', ')}
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div style={{ display: 'inline-flex', padding: 3, background: 'var(--surface-2)', borderRadius: 20, border: '1px solid var(--line)' }}>
          <button
            type="button"
            onClick={() => switchMode('family')}
            style={{
              padding: '5px 12px',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'family' ? 'var(--surface)' : 'transparent',
              color: mode === 'family' ? 'var(--brand)' : 'var(--muted)',
              boxShadow: mode === 'family' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            👨‍👩‍👧‍👦 {lang === 'ml' ? 'കുടുംബ ചാറ്റ്' : 'Family Chat'}
          </button>
          <button
            type="button"
            onClick={() => switchMode('ai')}
            style={{
              padding: '5px 12px',
              borderRadius: 16,
              fontSize: 12,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: mode === 'ai' ? 'var(--brand)' : 'transparent',
              color: mode === 'ai' ? '#FFFFFF' : 'var(--muted)',
              boxShadow: mode === 'ai' ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            ✨ {lang === 'ml' ? 'Hommi AI' : 'Hommi AI'}
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
