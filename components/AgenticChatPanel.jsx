'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { post, upload } from '@/lib/api';
import { Icon, Spinner, Btn } from '@/components/ui';
import { hhmm } from '@/lib/format';

export default function AgenticChatPanel() {
  const { lang, reloadFamily } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text:
        lang === 'ml'
          ? 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ Hommi AI സഹായിയാണ്. അടുക്കളയിലെ സാധനങ്ങൾ അറിയാനും, ബിരിയാണി പോലുള്ള വിഭവങ്ങൾക്കുള്ള ലിസ്റ്റ് തയ്യാറാക്കാനും, ജോലികൾ നൽകാനും, ഈ മാസത്തെ ചിലവ് കണക്കാക്കാനും എന്നോട് ചോദിക്കാം.'
          : 'Hello! I am your Hommi AI assistant. Ask me what groceries to buy, what ingredients you need to cook biriyani, your tasks today, or this month’s family expenses.',
      actions: [],
      timestamp: new Date().toISOString(),
      suggestedChips:
        lang === 'ml'
          ? ['🛒 എന്തൊക്കെ വാങ്ങാനുണ്ട്?', '🍲 ബിരിയാണി ഉണ്ടാക്കാൻ എന്ത് വേണം?', '💸 ഈ മാസത്തെ ചിലവ് എത്ര?', '💊 ഇന്നത്തെ മരുന്നുകൾ']
          : ['🛒 What to buy?', '🍲 Make Biriyani (check kitchen)', '💸 Monthly expenses', '💊 Today’s medicines'],
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingId, setApplyingId] = useState(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const sendQuery = async (queryText, attachmentId = null) => {
    const textToSend = (queryText || '').trim();
    if (!textToSend && !attachmentId) return;

    const userMsgId = String(Date.now());
    const userMsg = {
      id: userMsgId,
      role: 'user',
      text: textToSend || (lang === 'ml' ? '🎤 വോയ്സ് നോട്ട് അയച്ചു...' : '🎤 Spoke voice message...'),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);

    try {
      // Build history for context (last 6 messages)
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const payload = { history };
      if (textToSend) payload.message = textToSend;
      if (attachmentId) payload.attachmentId = attachmentId;

      const res = await post('/ai/agent', payload);

      // If audio transcription returned, update user message text
      if (res.transcription && attachmentId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, text: `"${res.transcription}"` } : m))
        );
      }

      const assistantMsg = {
        id: String(Date.now() + 1),
        role: 'assistant',
        text: res.reply || '',
        actions: Array.isArray(res.actions) ? res.actions : [],
        suggestedChips: Array.isArray(res.suggestedChips) ? res.suggestedChips : [],
        selectedActions: Array.isArray(res.actions) ? [...res.actions] : [],
        applied: false,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 2),
          role: 'assistant',
          text: lang === 'ml' ? 'ക്ഷമിക്കണം, ബന്ധപ്പെടാൻ സാധിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.' : 'Sorry, could not process request. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const startVoice = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(100);
      setIsRecording(true);
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 29) {
            stopAndSendVoice();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      alert('Microphone access denied or unavailable');
    }
  };

  const stopAndSendVoice = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      return;
    }

    recorder.onstop = async () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      setIsRecording(false);
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mime });
      if (blob.size === 0) return;

      try {
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `agent-${Date.now()}.${ext}`, { type: mime });
        const f = new FormData();
        f.append('file', file);
        const a = await upload('/attachments', f);
        await sendQuery('', a.id);
      } catch {}
    };

    recorder.stop();
  };

  const cancelVoice = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    audioChunksRef.current = [];
    setIsRecording(false);
  };

  const toggleActionItem = (msgId, action) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        const current = m.selectedActions || [];
        const next = current.includes(action)
          ? current.filter((x) => x !== action)
          : [...current, action];
        return { ...m, selectedActions: next };
      })
    );
  };

  const executeActions = async (msgId, actionsToApply) => {
    if (!actionsToApply || actionsToApply.length === 0) return;
    setApplyingId(msgId);
    try {
      await post('/ai/apply', { actions: actionsToApply, notifyInChat: true });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      );
      reloadFamily().catch(() => {});
    } catch {}
    finally {
      setApplyingId(null);
    }
  };

  const getActionIcon = (type) => {
    if (type?.includes('grocery')) return '🛒';
    if (type?.includes('task')) return '📝';
    if (type?.includes('delete')) return '🗑️';
    if (type?.includes('expense')) return '💸';
    if (type?.includes('medicine')) return '💊';
    return '⚡';
  };

  return (
    <div className="agentic-chat-panel">
      {/* Top Banner */}
      <div className="agentic-header">
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>✨</span>
          <div>
            <div className="bold" style={{ fontSize: 14 }}>Hommi AI Agent</div>
            <div className="tiny muted">{lang === 'ml' ? 'വീട്ടുസഹായി · ചോദിക്കാം' : 'Household Assistant · Ask anything'}</div>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="agentic-messages-list">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div key={m.id} className={`agentic-msg-row ${isUser ? 'user' : 'assistant'}`}>
              <div className={`agentic-bubble ${isUser ? 'user' : 'assistant'}`}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {m.text}
                </div>

                {/* Proposed Action Card */}
                {!isUser && m.actions && m.actions.length > 0 ? (
                  <div className="agentic-action-card">
                    <div className="row between" style={{ marginBottom: 6 }}>
                      <span className="small bold" style={{ color: 'var(--brand)' }}>
                        {m.actions[0].type === 'delete_task'
                          ? (lang === 'ml' ? 'ഒഴിവാക്കേണ്ട ജോലി' : 'Task to delete')
                          : (lang === 'ml' ? '✨ നിർദ്ദേശിച്ച ഇനങ്ങൾ' : '✨ Suggested Actions')}
                      </span>
                      {m.applied ? (
                        <span className="small bold" style={{ color: '#059669' }}>
                          {lang === 'ml' ? '✓ ചേർത്തു' : '✓ Applied'}
                        </span>
                      ) : null}
                    </div>

                    {!m.applied ? (
                      <div className="col" style={{ gap: 6 }}>
                        {m.actions.map((act, idx) => {
                          const isSelected = (m.selectedActions || []).includes(act);
                          return (
                            <div
                              key={idx}
                              className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}
                              onClick={() => toggleActionItem(m.id, act)}
                            >
                              <input
                                type="checkbox"
                                className="ai-chip-checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                aria-label={act.title}
                              />
                              <span className="ai-chip-icon">{getActionIcon(act.type)}</span>
                              <span className="ai-chip-title">
                                {act.title}
                                {act.quantity ? ` (${act.quantity})` : ''}
                                {act.amount ? ` (₹${act.amount})` : ''}
                              </span>
                              {act.category ? (
                                <span className="ai-chip-tag">{act.category}</span>
                              ) : null}
                            </div>
                          );
                        })}

                        <button
                          type="button"
                          className="ai-apply-btn"
                          disabled={applyingId === m.id || (m.selectedActions || []).length === 0}
                          onClick={() => executeActions(m.id, m.selectedActions)}
                          style={{ marginTop: 4 }}
                        >
                          {applyingId === m.id ? (
                            <Spinner size={13} />
                          ) : m.actions[0].type === 'delete_task' ? (
                            <span>{lang === 'ml' ? 'ജോലി ഒഴിവാക്കുക' : 'Delete Task'}</span>
                          ) : (
                            <span>
                              + {lang === 'ml' ? 'Hommi-ലേക്ക് ചേർക്കുക' : 'Add to Hommi'} ({(m.selectedActions || []).length})
                            </span>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="ai-applied-badge">
                        <span>✓</span>
                        <span>{lang === 'ml' ? 'വിവരങ്ങൾ Hommi-ലേക്ക് ചേർത്തു!' : 'Items updated in family lists!'}</span>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* Follow-up Suggested Query Chips */}
                {!isUser && m.suggestedChips && m.suggestedChips.length > 0 && !busy ? (
                  <div className="agentic-chips-row">
                    {m.suggestedChips.map((chip, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="agentic-chip-btn"
                        onClick={() => sendQuery(chip)}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="agentic-msg-time">
                  {hhmm(m.timestamp)}
                </div>
              </div>
            </div>
          );
        })}

        {busy ? (
          <div className="agentic-msg-row assistant">
            <div className="agentic-bubble assistant" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Spinner size={14} />
              <span className="small muted">{lang === 'ml' ? 'Hommi ചിന്തിക്കുന്നു...' : 'Hommi is thinking...'}</span>
            </div>
          </div>
        ) : null}

        <div ref={scrollRef} />
      </div>

      {/* Voice Recording Active Bar */}
      {isRecording ? (
        <div className="voice-record-bar" style={{ margin: '8px 12px 14px' }}>
          <div className="voice-record-left">
            <span className="record-dot" />
            <span className="record-countdown">00:{seconds < 10 ? `0${seconds}` : seconds}</span>
            <span className="small" style={{ marginLeft: 8 }}>
              {lang === 'ml' ? 'കേൾക്കുന്നു...' : 'Listening...'}
            </span>
          </div>
          <div className="voice-record-actions">
            <button
              type="button"
              className="chat-pill-cancel-btn"
              onClick={cancelVoice}
              title="Cancel"
            >
              <Icon name="trash" size={17} />
            </button>
            <button
              type="button"
              className="chat-pill-action-btn"
              onClick={stopAndSendVoice}
              title="Send"
            >
              <Icon name="send" size={16} />
            </button>
          </div>
        </div>
      ) : (
        /* Bottom Input Composer */
        <form
          className="chat-pill-bar"
          style={{ margin: '8px 12px 14px' }}
          onSubmit={(e) => {
            e.preventDefault();
            sendQuery(input);
          }}
        >
          <input
            className="chat-pill-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={lang === 'ml' ? 'ചോദിക്കാം (ഉദാ: എന്തൊക്കെ വാങ്ങാനുണ്ട്, ബിരിയാണി ഉണ്ടാക്കണം...)' : 'Ask Hommi AI (e.g. what to buy, make biriyani...)'}
            maxLength={1000}
          />
          {input.trim() ? (
            <button
              type="submit"
              className="chat-pill-action-btn"
              disabled={busy}
              title="Send query"
            >
              <Icon name="send" size={16} />
            </button>
          ) : (
            <button
              type="button"
              className="chat-pill-action-btn"
              onClick={startVoice}
              title="Speak to Hommi AI"
            >
              <Icon name="mic" size={17} />
            </button>
          )}
        </form>
      )}
    </div>
  );
}

