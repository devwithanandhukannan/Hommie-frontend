'use client';
import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { useAuth, notifyChanged } from '@/lib/auth';
import { post, upload } from '@/lib/api';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { sanitizeAiActions } from '@/lib/aiActions';
import AiActionsList from '@/components/AiActionsList';
import { Icon, Spinner, formatErrorMessage } from '@/components/ui';
import { AiReplyBody, parseAiReply } from '@/components/StepTimeline';
import { hhmm } from '@/lib/format';

const WELCOME_COPY = {
  en: {
    text: 'Hello! I am your Hommi AI assistant. Ask me what fast meal you can cook from your kitchen groceries, detailed step-by-step recipes, pending chores, or this month’s family expenses.',
    suggestedChips: ['What can I cook fast?', 'What to buy?', 'Make Biriyani (check kitchen)', 'Monthly expenses', 'Today’s medicines'],
  },
  ml: {
    text: 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ Hommi AI സഹായിയാണ്. അടുക്കളയിലെ സാധനങ്ങൾ വെച്ച് പെട്ടെന്ന് എന്ത് ഉണ്ടാക്കാം എന്നും, ബിരിയാണി പോലുള്ള വിഭവങ്ങളുടെ മുഴുവൻ റെസിപ്പിയും സാധനങ്ങളുടെ ലിസ്റ്റും, ജോലികളും, ഈ മാസത്തെ ചിലവും എന്നോട് ചോദിക്കാം.',
    suggestedChips: ['അടുക്കളയിലെ സാധനങ്ങൾ വെച്ച് പെട്ടെന്ന് എന്ത് ഉണ്ടാക്കാം?', 'എന്തൊക്കെ വാങ്ങാനുണ്ട്?', 'ബിരിയാണി ഉണ്ടാക്കാൻ എന്ത് വേണം?', 'ഈ മാസത്തെ ചിലവ് എത്ര?', 'ഇന്നത്തെ മരുന്നുകൾ'],
  },
  ta: {
    text: 'வணக்கம்! நான் உங்கள் Hommi AI உதவியாளர். சமையலறை பொருட்களை வைத்து விரைவாக என்ன சமைக்கலாம், விரிவான சமையல் குறிப்புகள், மளிகைப் பட்டியல், நிலுவையில் உள்ள பணிகள் அல்லது இந்த மாத செலவுகள் பற்றி கேட்கலாம்.',
    suggestedChips: ['உடனே என்ன சமைக்கலாம்?', 'என்ன வாங்க வேண்டும்?', 'பிரியாணி செய்ய என்ன வேண்டும்?', 'மாதச் செலவு எவ்வளவு?', 'இன்றைய மருந்துகள்'],
  },
  hi: {
    text: 'नमस्ते! मैं आपका Hommi AI सहायक हूँ। रसोई में मौजूद सामान से झटपट क्या बना सकते हैं, पूरी रेसिपी, किराना सूची, बाकी काम या इस महीने का खर्च मुझसे पूछें।',
    suggestedChips: ['जल्दी क्या बना सकते हैं?', 'क्या खरीदना बाकी है?', 'बिरयानी बनाने के लिए क्या चाहिए?', 'इस महीने का खर्च', 'आज की दवाइयाँ'],
  },
};

function buildWelcomeMessage(lang) {
  const copy = WELCOME_COPY[lang] || WELCOME_COPY.en;
  return {
    id: 'welcome',
    role: 'assistant',
    text: copy.text,
    actions: [],
    suggestedChips: copy.suggestedChips,
  };
}

function compactClientHistory(msgs) {
  return msgs
    .filter((m) => m.id !== 'welcome' && m.text)
    .slice(-4)
    .map((m) => ({
      role: m.role,
      content: String(m.text).slice(0, m.role === 'assistant' ? 350 : 500),
    }));
}

