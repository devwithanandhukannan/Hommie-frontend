'use client';
import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import AgenticChatPanel from '@/components/AgenticChatPanel';
import { useAuth } from '@/lib/auth';
import { Spinner, Icon } from '@/components/ui';

const FAMILY_CHAT_LABEL = {
  en: 'Family Chat',
  ml: 'കുടുംബ ചാറ്റ്',
  ta: 'குடும்ப அரட்டை',
  hi: 'परिवार चैट',
};

function ChatPageContent() {
  const { lang } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = searchParams.get('mode') === 'ai' ? 'ai' : 'family';
  const [mode, setMode] = useState(initialMode);
  const [seenModes, setSeenModes] = useState(() => ({ family: initialMode === 'family', ai: initialMode === 'ai' }));

  useEffect(() => {
    const qMode = searchParams.get('mode');
    if (qMode === 'ai' || qMode === 'family') {
      setMode(qMode);
      setSeenModes((prev) => (prev[qMode] ? prev : { ...prev, [qMode]: true }));
    }
  }, [searchParams]);

  const switchMode = (m) => {
    setMode(m);
    setSeenModes((prev) => (prev[m] ? prev : { ...prev, [m]: true }));
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
            <span>{FAMILY_CHAT_LABEL[lang] || FAMILY_CHAT_LABEL.en}</span>
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
        {seenModes.family ? (
          <div style={{ display: mode === 'family' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }} aria-hidden={mode !== 'family'}>
            <ChatPanel />
          </div>
        ) : null}
        {seenModes.ai ? (
          <div style={{ display: mode === 'ai' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }} aria-hidden={mode !== 'ai'}>
            <AgenticChatPanel />
          </div>
        ) : null}
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
