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
        {/* Left Info Column visible on desktop */}
        <div className="chat-header-info desktop-only">
          <div className="chat-header-avatar">
            <Icon name={mode === 'family' ? 'family' : 'sparkles'} size={18} />
          </div>
          <div>
            <div className="chat-header-title">
              {mode === 'family' ? (family?.name || 'Family Chat') : 'Hommi AI'}
            </div>
            <div className="chat-header-sub">
              {mode === 'family'
                ? `${family?.memberCount || 1} ${family?.memberCount === 1 ? 'member' : 'members'}`
                : (lang === 'ml' ? 'നിങ്ങളുടെ AI സഹായി' : 'Personal Family Copilot')}
            </div>
          </div>
        </div>

        {/* Mode Toggle Switch directly at top */}
        <div className="chat-mode-toggle">
          <button
            type="button"
            onClick={() => switchMode('family')}
            className={`chat-mode-btn ${mode === 'family' ? 'active' : ''}`}
          >
            <Icon name="family" size={15} />
            <span>{lang === 'ml' ? 'കുടുംബ ചാറ്റ്' : 'Family Chat'}</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('ai')}
            className={`chat-mode-btn ${mode === 'ai' ? 'active' : ''}`}
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
