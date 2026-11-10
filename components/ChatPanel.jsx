'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, get, post, upload, getBlob } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { translateNotificationText } from '@/lib/i18n';
import { Avatar, Icon, Spinner, useAction, useToast } from '@/components/ui';
import { hhmm } from '@/lib/format';
import AiAssistantModal from './AiAssistantModal';

function formatDatePill(dateStr, lang = 'en') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const isSameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (isSameDay) {
    if (lang === 'ml') return 'ഇന്ന്';
    if (lang === 'ta') return 'இன்று';
    if (lang === 'hi') return 'आज';
    return 'Today';
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (d.getFullYear() === yest.getFullYear() && d.getMonth() === yest.getMonth() && d.getDate() === yest.getDate()) {
    if (lang === 'ml') return 'ഇന്നലെ';
    if (lang === 'ta') return 'நேற்று';
    if (lang === 'hi') return 'कल';
    return 'Yesterday';
  }
  const loc = lang === 'ml' ? 'ml-IN' : lang === 'ta' ? 'ta-IN' : lang === 'hi' ? 'hi-IN' : 'en-US';
  return d.toLocaleDateString(loc, { month: 'short', day: 'numeric' });
}

function getSystemMessageInfo(m) {
  let kind = m.ref?.kind;
  if (!kind) {
    const txt = (m.text || '').toLowerCase();
    if (txt.includes('bought by') || txt.includes('grocery') || txt.includes('bought') || txt.includes('egg') || txt.includes('rice') || txt.includes('tomato') || txt.includes('പഞ്ചസാര') || txt.includes('മുളകുപൊടി') || txt.includes('hommi ai added')) kind = 'grocery';
    else if (txt.includes('paid by') || txt.includes('₹') || txt.includes('bill') || txt.includes('paid') || txt.includes('current')) kind = 'bill';
    else if (txt.includes('completed') || txt.includes('task') || txt.includes('done') || txt.includes('clean') || txt.includes('cleaning')) kind = 'task';
    else if (txt.includes('joined')) kind = 'family';
    else kind = 'grocery';
  }
  return kind;
}

