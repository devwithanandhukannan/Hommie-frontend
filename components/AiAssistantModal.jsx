'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { post, upload } from '@/lib/api';
import { Sheet, Btn, Icon, Spinner } from '@/components/ui';

export default function AiAssistantModal({ onClose, onDone }) {
  const { t, lang } = useAuth();
  const [step, setStep] = useState('idle'); // 'idle' | 'recording' | 'analyzing' | 'review' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [typedText, setTypedText] = useState('');
  const [seconds, setSeconds] = useState(0);

  // Analysis result
  const [analysis, setAnalysis] = useState(null);
  const [selectedActions, setSelectedActions] = useState([]);
  const [applying, setApplying] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMsg('Microphone is not supported in this browser');
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
      setStep('recording');
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 29) {
            stopAndAnalyze();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      setErrorMsg('Microphone access denied or unavailable. You can type below instead.');
    }
  };

  const stopAndAnalyze = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setStep('analyzing');
    recorder.onstop = async () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      const mime = recorder.mimeType || 'audio/webm';
      const blob = new Blob(audioChunksRef.current, { type: mime });
      if (blob.size === 0) {
        setStep('idle');
        return;
      }

      try {
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `voice-ai-${Date.now()}.${ext}`, { type: mime });
        const f = new FormData();
        f.append('file', file);
        const a = await upload('/attachments', f);

        const res = await post('/ai/analyze', { attachmentId: a.id });
        setAnalysis(res);
        setSelectedActions(res.actions || []);
        setStep('review');
      } catch (err) {
        setErrorMsg(err.message || 'Failed to analyze audio');
        setStep('error');
      }
    };

    recorder.stop();
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    setStep('idle');
  };

  const analyzeTypedText = async (e) => {
    e?.preventDefault();
    const t = typedText.trim();
    if (!t) return;
    setStep('analyzing');
    setErrorMsg('');
    try {
      const res = await post('/ai/analyze', { text: t });
      setAnalysis(res);
      setSelectedActions(res.actions || []);
      setStep('review');
    } catch (err) {
      setErrorMsg(err.message || 'Failed to analyze text');
      setStep('error');
    }
  };

  const toggleAction = (idx) => {
    const action = analysis?.actions[idx];
    if (!action) return;
    if (selectedActions.includes(action)) {
      setSelectedActions((prev) => prev.filter((x) => x !== action));
    } else {
      setSelectedActions((prev) => [...prev, action]);
    }
  };

  const applyActions = async () => {
    if (selectedActions.length === 0) return;
    setApplying(true);
    try {
      await post('/ai/apply', { actions: selectedActions, notifyInChat: true });
      setStep('success');
      if (onDone) onDone();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save items');
    } finally {
      setApplying(false);
    }
  };

  const formatSecs = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  const getActionIcon = (type) => {
    switch (type) {
      case 'grocery': return '🛒';
      case 'bill': return '⚡';
      case 'expense': return '💸';
      case 'meal': return '🍲';
      case 'medicine': return '💊';
      default: return '📝';
    }
  };

  return (
    <Sheet
      title={lang === 'ml' ? '✨ Hommi AI സഹായി' : '✨ Hommi AI Assistant'}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.45 }}>
          {lang === 'ml'
            ? 'നിങ്ങളുടെ ശബ്ദത്തിൽ പറയുക (ഉദാ: "നാളെ 1L പാൽ വാങ്ങണം", "കറന്റ് ബിൽ 850 അടക്കണം", "അമ്മയ്ക്ക് പ്രഷറിന്റെ ഗുളിക വാങ്ങണം").'
            : 'Speak naturally in Malayalam, Manglish, or English (e.g. "Buy 1L milk tomorrow", "Paid electricity bill 850", "Buy medicine for mom").'}
        </p>

        {errorMsg ? (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', borderRadius: 8, fontSize: 13 }}>
            {errorMsg}
          </div>
        ) : null}

        {step === 'idle' ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <button
              type="button"
              className="ai-modal-pulse"
              onClick={startRecording}
              title="Tap to speak"
              aria-label="Tap to speak"
            >
              <Icon name="mic" size={32} />
            </button>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>
              {lang === 'ml' ? 'സംസാരിക്കാൻ ഇവിടെ അമർത്തുക' : 'Tap to speak'}
            </div>
            <div className="muted small" style={{ marginTop: 2 }}>
              {lang === 'ml' ? 'മലയാളത്തിലും പറയാം' : 'Supports Malayalam & English'}
            </div>

            <div style={{ margin: '20px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span className="muted small">{lang === 'ml' ? 'അല്ലെങ്കിൽ എഴുതുക' : 'or type below'}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            <form onSubmit={analyzeTypedText} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder={lang === 'ml' ? 'ഉദാ: നാളെ 1 കിലോ സവാള വാങ്ങണം...' : 'e.g. Buy 1kg onions tomorrow...'}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
              />
              <Btn type="submit" disabled={!typedText.trim()}>
                {lang === 'ml' ? 'പരിശോധിക്കുക' : 'Check'}
              </Btn>
            </form>
          </div>
        ) : null}

        {step === 'recording' ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button
              type="button"
              className="ai-modal-pulse recording"
              onClick={stopAndAnalyze}
              title="Stop and process"
              aria-label="Stop recording"
            >
              <span style={{ width: 22, height: 22, background: '#FFFFFF', borderRadius: 4 }} />
            </button>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#DC2626', marginTop: 8 }}>
              {formatSecs(seconds)} / 0:30
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {lang === 'ml' ? 'കേൾക്കുന്നു... പറഞ്ഞ് കഴിഞ്ഞ് മുകളിൽ അമർത്തുക' : 'Listening... Tap above when finished speaking'}
            </div>
            <div style={{ marginTop: 14 }}>
              <Btn tone="ghost" size="sm" onClick={cancelRecording}>
                {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
              </Btn>
            </div>
          </div>
        ) : null}

        {step === 'analyzing' ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <Spinner />
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 16 }}>
              {lang === 'ml' ? '✨ Hommi AI പരിശോധിക്കുന്നു...' : '✨ Hommi AI is analyzing...'}
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {lang === 'ml' ? 'ടാസ്കുകളും പലചരക്ക് സാധനങ്ങളും കണ്ടെത്തുന്നു...' : 'Extracting groceries, tasks, and bills...'}
            </div>
          </div>
        ) : null}

        {step === 'review' && analysis ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {analysis.transcription ? (
              <div className="ai-transcription-box">
                "{analysis.transcription}"
              </div>
            ) : null}

            {analysis.summary ? (
              <div className="ai-summary-text">
                💡 {analysis.summary}
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.04em' }}>
                {lang === 'ml' ? 'കണ്ടെത്തിയവ (ആവശ്യമുള്ളവ തിരഞ്ഞെടുക്കാം):' : 'Detected items (select to add):'}
              </div>

              {analysis.actions && analysis.actions.length > 0 ? (
                <div className="ai-chips-list">
                  {analysis.actions.map((act, idx) => {
                    const isSelected = selectedActions.includes(act);
                    return (
                      <div
                        key={idx}
                        className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}
                        onClick={() => toggleAction(idx)}
                      >
                        <input
                          type="checkbox"
                          className="ai-chip-checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          aria-label={`Select ${act.title}`}
                        />
                        <span className="ai-chip-icon">{getActionIcon(act.type)}</span>
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
              ) : (
                <div className="muted small" style={{ padding: '8px 0' }}>
                  {lang === 'ml' ? 'പ്രത്യേക ടാസ്കുകൾ ഒന്നും കണ്ടെത്തിയില്ല.' : 'No specific tasks or items found.'}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <Btn tone="ghost" className="grow" onClick={() => setStep('idle')}>
                {lang === 'ml' ? 'വീണ്ടും പറയാം' : 'Try again'}
              </Btn>
              <Btn
                className="grow"
                disabled={selectedActions.length === 0 || applying}
                onClick={applyActions}
              >
                {applying
                  ? (lang === 'ml' ? 'ചേർക്കുന്നു...' : 'Adding...')
                  : (lang === 'ml'
                      ? `✓ ${selectedActions.length} എണ്ണം ചേർക്കുക`
                      : `✓ Add ${selectedActions.length} item${selectedActions.length === 1 ? '' : 's'}`)}
              </Btn>
            </div>
          </div>
        ) : null}

        {step === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#059669' }}>
              {lang === 'ml' ? 'Hommi-ലേക്ക് ചേർത്തു!' : 'Added to Hommi!'}
            </div>
            <div className="muted small" style={{ marginTop: 4, marginBottom: 20 }}>
              {lang === 'ml' ? 'കുടുംബാംഗങ്ങൾക്കെല്ലാം കാണാവുന്നതാണ്.' : 'All items are now added to your family lists.'}
            </div>
            <Btn onClick={onClose} style={{ width: '100%' }}>
              {lang === 'ml' ? 'ശരി' : 'Done'}
            </Btn>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
