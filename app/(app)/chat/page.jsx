'use client';
import ChatPanel from '@/components/ChatPanel';
import { useAuth } from '@/lib/auth';

export default function ChatPage() {
  const { family, t } = useAuth();
  return (
    <div className="chat-container-page">
      <div className="chat-header-bar">
        <div>
          <h1 className="bold" style={{ fontSize: 18, margin: 0 }}>{t('chat.title')}</h1>
          <div className="small muted" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {family?.members.map((m) => m.displayName).join(', ')}
          </div>
        </div>
      </div>
      <div className="card chat-card-wrap">
        <ChatPanel />
      </div>
    </div>
  );
}
