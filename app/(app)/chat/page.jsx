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
      <div className="chat-header-bar">
        <div className="chat-mode-toggle" role="tablist" aria-label="Chat mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'family'}
            onClick={() => switchMode('family')}
            className={`chat-mode-btn ${mode === 'family' ? 'active' : ''}`}
          >
            <Icon name="family" size={15} />
            <span>{lang === 'ml' ? 'കുടുംബ ചാറ്റ്' : 'Family Chat'}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'ai'}
            onClick={() => switchMode('ai')}
            className={`chat-mode-btn ai ${mode === 'ai' ? 'active' : ''}`}
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
