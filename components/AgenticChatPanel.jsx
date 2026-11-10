'use client';
import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { useAuth, notifyChanged } from '@/lib/auth';
import { post, upload } from '@/lib/api';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { sanitizeAiActions, actionIconName } from '@/lib/aiActions';
import { Icon, Spinner, formatErrorMessage } from '@/components/ui';
import StepTimeline, { AiReplyBody, parseAiReply } from '@/components/StepTimeline';
import { hhmm } from '@/lib/format';

function buildWelcomeMessage(lang) {
  return {
    id: 'welcome',
    role: 'assistant',
    text:
      lang === 'ml'
        ? 'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ Hommi AI സഹായിയാണ്. അടുക്കളയിലെ സാധനങ്ങൾ അറിയാനും, ബിരിയാണി പോലുള്ള വിഭവങ്ങൾക്കുള്ള ലിസ്റ്റ് തയ്യാറാക്കാനും, ജോലികൾ നൽകാനും, ഈ മാസത്തെ ചിലവ് കണക്കാക്കാനും എന്നോട് ചോദിക്കാം.'
        : 'Hello! I am your Hommi AI assistant. Ask me what groceries to buy, ingredients needed for biriyani, pending chores, or this month’s family expenses.',
    actions: [],
    suggestedChips:
      lang === 'ml'
        ? ['എന്തൊക്കെ വാങ്ങാനുണ്ട്?', 'ബിരിയാണി ഉണ്ടാക്കാൻ എന്ത് വേണം?', 'ഈ മാസത്തെ ചിലവ് എത്ര?', 'ഇന്നത്തെ മരുന്നുകൾ']
        : ['What to buy?', 'Make Biriyani (check kitchen)', 'Monthly expenses', 'Today’s medicines'],
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
          const mealActions = (m.actions || []).filter((a) => a.type?.includes('meal'));
          const calendarActions = (m.actions || []).filter((a) => a.type?.includes('calendar'));
          const groceryActions = (m.actions || []).filter((a) => a.type?.includes('grocery'));
          const otherActions = (m.actions || []).filter(
            (a) => !a.type?.includes('recipe') && !a.type?.includes('meal') && !a.type?.includes('calendar') && !a.type?.includes('grocery')
          );

          const groceriesByShop = {};
          for (const g of groceryActions) {
            const shop = g.shop || (lang === 'ml' ? 'പലചരക്ക് കട' : 'Supermarket / Grocery');
            if (!groceriesByShop[shop]) groceriesByShop[shop] = [];
            groceriesByShop[shop].push(g);
          }

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
                    <div className="row between" style={{ marginBottom: 8, alignItems: 'center' }}>
                      <span className="small bold" style={{ color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="sparkles" size={15} />
                        <span>
                          {m.actions[0].type === 'delete_task'
                            ? (lang === 'ml' ? 'ഒഴിവാക്കേണ്ട ജോലി' : 'Task to delete')
                            : (lang === 'ml' ? 'നിർദ്ദേശിച്ച ഇനങ്ങൾ' : 'Suggested Actions')}
                        </span>
                      </span>
                      {m.applied ? (
                        <span className="small bold" style={{ color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Icon name="check" size={14} />
                          <span>{lang === 'ml' ? 'ചേർത്തു' : 'Applied'}</span>
                        </span>
                      ) : null}
                    </div>

                    {!m.applied ? (
                      <div className="col" style={{ gap: 10 }}>
                        {(recipeActions.length > 0 || mealActions.length > 0 || calendarActions.length > 0) && (
                          <div className="col" style={{ gap: 6 }}>
                            {recipeActions.map((act, idx) => {
                              const isSelected = (m.selectedActions || []).includes(act);
                              return (
                                <div key={`rec-${idx}`} className="col" style={{ gap: 6 }}>
                                  <div
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
                                    <span className="ai-chip-icon"><Icon name={actionIconName('recipe')} size={16} /></span>
                                    <span className="ai-chip-title" style={{ fontWeight: 600 }}>
                                      {act.title}
                                    </span>
                                    {act.steps?.length ? (
                                      <span className="small muted">{act.steps.length} steps</span>
                                    ) : null}
                                    <span className="ai-chip-tag">
                                      {lang === 'ml' ? 'പാചകക്കുറിപ്പ്' : 'Recipe'}
                                    </span>
                                  </div>
                                  {!hasInlineSteps && act.steps?.length ? (
                                    <div className="ai-act-steps-box">
                                      <StepTimeline steps={act.steps} title={lang === 'ml' ? 'തയ്യാറാക്കുന്ന വിധം' : 'Steps'} estimate />
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}

                            {mealActions.map((act, idx) => {
                              const isSelected = (m.selectedActions || []).includes(act);
                              return (
                                <div
                                  key={`meal-${idx}`}
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
                                  <span className="ai-chip-icon"><Icon name={actionIconName('meal')} size={16} /></span>
                                  <span className="ai-chip-title">
                                    {act.title} {act.date ? `· ${act.date}` : ''} {act.slot ? `(${act.slot})` : ''}
                                    {act.cookName ? ` · Cook: ${act.cookName}` : ''}
                                  </span>
                                  <span className="ai-chip-tag">
                                    {lang === 'ml' ? 'ഭക്ഷണ പ്ലാൻ' : 'Meal'}
                                  </span>
                                </div>
                              );
                            })}

                            {calendarActions.map((act, idx) => {
                              const isSelected = (m.selectedActions || []).includes(act);
                              return (
                                <div
                                  key={`cal-${idx}`}
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
                                  <span className="ai-chip-icon"><Icon name={actionIconName('calendar')} size={16} /></span>
                                  <span className="ai-chip-title">
                                    {act.title} {act.dueDate ? `· ${act.dueDate}` : ''}
                                    {act.assigneeName ? ` · ${act.assigneeName}` : ''}
                                  </span>
                                  <span className="ai-chip-tag">
                                    {lang === 'ml' ? 'കലണ്ടർ' : 'Calendar'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {Object.entries(groceriesByShop).map(([shopName, items]) => (
                          <div key={shopName} className="col" style={{ gap: 6 }}>
                            <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 2 }}>
                              <Icon name="store" size={14} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>
                                {shopName}
                              </span>
                            </div>
                            <div className="col" style={{ gap: 6 }}>
                              {items.map((act, idx) => {
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
                                    <span className="ai-chip-icon"><Icon name={actionIconName('grocery')} size={16} /></span>
                                    <span className="ai-chip-title">
                                      {act.title}
                                      {act.quantity ? ` (${act.quantity})` : ''}
                                    </span>
                                    {act.category ? (
                                      <span className="ai-chip-tag">{act.category}</span>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        {otherActions.length > 0 && (
                          <div className="col" style={{ gap: 6, marginTop: 2 }}>
                            {otherActions.map((act, idx) => {
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
                                  <span className="ai-chip-icon"><Icon name={actionIconName(act.type)} size={16} /></span>
                                  <span className="ai-chip-title">
                                    {act.title}
                                    {act.amount ? ` (₹${act.amount})` : ''}
                                  </span>
                                  <span className="ai-chip-tag">{act.type}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <button
                          type="button"
                          className="ai-apply-btn"
                          disabled={applyingId === m.id || (m.selectedActions || []).length === 0}
                          onClick={() => executeActions(m.id, m.selectedActions)}
                          style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                        >
                          {applyingId === m.id ? (
                            <Spinner size={13} />
                          ) : m.actions[0].type === 'delete_task' ? (
                            <span>{lang === 'ml' ? 'ജോലി ഒഴിവാക്കുക' : 'Delete Task'}</span>
                          ) : (
                            <>
                              <Icon name="check" size={15} />
                              <span>
                                {lang === 'ml' ? 'Hommi-ലേക്ക് ചേർക്കുക' : 'Add to Hommi'} ({(m.selectedActions || []).length})
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="ai-applied-badge" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon name="check" size={16} />
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
