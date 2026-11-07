'use client';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatPanel from '@/components/ChatPanel';
import AgenticChatPanel from '@/components/AgenticChatPanel';
import AiAssistantModal from '@/components/AiAssistantModal';
import { useAuth, useData } from '@/lib/auth';
import { Spinner, Icon } from '@/components/ui';

function ChatPageContent() {
  const { family, t, lang, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialMode = searchParams.get('mode') === 'family' ? 'family' : 'ai';
  const [mode, setMode] = useState(initialMode);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const auditData = useData('/families/current/audit', { interval: 60000 });

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

  const firstName = user?.name ? user.name.split(' ')[0] : 'Anandhu';

  // Activities list
  const recentActivities = useMemo(() => {
    if (auditData.data?.length) {
      return auditData.data.slice(0, 4).map((a) => {
        const timeStr = new Date(a.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
        let text = `${a.actor?.displayName || 'Someone'} ${a.action}`;
        if (a.entity) text += ` ${a.entity}`;
        return { id: a.id, text, time: timeStr };
      });
    }
    return [
      { id: '1', text: `${firstName} bought Basmati Rice`, time: '6:07 pm' },
      { id: '2', text: 'Bathroom cleaning added', time: '5:17 pm' },
    ];
  }, [auditData.data, firstName]);

  return (
    <div className="chat-editorial-page">
      {/* Header and Mode Toggle */}
      <div className="row between" style={{ marginBottom: 24, alignItems: 'center' }}>
        <div className="section-label">
          {mode === 'ai' ? 'ASK HOMMI' : 'FAMILY CHAT'}
        </div>

        {/* Minimalist Switch */}
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className={`pill-btn ${mode === 'ai' ? 'active' : ''}`}
            onClick={() => switchMode('ai')}
          >
            Ask Hommi
          </button>
          <button
            type="button"
            className={`pill-btn ${mode === 'family' ? 'active' : ''}`}
            onClick={() => switchMode('family')}
          >
            Family Chat
          </button>
        </div>
      </div>

      {mode === 'ai' ? (
        <div style={{ maxWidth: 540, margin: '0 auto', textAlign: 'center', paddingTop: 16 }}>
          {/* Big Serif Heading: Just say it. */}
          <h1 className="editorial-title" style={{ fontSize: 48, marginBottom: 10 }}>
            Just say it.
          </h1>

          <p className="muted" style={{ fontSize: 14.5, margin: '0 auto 40px', maxWidth: 360, lineHeight: 1.5 }}>
            Add groceries, tasks, bills or a meal, in Malayalam or English.
          </p>

          {/* Central Large Mic Button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              style={{
                width: 76,
                height: 76,
                borderRadius: '50%',
                background: 'var(--brand)',
                color: 'var(--on-brand)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                transition: 'transform 0.15s ease',
              }}
              aria-label="Start voice input"
            >
              <Icon name="mic" size={32} />
            </button>
          </div>

          {/* Sample Voice Transcript Bubble */}
          <div
            className="font-serif"
            style={{
              fontSize: 20,
              fontStyle: 'italic',
              color: 'var(--text)',
              marginBottom: 20,
            }}
          >
            “Add green chilli and tomato to the list.”
          </div>

          {/* Result Confirmation Card */}
          <div
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 48,
              textAlign: 'left',
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>Added to Shopping</div>
              <div className="muted tiny" style={{ marginTop: 2 }}>Green Chilli, Tomato</div>
            </div>
            <button
              type="button"
              className="editorial-link"
              style={{ fontSize: 13 }}
              onClick={() => {}}
            >
              Undo
            </button>
          </div>

          {/* Family Activity Feed */}
          <div style={{ textAlign: 'left', borderTop: '1px solid var(--line)', paddingTop: 20 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>
              FAMILY ACTIVITY
            </div>
            <div className="col" style={{ gap: 0 }}>
              {recentActivities.map((act) => (
                <div key={act.id}>
                  <div className="row between" style={{ padding: '10px 0', fontSize: 13.5 }}>
                    <span>{act.text}</span>
                    <span className="muted tiny">{act.time}</span>
                  </div>
                  <hr className="editorial-divider" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <ChatPanel />
        </div>
      )}

      {aiModalOpen ? (
        <AiAssistantModal
          onClose={() => setAiModalOpen(false)}
          onDone={() => setAiModalOpen(false)}
        />
      ) : null}
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
