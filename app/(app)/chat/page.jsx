'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import AgenticChatPanel from '@/components/AgenticChatPanel';
import { useAuth } from '@/lib/auth';
import { Spinner } from '@/components/ui';

function ChatPageContent() {
  const { lang } = useAuth();
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
      {/* Clean Modern Editorial Header - Replaces redundant h1 & Anandhu subtitle to save vertical space */}
      <div className="chat-editorial-topbar">
        <div className="chat-editorial-label">
          CHAT
        </div>

        {/* Clean Editorial Underline Tabs (matches Plan/Shopping reference style) */}
        <div className="chat-editorial-tabs" role="tablist" aria-label="Chat mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'family'}
            onClick={() => switchMode('family')}
            className={`chat-editorial-tab ${mode === 'family' ? 'active' : ''}`}
          >
            <span>{lang === 'ml' ? 'കുടുംബ ചാറ്റ്' : 'Family Chat'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ai'}
            onClick={() => switchMode('ai')}
            className={`chat-editorial-tab ${mode === 'ai' ? 'active' : ''}`}
          >
            <span>Hommi AI</span>
            <span className="chat-ai-pill">AI</span>
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