function ChatImage({ id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url; let alive = true;
    getBlob(`/attachments/${id}`).then((b) => {
      if (alive) { url = URL.createObjectURL(b); setSrc(url); }
    }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);
  return src ? (
    <img className="chat-img" src={src} alt="Shared in chat" />
  ) : (
    <div className="chat-img" style={{ width: 140, height: 90, background: 'var(--surface-2)' }} />
  );
}

function ChatAudio({ id, duration, isMe }) {
  const [src, setSrc] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    let url; let alive = true;
    getBlob(`/attachments/${id}`).then((b) => {
      if (alive) { url = URL.createObjectURL(b); setSrc(url); }
    }).catch(() => {});
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [id]);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  };

  const onTimeUpdate = () => {
    const el = audioRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    const dur = el.duration || duration || 1;
    setProgress(Math.min(100, (el.currentTime / dur) * 100));
  };

  const onEnded = () => {
    setPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const fmt = (s) => {
    const sec = Math.floor(s || 0);
    const m = Math.floor(sec / 60);
    const r = sec % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  return (
    <div className={`voice-player ${isMe ? 'me' : ''}`}>
      {src ? (
        <audio
          ref={audioRef}
          src={src}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
          preload="metadata"
        />
      ) : null}
      <button
        type="button"
        className="voice-play-btn"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={14} />
      </button>
      <div className="voice-player-main">
        <div
          className="voice-progress-track"
          onClick={(e) => {
            if (!audioRef.current) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const dur = audioRef.current.duration || duration || 1;
            audioRef.current.currentTime = pct * dur;
          }}
        >
          <div className="voice-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="voice-player-time">
          <span>{fmt(currentTime)}</span>
          <span>{duration ? fmt(duration) : '0:30'}</span>
        </div>
      </div>
    </div>
  );
}

function AiActionCard({ attachmentId, text, lang, t, onApplied }) {
  const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'scanned' | 'applied' | 'error'
  const [analysis, setAnalysis] = useState(null);
  const [selectedActions, setSelectedActions] = useState([]);
  const [applying, setApplying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const scan = async () => {
    setState('loading');
    setErrorMsg('');
    try {
      const res = await post('/ai/analyze', { attachmentId, text });
      setAnalysis(res);
      setSelectedActions(res.actions || []);
      setState('scanned');
    } catch (err) {
      setErrorMsg(err.message || 'AI analysis failed');
      setState('error');
    }
  };

  const toggleAction = (act) => {
    if (selectedActions.includes(act)) {
      setSelectedActions((prev) => prev.filter((x) => x !== act));
    } else {
      setSelectedActions((prev) => [...prev, act]);
    }
  };

  const apply = async () => {
    if (selectedActions.length === 0) return;
    setApplying(true);
    try {
      await post('/ai/apply', { actions: selectedActions, notifyInChat: true });
      setState('applied');
      if (onApplied) onApplied();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save items');
    } finally {
      setApplying(false);
    }
  };

  const renderActionIcon = (type) => {
    if (type?.includes('grocery')) return <Icon name="cart" size={16} />;
    if (type?.includes('bill')) return <Icon name="bills" size={16} />;
    if (type?.includes('expense')) return <Icon name="money" size={16} />;
    if (type?.includes('meal')) return <Icon name="meals" size={16} />;
    if (type?.includes('medicine')) return <Icon name="med" size={16} />;
    return <Icon name="tasks" size={16} />;
  };

  if (state === 'idle') {
    return (
      <button
        type="button"
        className="ai-scan-trigger"
        onClick={scan}
        title={t('chat.ai_scan')}
      >
        <Icon name="sparkles" size={14} />
        <span>{t('chat.ai_scan')}</span>
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <div className="ai-scan-trigger" style={{ cursor: 'default', opacity: 0.85 }}>
        <Spinner size={12} />
        <span>{t('chat.ai_analyzing')}</span>
      </div>
    );
  }

  if (state === 'applied') {
    return (
      <div className="ai-applied-badge">
        <Icon name="check" size={14} />
        <span>{t('chat.ai_added_badge')}</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div style={{ fontSize: 11, color: '#DC2626', marginTop: 4 }}>
        {errorMsg} · <button type="button" onClick={scan} style={{ background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>{lang === 'ml' ? 'വീണ്ടും ശ്രമിക്കുക' : 'Retry'}</button>
      </div>
    );
  }

  if (state === 'scanned' && analysis) {
    return (
      <div className="ai-action-card">
        <div className="ai-card-header">
          <span className="ai-card-badge">
            <Icon name="sparkles" size={14} />
            <span>{t('chat.ai_assistant')}</span>
          </span>
          <button
            type="button"
            className="ai-card-close"
            onClick={() => setState('idle')}
            title="Close"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {analysis.transcription ? (
          <div className="ai-transcription-box">
            "{analysis.transcription}"
          </div>
        ) : null}

        {analysis.actions && analysis.actions.length > 0 ? (
          <>
            <div className="ai-chips-list">
              {analysis.actions.map((act, idx) => {
                const isSelected = selectedActions.includes(act);
                return (
                  <div
                    key={idx}
                    className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}
                    onClick={() => toggleAction(act)}
                  >
                    <input
                      type="checkbox"
                      className="ai-chip-checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      aria-label={`Select ${act.title}`}
                    />
                    <span className="ai-chip-icon">{renderActionIcon(act.type)}</span>
                    <span className="ai-chip-title">
                      {act.title}
                      {act.quantity ? ` (${act.quantity})` : ''}
                      {act.amount ? ` (₹${act.amount})` : ''}
                    </span>
                    <span className="ai-chip-tag">{act.type}</span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="ai-apply-btn"
              disabled={selectedActions.length === 0 || applying}
              onClick={apply}
            >
              {applying ? (
                <Spinner size={13} />
              ) : (
                <span>
                  + {t('chat.ai_add_btn')} ({selectedActions.length})
                </span>
              )}
            </button>
          </>
        ) : (
          <div className="ai-summary-text">
            {t('chat.ai_no_actions')}
          </div>
        )}
      </div>
    );
  }

  return null;
}

const KIND_INFO = {
  task: { label: 'Task', icon: 'tasks', link: '/tasks', btnText: 'Open Task ›' },
  grocery: { label: 'Grocery', icon: 'grocery', link: '/grocery', btnText: 'Open Grocery ›' },
  bill_instance: { label: 'Bill', icon: 'bills', link: '/bills', btnText: 'View Bill ›' },
  bill: { label: 'Bill', icon: 'bills', link: '/bills', btnText: 'View Bill ›' },
  pay: { label: 'Bill · Pay', icon: 'bills', link: '/bills', btnText: 'View Bill ›' },
  recipe: { label: 'Recipe', icon: 'meals', link: '/recipes', btnText: 'View Recipe ›' },
};

function getKind(m) {
  if (m.ref?.kind) {
    if (m.ref.kind === 'task') return 'task';
    if (m.ref.kind === 'grocery') return 'grocery';
    if (m.ref.kind === 'bill_instance' || m.ref.kind === 'bill') return 'pay';
    if (m.ref.kind === 'recipe') return 'recipe';
  }
  const t = (m.text || '').toLowerCase();
  if (/paid|₹|amount|bill/i.test(t)) return 'pay';
  if (/bought|grocery|stock/i.test(t)) return 'grocery';
  if (/completed:|task|chore/i.test(t)) return 'task';
  return null;
}

function renderMessageText(text) {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      return (
        <span key={i} className="mention-tag">
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function ChatPanel({ compact = false }) {
  const { me, family, familyId, reloadFamily, t, lang } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState(null);
  const [text, setText] = useState('');
  const [run, busy] = useAction();
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const lastId = useRef(null);
  const stick = useRef(true);
  const fileRef = useRef(null);
  const inputRef = useRef(null);

  // Quote-reply state
  const [replyingTo, setReplyingTo] = useState(null);

  // Pill Bar Menu Popover state
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTextTargetId, setAiTextTargetId] = useState(null);

  // Voice Recording state (Max 30s Countdown 30 -> 1)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSecondsLeft, setRecordingSecondsLeft] = useState(30);
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const secondsLeftRef = useRef(30);

  // Mention Autocomplete state
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionCursor, setMentionCursor] = useState(0);

  const membersList = useMemo(() => family?.members || [], [family?.members]);

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const list = [
      { id: 'all', tag: '@all', name: 'All members', desc: 'Notify everyone in family' },
    ];
    for (const m of membersList) {
      const cleanName = m.displayName.replace(/\s+/g, '');
      list.push({
        id: m.membershipId,
        tag: `@${cleanName}`,
        name: m.displayName,
        desc: m.relation || 'Member',
      });
      if (m.relation && m.relation !== 'other') {
        const rel = m.relation.toLowerCase();
        list.push({
          id: `${m.membershipId}_rel`,
          tag: `@${rel}`,
          name: m.displayName,
          desc: m.relation,
        });
      }
    }
    return list.filter(
      (item) =>
        item.tag.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q)
    );
  }, [mentionQuery, membersList]);

  // Track completed/done tasks, bought groceries and paid bills
  const completedRefs = useMemo(() => {
    const ids = new Set();
    const titles = new Set();
    (items || []).forEach((m) => {
      if (m.ref?.status === 'done' || m.ref?.status === 'stocked' || m.ref?.status === 'paid') {
        if (m.ref.id) ids.add(String(m.ref.id));
        if (m.ref.title) titles.add(m.ref.title.trim().toLowerCase());
      }
      if (m.type === 'system') {
        if (m.ref?.id) ids.add(String(m.ref.id));
        if (m.ref?.title) titles.add(m.ref.title.trim().toLowerCase());
        const txt = m.text || '';
        const comp = txt.match(/completed:\s*(.+)$/i);
        if (comp) titles.add(comp[1].trim().toLowerCase());
        const bought = txt.match(/^(.+?)\s+bought by/i);
        if (bought) titles.add(bought[1].trim().toLowerCase());
        const paid = txt.match(/^(.+?)\s*(\(.*?\))?\s*paid by/i);
        if (paid) titles.add(paid[1].trim().toLowerCase());
      }
    });
    return { ids, titles };
  }, [items]);

  const markRead = useCallback(() => { post('/chat/read', {}).catch(() => {}); }, []);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: 'end' });
    }
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  const scrollDown = useCallback((behavior = 'auto') => {
    requestAnimationFrame(() => {
      scrollToBottom(behavior);
    });
  }, [scrollToBottom]);

  // When messages load or update, auto-scroll to the newest message at bottom
  useEffect(() => {
    if (items && items.length > 0) {
      scrollToBottom('auto');
      const t1 = setTimeout(() => scrollToBottom('auto'), 40);
      const t2 = setTimeout(() => scrollToBottom('auto'), 160);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [items, scrollToBottom]);

  const scrollToMessage = (id) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-flash');
      setTimeout(() => el.classList.remove('highlight-flash'), 1800);
    }
  };

  useEffect(() => {
    let alive = true;
    setItems(null);
    lastId.current = null;
    stick.current = true;
    get('/chat/messages?limit=40')
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        lastId.current = r.items.at(-1)?.id || null;
        markRead();
        scrollDown();
      })
      .catch(() => alive && setItems([]));

    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || !alive) return;
      try {
        const q = lastId.current ? `?after=${lastId.current}` : '?limit=40';
        const r = await get(`/chat/messages${q}`);
        if (r.items.length && alive) {
          setItems((cur) => {
            const seen = new Set((cur || []).map((m) => m.id));
            return [...(cur || []), ...r.items.filter((m) => !seen.has(m.id))];
          });
          lastId.current = r.items.at(-1).id;
          markRead();
          scrollDown();
        }
      } catch {
        /* offline */
      }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [familyId, markRead]);

  const append = (m) => {
    setItems((cur) => [...(cur || []), m]);
    lastId.current = m.id;
    stick.current = true;
    scrollToBottom('smooth');
    setTimeout(() => scrollToBottom('smooth'), 50);
    reloadFamily().catch(() => {});
  };

  const send = async (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    const body = { text: t };
    if (replyingTo) {
      body.replyTo = {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        text: replyingTo.text,
      };
    }
    const m = await run(() => post('/chat/messages', body));
    if (m && m !== true) {
      setText('');
      setReplyingTo(null);
      setMentionQuery(null);
      setMoreMenuOpen(false);
      append(m);
    }
  };

  const sendImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast('Image must be under 4 MB', true);
      return;
    }
    const m = await run(async () => {
      const f = new FormData();
      f.append('file', file);
      const a = await upload('/attachments', f);
      const body = { attachmentId: a.id };
      if (replyingTo) {
        body.replyTo = {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyingTo.text,
        };
      }
      return post('/chat/messages', body);
    });
    if (m && m !== true) {
      setReplyingTo(null);
      setMoreMenuOpen(false);
      append(m);
    }
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast('Voice recording is not supported in this browser', true);
        return;
      }
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
      setRecordingSecondsLeft(30);
      secondsLeftRef.current = 30;
      setMoreMenuOpen(false);

      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        secondsLeftRef.current -= 1;
        setRecordingSecondsLeft(secondsLeftRef.current);
        if (secondsLeftRef.current <= 0) {
          clearInterval(recordingTimerRef.current);
          stopAndSendVoice();
        }
      }, 1000);
    } catch {
      toast('Microphone access denied or unavailable', true);
    }
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    setIsRecording(false);
    audioChunksRef.current = [];
  };

  const stopAndSendVoice = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    const recordedSecs = Math.max(1, 30 - secondsLeftRef.current);
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
      const ext = mime.includes('mp4') ? 'mp4' : 'webm';
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });

      const m = await run(async () => {
        const f = new FormData();
        f.append('file', file);
        const a = await upload('/attachments', f);
        const body = {
          attachmentId: a.id,
          audioDuration: recordedSecs,
        };
        if (replyingTo) {
          body.replyTo = {
            id: replyingTo.id,
            senderName: replyingTo.senderName,
            text: replyingTo.text,
          };
        }
        return post('/chat/messages', body);
      });
      if (m && m !== true) {
        setReplyingTo(null);
        append(m);
      }
    };
    recorder.stop();
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;
    setText(val);
    setMentionCursor(cursor);

    const textBeforeCursor = val.slice(0, cursor);
    const match = textBeforeCursor.match(/@([\w]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (tag) => {
    const textBeforeCursor = text.slice(0, mentionCursor);
    const textAfterCursor = text.slice(mentionCursor);
    const newPrefix = textBeforeCursor.replace(/@[\w]*$/, `${tag} `);
    setText(newPrefix + textAfterCursor);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const quickTask = async () => {
    const t = text.trim();
    if (!t) {
      toast('Type the task in the input box first');
      inputRef.current?.focus();
      return;
    }
    const m = await run(async () => {
      const task = await post('/tasks', { title: t });
      return post('/chat/messages', { ref: { kind: 'task', id: task.id } });
    }, 'Task created');
    if (m && m !== true) {
      setText('');
      append(m);
    }
  };

  const quickGrocery = async () => {
    const t = text.trim();
    if (!t) {
      toast('Type the grocery item in the input box first');
      inputRef.current?.focus();
      return;
    }
    const m = await run(async () => {
      const g = await post('/grocery', { name: t });
      return post('/chat/messages', { ref: { kind: 'grocery', id: g.id } });
    }, `${t} added to grocery`);
    if (m && m !== true) {
      setText('');
      append(m);
    }
  };

  const del = async (m) => {
    if (await run(() => api('DELETE', `/chat/messages/${m.id}`))) {
      setItems((cur) => cur.filter((x) => x.id !== m.id));
    }
  };

  if (!items) return <Spinner />;

  return (
    <div className="chat" style={compact ? { height: '100%', flex: 1, minHeight: 480 } : undefined}>
      <div
        className="chat-list"
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        aria-live="polite"
        aria-label="Messages"
      >
        {items.length === 0 ? <div className="empty">{t('chat.empty')}</div> : null}

        {items.map((m, index) => {
          const mine = m.sender?.membershipId === me;
          const prevMsg = items[index - 1];
          const isDifferentDay = !prevMsg || new Date(m.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {/* Reference Image 1 Style Date Separator Pill */}
              {isDifferentDay ? (
                <div className="chat-date-pill-wrap">
                  <span className="chat-date-pill">{formatDatePill(m.createdAt, lang)}</span>
                </div>
              ) : null}

              {m.type === 'system' ? (() => {
                const sysKind = getSystemMessageInfo(m);
                const rawText = (m.text || '')
                  .replace(/🤖\s*Hommi\s*AI\s*added:\s*/gi, '')
                  .replace(/[🤖🛒💸⚡✓]/g, '')
                  .trim();
                const cleanText = translateNotificationText(rawText, lang) || rawText;
                return (
                  <div id={`msg-${m.id}`} className="sys-pill-wrap">
                    <div className={`sys-pill ${sysKind}`}>
                      <span className="sys-pill-icon">
                        {sysKind === 'task' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : sysKind === 'bill' ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 3h16a1 1 0 0 1 1 1v16l-3-1.5L15 20l-3-1.5L9 20l-3-1.5L3 20V4a1 1 0 0 1 1-1z" />
                            <line x1="8" y1="8" x2="16" y2="8" />
                            <line x1="8" y1="12" x2="16" y2="12" />
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                          </svg>
                        )}
                      </span>
                      <span>{cleanText}</span>
                      <span className="sys-pill-time">{hhmm(m.createdAt)}</span>
                    </div>
                  </div>
                );
              })() : m.type === 'card' && m.ref ? (() => {
                const cardKind = m.ref.kind || 'task';
                const senderName = (m.sender?.displayName || 'Family').toUpperCase();
                const isDone = Boolean(
                  m.ref.status === 'done' ||
                  (m.ref.id && completedRefs.ids.has(String(m.ref.id))) ||
                  (m.ref.title && completedRefs.titles.has(m.ref.title.trim().toLowerCase()))
                );
                return (
                  <div id={`msg-${m.id}`} className={`refcard-container ${mine ? 'me' : 'them'}`}>
                    {!mine ? (
                      <div className="chat-avatar-wrap">
                        <Avatar member={m.sender} size={24} />
                      </div>
                    ) : null}
                    <div className="refcard-box">
                      <div className={`refcard-card ${cardKind} ${isDone ? 'is-done' : ''}`}>
                        <div className="refcard-card-head">
                          <span className="refcard-head-icon">
                            {isDone ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : cardKind === 'grocery' ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                              </svg>
                            ) : cardKind === 'bill' || cardKind === 'pay' ? (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M4 3h16a1 1 0 0 1 1 1v16l-3-1.5L15 20l-3-1.5L9 20l-3-1.5L3 20V4a1 1 0 0 1 1-1z" />
                                <line x1="8" y1="8" x2="16" y2="8" />
                              </svg>
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="18" height="18" rx="4" />
                                <polyline points="9 12 11 14 15 10" />
                              </svg>
                            )}
                          </span>
                          <span>{senderName} {cardKind === 'grocery' ? t('chat.shared_grocery') : cardKind === 'bill' || cardKind === 'pay' ? t('chat.shared_bill') : t('chat.shared_task')}</span>
                        </div>
                        <div className={`refcard-card-title ${isDone ? 'done-title' : ''}`}>{m.ref.title}</div>
                        {isDone ? (
                          <Link
                            href={cardKind === 'task' ? '/tasks?scope=done' : cardKind === 'grocery' ? '/grocery' : '/bills'}
                            className="refcard-card-btn done"
                            title={t('btn.done')}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            <span>{t('btn.done')}</span>
                          </Link>
                        ) : (
                          <Link
                            href={cardKind === 'grocery' ? '/grocery' : cardKind === 'task' ? '/tasks' : '/bills'}
                            className="refcard-card-btn"
                          >
                            {cardKind === 'task' ? t('chat.open_task') : cardKind === 'grocery' ? t('chat.open_grocery') : t('chat.open_bill')} ›
                          </Link>
                        )}
                      </div>
                      <div className="chat-meta-time">
                        {hhmm(m.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })() : (
                /* Reference Image 1 Message Row: White Card Bubble, Refined Small Font */
                <div
                  id={`msg-${m.id}`}
                  className={`chat-msg-row ${mine ? 'me' : 'them'}`}
                >
                  {!mine ? (
                    <div className="chat-avatar-wrap">
                      <Avatar member={m.sender} size={24} />
                    </div>
                  ) : null}

                  <div className="chat-msg-body">
                    {!mine ? (
                      <div className="chat-sender-label">{m.sender?.displayName || 'Assistant'}</div>
                    ) : null}

                    <div className={`bubble ${mine ? 'me' : 'them'}`}>
                      {/* Quoted Message Block (WhatsApp Style) */}
                      {m.replyTo ? (
                        <div
                          className="quoted-box"
                          onClick={() => scrollToMessage(m.replyTo.id)}
                          title="Jump to quoted message"
                        >
                          <div className="quoted-sender">{m.replyTo.senderName}</div>
                          <div className="quoted-text">{m.replyTo.text}</div>
                        </div>
                      ) : null}

                      {/* Photo Attachment */}
                      {m.attachmentId && m.type !== 'audio' ? (
                        <ChatImage id={m.attachmentId} />
                      ) : null}

                      {/* Voice Note Player */}
                      {m.type === 'audio' && m.attachmentId ? (
                        <>
                          <ChatAudio id={m.attachmentId} duration={m.audioDuration} isMe={mine} />
                          <AiActionCard attachmentId={m.attachmentId} lang={lang} t={t} onApplied={reloadFamily} />
                        </>
                      ) : null}

                      {/* Text with @mentions */}
                      {m.text ? (
                        <div className="chat-text-content">{renderMessageText(m.text)}</div>
                      ) : null}

                      {aiTextTargetId === m.id && m.text ? (
                        <AiActionCard text={m.text} lang={lang} t={t} onApplied={reloadFamily} />
                      ) : null}
                    </div>

                    <div className="chat-meta-row">
                      <span>{hhmm(m.createdAt)}</span>
                      {mine && m.readByCount ? <span> · {lang === 'ml' ? `${m.readByCount} പേർ കണ്ടു` : lang === 'ta' ? `${m.readByCount} பார்த்துள்ளனர்` : lang === 'hi' ? `${m.readByCount} ने देखा` : `Seen by ${m.readByCount}`}</span> : null}
                      {m.text ? (
                        <button
                          type="button"
                          className="meta-action-btn"
                          onClick={() => setAiTextTargetId(aiTextTargetId === m.id ? null : m.id)}
                          title={t('chat.ai_scan')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Icon name="sparkles" size={11} />
                          <span>AI</span>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="meta-action-btn"
                        onClick={() =>
                          setReplyingTo({
                            id: m.id,
                            senderName: m.sender?.displayName || 'Family',
                            text: m.text || (m.type === 'audio' ? 'Voice message' : 'Photo'),
                          })
                        }
                        title="Reply to message"
                      >
                        <Icon name="reply" size={11} /> {lang === 'ml' ? 'മറുപടി' : lang === 'ta' ? 'பதில்' : lang === 'hi' ? 'उत्तर' : 'reply'}
                      </button>
                      {mine ? (
                        <button
                          type="button"
                          className="meta-action-btn del"
                          onClick={() => del(m)}
                          title="Delete message"
                        >
                          {t('btn.delete')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Scroll anchor at bottom to keep view on newest messages */}
        <div ref={bottomRef} style={{ height: 1, minHeight: 1, flexShrink: 0 }} />
      </div>

      {/* Refined Minimalist Action Chips (Image 1 Style Quick Pills) */}
      <div className="chat-chips-bar" aria-label="Quick actions">
        <button
          type="button"
          className="chat-chip-pill ai-voice"
          onClick={() => setAiModalOpen(true)}
          title={t('chat.ai_voice_assistant')}
        >
          <Icon name="sparkles" size={14} />
          <span>{lang === 'ml' ? 'എഐ വോയ്സ്' : 'AI Voice'}</span>
        </button>
        <button
          type="button"
          className="chat-chip-pill"
          onClick={quickGrocery}
          title="Add current text to grocery"
        >
          <span className="chip-dot dot-green" /> {t('chat.grocery_chip')}
        </button>
        <button
          type="button"
          className="chat-chip-pill"
          onClick={quickTask}
          title="Add current text as a task"
        >
          <span className="chip-dot dot-blue" /> {t('chat.task_chip')}
        </button>
        <button
          type="button"
          className="chat-chip-pill"
          onClick={() => fileRef.current?.click()}
          title="Attach photo"
        >
          <Icon name="photo" size={13} /> {t('chat.photo_chip')}
        </button>
      </div>

      {/* Reference Image 3 Floating Capsule Input Bar */}
      <div className="chat-composer-wrap">
        {/* Mention Suggestions Popover */}
        {mentionSuggestions.length > 0 ? (
          <div className="mention-popup" role="listbox" aria-label="Tag members">
            {mentionSuggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                className="mention-item"
                onClick={() => insertMention(item.tag)}
              >
                <span className="bold" style={{ color: 'var(--brand)' }}>{item.tag}</span>
                <span className="small">{item.name}</span>
                <span className="tiny muted" style={{ marginLeft: 'auto' }}>{item.desc}</span>
              </button>
            ))}
          </div>
        ) : null}

        {/* WhatsApp-Style Reply Preview Bar */}
        {replyingTo ? (
          <div className="reply-preview-bar">
            <div className="reply-preview-accent" />
            <div className="reply-preview-content">
              <span className="reply-preview-sender">{replyingTo.senderName}</span>
              <span className="reply-preview-text">{replyingTo.text}</span>
            </div>
            <button
              type="button"
              className="reply-preview-close"
              aria-label="Cancel reply"
              onClick={() => setReplyingTo(null)}
            >
              ✕
            </button>
          </div>
        ) : null}

        {/* Floating More Actions Tray (...) */}
        {moreMenuOpen ? (
          <div className="pill-menu-popup">
            <button
              type="button"
              className="pill-menu-item"
              onClick={() => { setMoreMenuOpen(false); setAiModalOpen(true); }}
            >
              <Icon name="sparkles" size={16} /> {t('chat.ai_voice_assistant')}
            </button>
            <button
              type="button"
              className="pill-menu-item"
              onClick={() => { setMoreMenuOpen(false); fileRef.current?.click(); }}
            >
              <Icon name="photo" size={16} /> {t('chat.attach_photo')}
            </button>
            <button
              type="button"
              className="pill-menu-item"
              onClick={() => { setMoreMenuOpen(false); quickGrocery(); }}
            >
              <Icon name="grocery" size={16} /> {t('chat.add_grocery')}
            </button>
            <button
              type="button"
              className="pill-menu-item"
              onClick={() => { setMoreMenuOpen(false); quickTask(); }}
            >
              <Icon name="tasks" size={16} /> {t('chat.add_task')}
            </button>
            <button
              type="button"
              className="pill-menu-item"
              onClick={() => { setMoreMenuOpen(false); startRecording(); }}
            >
              <Icon name="mic" size={16} /> {t('chat.voice_note')}
            </button>
          </div>
        ) : null}

        {/* Voice Recording Mode with Countdown from 30 to 1 */}
        {isRecording ? (
          <div className="voice-record-bar" role="status" aria-label={t('chat.recording')}>
            <div className="voice-record-left">
              <span className="record-dot" />
              <span className="record-countdown">
                00:{recordingSecondsLeft < 10 ? `0${recordingSecondsLeft}` : recordingSecondsLeft}
              </span>
              <div className="record-waves" aria-hidden="true">
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
                <span className="record-wave-bar" />
              </div>
            </div>
            <div className="voice-record-actions">
              <button
                type="button"
                className="chat-pill-cancel-btn"
                onClick={cancelRecording}
                title={t('chat.cancel')}
                aria-label={t('chat.cancel')}
              >
                <Icon name="trash" size={17} />
              </button>
              <button
                type="button"
                className="chat-pill-action-btn"
                onClick={stopAndSendVoice}
                title={t('chat.send')}
                aria-label={t('chat.send')}
              >
                <Icon name="send" size={16} />
              </button>
            </div>
          </div>
        ) : (
          /* Exact Reference Image 3 Design: Floating Capsule with (...) on Left and Green Mic/Send on Right */
          <form className="chat-pill-bar" onSubmit={send}>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={sendImage}
            />

            {/* Left Action Button: (...) */}
            <button
              type="button"
              className={`chat-pill-more-btn ${moreMenuOpen ? 'active' : ''}`}
              aria-label="More actions"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              title="More actions (photo, tasks, grocery)"
            >
              <span>•••</span>
            </button>

            {/* Center Input Field */}
            <input
              ref={inputRef}
              className="chat-pill-input"
              aria-label="Message"
              placeholder={t('chat.placeholder')}
              maxLength={2000}
              value={text}
              onChange={handleTextChange}
            />

            {/* Right Action Button: Dark Green Circular Mic / Send Button (Reference Image 3) */}
            {text.trim() ? (
              <button
                type="submit"
                className="chat-pill-action-btn"
                aria-label="Send message"
                disabled={busy}
                title="Send message"
              >
                <Icon name="send" size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="chat-pill-action-btn"
                aria-label="Record voice note"
                onClick={startRecording}
                title="Record voice note (max 30s)"
              >
                <Icon name="mic" size={17} />
              </button>
            )}
          </form>
        )}
      </div>

      {aiModalOpen ? (
        <AiAssistantModal
          onClose={() => setAiModalOpen(false)}
          onDone={() => {
            setAiModalOpen(false);
            reloadFamily().catch(() => {});
          }}
        />
      ) : null}
    </div>
  );
}