export default function AgenticChatPanel() {
  const { lang, familyId, reloadFamily } = useAuth();
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(lang)]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [actionError, setActionError] = useState('');

  const inputId = useId();
  const inputRef = useRef(null);
  const scrollRef = useRef(null);
  const busyRef = useRef(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const storageKey = familyId ? `hommi_ai_chat_${familyId}` : null;

  // Restore session conversation per family cleanly after mount (SSR hydration-safe)
  useEffect(() => {
    if (!storageKey) {
      setMessages([buildWelcomeMessage(lang)]);
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      }
    } catch {}
    setMessages([buildWelcomeMessage(lang)]);
  }, [storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update welcome copy on language switch if user hasn't started chatting yet
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === 'welcome') {
        return [buildWelcomeMessage(lang)];
      }
      return prev;
    });
  }, [lang]);

  // Persist last 30 turns in sessionStorage
  useEffect(() => {
    if (!storageKey || messages.length <= 1) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'auto' });
    const t = setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
    return () => clearTimeout(t);
  }, [messages, busy]);

  const sendQuery = useCallback(async ({ text = '', audioFile = null, speechLang = '' } = {}) => {
    if (busyRef.current) return;
    const textToSend = (text || '').trim();
    if (!textToSend && !audioFile) return;

    setActionError('');
    busyRef.current = true;
    setBusy(true);

    const userMsgId = String(Date.now());
    const userMsg = {
      id: userMsgId,
      role: 'user',
      text: textToSend || (lang === 'ml' ? 'ശബ്ദ സന്ദേശം പ്രോസസ്സ് ചെയ്യുന്നു...' : 'Processing voice message...'),
      timestamp: new Date().toISOString(),
    };

    const history = compactClientHistory(messagesRef.current);
    setMessages((prev) => [...prev, userMsg]);
    if (textToSend) setInput('');

    try {
      let res;
      if (audioFile) {
        const fd = new FormData();
        fd.append('file', audioFile);
        if (speechLang) fd.append('speechLang', speechLang);
        if (history.length > 0) fd.append('history', JSON.stringify(history));
        res = await upload('/ai/agent', fd);
      } else {
        const payload = { message: textToSend, history };
        if (speechLang) payload.speechLang = speechLang;
        res = await post('/ai/agent', payload);
      }

      if (audioFile && res?.transcription) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, text: `"${res.transcription}"` } : m))
        );
      } else if (audioFile) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, text: lang === 'ml' ? 'ശബ്ദ സന്ദേശം' : 'Voice message' } : m))
        );
      }

      const actions = Array.isArray(res?.actions) ? res.actions : [];
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: 'assistant',
          text: res?.reply || '',
          actions,
          suggestedChips: Array.isArray(res?.suggestedChips) ? res.suggestedChips : [],
          selectedActions: [...actions],
          applied: false,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      const replyIsMl = /[\u0D00-\u0D7F]/.test(textToSend) || (lang === 'ml' && !textToSend);
      const errText = formatErrorMessage(err);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 2),
          role: 'assistant',
          text:
            errText ||
            (replyIsMl
              ? 'ക്ഷമിക്കണം, ബന്ധപ്പെടാൻ സാധിച്ചില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.'
              : 'Sorry, could not process request. Please try again.'),
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [lang]);

  const handleVoiceResult = useCallback(({ transcript, audioFile, speechLang, action }) => {
    if (transcript) {
      if (action === 'edit') {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }
      sendQuery({ text: transcript, speechLang });
      return;
    }
    if (audioFile) {
      sendQuery({ audioFile, speechLang });
    }
  }, [sendQuery]);

  const voice = useVoiceInput({ uiLang: lang, disabled: busy, onResult: handleVoiceResult });

  const clearChat = () => {
    if (busy) return;
    if (storageKey) {
      try { sessionStorage.removeItem(storageKey); } catch {}
    }
    setActionError('');
    setMessages([buildWelcomeMessage(lang)]);
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
    if (!actionsToApply || actionsToApply.length === 0 || applyingId) return;
    setActionError('');
    setApplyingId(msgId);
    try {
      const sanitized = sanitizeAiActions(actionsToApply);
      await post('/ai/apply', { actions: sanitized, notifyInChat: true });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      );
      notifyChanged();
      reloadFamily().catch(() => {});
    } catch (err) {
      setActionError(
        formatErrorMessage(err) ||
          (lang === 'ml' ? 'ഇനങ്ങൾ ചേർക്കാൻ സാധിച്ചില്ല. വീണ്ടും ശ്രമിക്കുക.' : 'Failed to apply items. Please try again.')
      );
    } finally {
      setApplyingId(null);
    }
  };

  const activeError = actionError || voice.error;
  const voiceBadge = voice.voiceLocale === 'ml-IN' ? 'ML' : 'EN';
  const formatSecs = (s) => `00:${s < 10 ? `0${s}` : s}`;

  return (
    <div className="agentic-chat-panel">
      {/* Compact Session Controls */}
      {messages.length > 1 ? (
        <div className="agentic-toolbar">
          <button
            type="button"
            className="agentic-reset-btn"
            onClick={clearChat}
            disabled={busy}
            aria-label={lang === 'ml' ? 'പുതിയ ചാറ്റ് തുടങ്ങുക' : 'Start a new conversation'}
          >
            <Icon name="plus" size={13} />
            <span>{lang === 'ml' ? 'പുതിയ ചാറ്റ്' : 'New chat'}</span>
          </button>
        </div>
      ) : null}

      {/* Messages Scroll Area */}
      <div className="agentic-messages-list">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          const recipeActions = (m.actions || []).filter((a) => a.type?.includes('recipe'));
          const groceryActions = (m.actions || []).filter((a) => a.type?.includes('grocery'));

          const blocks = isUser ? null : parseAiReply(m.text, {
            hasRecipeAction: recipeActions.length > 0,
            missingNames: groceryActions.map((g) => g.title),
          });
          const hasInlineSteps = Boolean(blocks?.some((b) => b.type === 'steps'));

          return (
            <div key={m.id} className={`agentic-msg-row ${isUser ? 'user' : 'assistant'}`}>
              <div className={`agentic-bubble ${isUser ? 'user' : 'assistant'}`}>
                {isUser ? (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.text}</div>
                ) : (
                  <AiReplyBody
                    text={m.text}
                    lang={lang}
                    hasRecipeAction={recipeActions.length > 0}
                    missingNames={groceryActions.map((g) => g.title)}
                  />
                )}

                {/* Proposed Action Card */}
                {!isUser && m.actions && m.actions.length > 0 ? (
                  <div className="agentic-action-card">
                    <div className="row between" style={{ marginBottom: 10, alignItems: 'center' }}>
                      <span className="small bold" style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="sparkles" size={15} />
                        <span>
                          {m.actions[0].type === 'delete_task'
                            ? (lang === 'ml' ? 'ഒഴിവാക്കേണ്ട ജോലി' : 'Remove task')
                            : (lang === 'ml' ? 'ചെയ്യാൻ പറ്റുന്നവ' : 'Ready to save')}
                        </span>
                      </span>
                    </div>

                    <AiActionsList
                      actions={m.actions}
                      selected={m.selectedActions || []}
                      onToggle={(act) => toggleActionItem(m.id, act)}
                      onApply={() => executeActions(m.id, m.selectedActions)}
                      applying={applyingId === m.id}
                      applied={Boolean(m.applied)}
                      lang={lang}
                      hasInlineSteps={hasInlineSteps}
                    />
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
                        disabled={busy}
                        onClick={() => sendQuery({ text: chip })}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                ) : null}

                {m.timestamp ? (
                  <div className="agentic-msg-time">{hhmm(m.timestamp)}</div>
                ) : null}
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

      {/* Composer + Voice Status */}
      <div className="chat-composer-wrap">
        {activeError ? (
          <div className="ai-voice-alert" role="alert">
            <Icon name="alert" size={15} />
            <span className="grow">{activeError}</span>
            <button
              type="button"
              className="ai-voice-alert-close"
              onClick={() => { setActionError(''); voice.clearError(); }}
              aria-label="Dismiss error"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : null}

        {voice.isRecording ? (
          <div className="voice-record-bar">
            <div className="voice-record-left">
              <span className="record-dot" aria-hidden="true" />
              <span className="record-countdown">{formatSecs(voice.seconds)}</span>
              {voice.mode === 'audio' ? (
                <span className="record-waves" aria-hidden="true">
                  <span className="record-wave-bar" />
                  <span className="record-wave-bar" />
                  <span className="record-wave-bar" />
                  <span className="record-wave-bar" />
                  <span className="record-wave-bar" />
                </span>
              ) : null}
              <span className="voice-live-text">
                {voice.liveTranscript
                  ? voice.liveTranscript
                  : lang === 'ml'
                  ? `കേൾക്കുന്നു (${voiceBadge})...`
                  : `Listening (${voiceBadge})...`}
              </span>
            </div>
            <div className="voice-record-actions">
              <button
                type="button"
                className="chat-pill-cancel-btn"
                onClick={voice.cancel}
                aria-label={lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel recording'}
              >
                <Icon name="trash" size={17} />
              </button>
              {voice.mode === 'speech' && voice.liveTranscript ? (
                <button
                  type="button"
                  className="chat-pill-cancel-btn"
                  onClick={() => voice.stop('edit')}
                  aria-label={lang === 'ml' ? 'തിരുത്തിയെഴുതുക' : 'Edit transcript'}
                >
                  <Icon name="edit" size={16} />
                </button>
              ) : null}
              <button
                type="button"
                className="chat-pill-action-btn"
                onClick={() => voice.stop('send')}
                aria-label={lang === 'ml' ? 'അയക്കുക' : 'Send voice message'}
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          </div>
        ) : (
          <form
            className="chat-pill-bar"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy && input.trim()) {
                sendQuery({ text: input });
              }
            }}
          >
            <label htmlFor={inputId} className="visually-hidden">
              {lang === 'ml' ? 'Hommi AI-യോട് ചോദിക്കുക' : 'Ask Hommi AI'}
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="chat-pill-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === 'ml' ? 'ചോദിക്കാം (ഉദാ: എന്തൊക്കെ വാങ്ങാനുണ്ട്, ബിരിയാണി ഉണ്ടാക്കണം...)' : 'Ask Hommi AI (e.g. what to buy, make biriyani...)'}
              maxLength={1000}
              autoComplete="off"
              disabled={busy}
            />
            {!input.trim() ? (
              <button
                type="button"
                className="voice-lang-pill"
                onClick={voice.toggleVoiceLocale}
                disabled={busy}
                aria-label={
                  voiceBadge === 'ML'
                    ? 'Speech language: Malayalam. Switch to English'
                    : 'Speech language: English. Switch to Malayalam'
                }
              >
                {voiceBadge}
              </button>
            ) : null}
            {input.trim() ? (
              <button
                type="submit"
                className="chat-pill-action-btn"
                disabled={busy}
                aria-label={lang === 'ml' ? 'അയക്കുക' : 'Send query'}
              >
                <Icon name="send" size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="chat-pill-action-btn"
                onClick={() => voice.start()}
                disabled={busy}
                aria-label={lang === 'ml' ? 'ശബ്ദത്തിൽ ചോദിക്കുക' : 'Speak to Hommi AI'}
              >
                <Icon name="mic" size={17} />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
