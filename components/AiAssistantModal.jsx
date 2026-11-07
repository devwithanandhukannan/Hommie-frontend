'use client';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { post, upload } from '@/lib/api';
import { Sheet, Btn, Icon, Spinner } from '@/components/ui';

export default function AiAssistantModal({ onClose, onDone }) {
  const { lang, reloadFamily } = useAuth();
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

  const toggleAction = (action) => {
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
    setErrorMsg('');
    try {
      // Clean and sanitize payloads before sending to prevent 400 validation issues
      const cleanedActions = selectedActions.map((a) => ({
        type: a.type || 'grocery',
        title: String(a.title || '').trim().slice(0, 140),
        quantity: a.quantity ? String(a.quantity).slice(0, 60) : null,
        category: a.category ? String(a.category).slice(0, 50) : null,
        shop: a.shop ? String(a.shop).slice(0, 60) : null,
        amount: typeof a.amount === 'number' && !isNaN(a.amount) ? a.amount : null,
        dueDate: a.dueDate || undefined,
        slot: a.slot || undefined,
        date: a.date || undefined,
        cookName: a.cookName || undefined,
        assigneeName: a.assigneeName || undefined,
        targetId: a.targetId || undefined,
        ingredients: Array.isArray(a.ingredients) ? a.ingredients : undefined,
        steps: Array.isArray(a.steps) ? a.steps : undefined,
      }));

      await post('/ai/apply', { actions: cleanedActions, notifyInChat: true });
      setStep('success');
      reloadFamily().catch(() => {});
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

  const renderActionIcon = (type) => {
    if (type?.includes('grocery')) return <Icon name="cart" size={16} />;
    if (type?.includes('recipe')) return <Icon name="recipes" size={16} />;
    if (type?.includes('meal')) return <Icon name="meals" size={16} />;
    if (type?.includes('calendar')) return <Icon name="calendar" size={16} />;
    if (type?.includes('expense')) return <Icon name="money" size={16} />;
    if (type?.includes('bill')) return <Icon name="bills" size={16} />;
    if (type?.includes('medicine')) return <Icon name="med" size={16} />;
    return <Icon name="tasks" size={16} />;
  };

  // Group actions by kind and shop
  const recipeActions = (analysis?.actions || []).filter((a) => a.type?.includes('recipe'));
  const mealActions = (analysis?.actions || []).filter((a) => a.type?.includes('meal'));
  const calendarActions = (analysis?.actions || []).filter((a) => a.type?.includes('calendar'));
  const groceryActions = (analysis?.actions || []).filter((a) => a.type?.includes('grocery'));
  const otherActions = (analysis?.actions || []).filter(
    (a) => !a.type?.includes('recipe') && !a.type?.includes('meal') && !a.type?.includes('calendar') && !a.type?.includes('grocery')
  );

  // Group groceries by shop
  const groceriesByShop = {};
  for (const g of groceryActions) {
    const shop = g.shop || (lang === 'ml' ? 'പലചരക്ക് കട' : 'Supermarket / Grocery');
    if (!groceriesByShop[shop]) groceriesByShop[shop] = [];
    groceriesByShop[shop].push(g);
  }

  return (
    <Sheet
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkles" size={20} />
          <span>{lang === 'ml' ? 'Hommi AI സഹായി' : 'Hommi AI Assistant'}</span>
        </span>
      }
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.45 }}>
          {lang === 'ml'
            ? 'നിങ്ങളുടെ ശബ്ദത്തിൽ പറയുക (ഉദാ: "ബിരിയാണി ഉണ്ടാക്കണം റെസിപ്പിയും സാമാനങ്ങളും ലിസ്റ്റിൽ ചേർക്കുക", "നാളെ 1L പാൽ വാങ്ങണം", "കറന്റ് ബിൽ 850 അടക്കണം").'
            : 'Speak naturally in Malayalam, Manglish, or English (e.g. "Making biriyani for 5, add recipe and groceries by shop", "Buy 1L milk tomorrow").'}
        </p>

        {errorMsg ? (
          <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert" size={16} />
            <span>{errorMsg}</span>
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
                placeholder={lang === 'ml' ? 'ഉദാ: ബിരിയാണി ഉണ്ടാക്കണം, സാധനങ്ങൾ ചേർക്കൂ...' : 'e.g. Suggest biryani recipe and groceries...'}
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
              <span style={{ width: 20, height: 20, background: '#FFFFFF', borderRadius: 4 }} />
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
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="sparkles" size={18} />
              <span>{lang === 'ml' ? 'Hommi AI പരിശോധിക്കുന്നു...' : 'Hommi AI is analyzing...'}</span>
            </div>
            <div className="muted small" style={{ marginTop: 4 }}>
              {lang === 'ml' ? 'വിഭവങ്ങളും കടകളും സാധനങ്ങളും ക്രമീകരിക്കുന്നു...' : 'Arranging recipes, meals, and shop categories...'}
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
              <div className="ai-summary-text" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ marginTop: 2, flexShrink: 0 }}>
                  <Icon name="sparkles" size={16} />
                </span>
                <span style={{ flex: 1 }}>{analysis.summary}</span>
              </div>
            ) : null}

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 10, letterSpacing: '0.04em' }}>
                {lang === 'ml' ? 'കണ്ടെത്തിയവ (ആവശ്യമുള്ളവ തിരഞ്ഞെടുക്കാം):' : 'Detected items (select to add):'}
              </div>

              {analysis.actions && analysis.actions.length > 0 ? (
                <div className="col" style={{ gap: 12 }}>
                  {/* Recipe & Meal Schedule Cards */}
                  {(recipeActions.length > 0 || mealActions.length > 0 || calendarActions.length > 0) && (
                    <div className="col" style={{ gap: 8 }}>
                      {recipeActions.map((act, idx) => {
                        const isSelected = selectedActions.includes(act);
                        return (
                          <div
                            key={`recipe-${idx}`}
                            className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}
                            onClick={() => toggleAction(act)}
                            style={{ background: 'var(--bg-subtle, rgba(11, 107, 93, 0.08))', borderColor: 'var(--brand)' }}
                          >
                            <input
                              type="checkbox"
                              className="ai-chip-checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              aria-label={act.title}
                            />
                            <span className="ai-chip-icon">{renderActionIcon('recipe')}</span>
                            <span className="ai-chip-title" style={{ fontWeight: 600 }}>
                              {act.title}
                            </span>
                            <span className="ai-chip-tag" style={{ background: 'var(--brand)', color: '#fff' }}>
                              {lang === 'ml' ? 'പാചകക്കുറിപ്പ്' : 'Recipe'}
                            </span>
                          </div>
                        );
                      })}

                      {mealActions.map((act, idx) => {
                        const isSelected = selectedActions.includes(act);
                        return (
                          <div
                            key={`meal-${idx}`}
                            className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}
                            onClick={() => toggleAction(act)}
                          >
                            <input
                              type="checkbox"
                              className="ai-chip-checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              aria-label={act.title}
                            />
                            <span className="ai-chip-icon">{renderActionIcon('meal')}</span>
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
                        const isSelected = selectedActions.includes(act);
                        return (
                          <div
                            key={`cal-${idx}`}
                            className={`ai-chip-item ${!isSelected ? 'deselected' : ''}`}
                            onClick={() => toggleAction(act)}
                          >
                            <input
                              type="checkbox"
                              className="ai-chip-checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              aria-label={act.title}
                            />
                            <span className="ai-chip-icon">{renderActionIcon('calendar')}</span>
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

                  {/* Groceries Grouped by Shop */}
                  {Object.entries(groceriesByShop).map(([shopName, items]) => (
                    <div key={shopName} className="col" style={{ gap: 6 }}>
                      <div className="row" style={{ gap: 6, alignItems: 'center', marginTop: 4 }}>
                        <Icon name="store" size={14} />
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--brand)' }}>
                          {shopName}
                        </span>
                      </div>
                      <div className="col" style={{ gap: 6 }}>
                        {items.map((act, idx) => {
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
                                aria-label={act.title}
                              />
                              <span className="ai-chip-icon">{renderActionIcon('grocery')}</span>
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

                  {/* Other Actions (Tasks, Expenses, Bills) */}
                  {otherActions.length > 0 && (
                    <div className="col" style={{ gap: 6, marginTop: 4 }}>
                      {otherActions.map((act, idx) => {
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
                              aria-label={act.title}
                            />
                            <span className="ai-chip-icon">{renderActionIcon(act.type)}</span>
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
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                {applying ? (
                  <Spinner size={14} />
                ) : (
                  <>
                    <Icon name="check" size={15} />
                    <span>
                      {lang === 'ml'
                        ? `${selectedActions.length} എണ്ണം ചേർക്കുക`
                        : `Add ${selectedActions.length} item${selectedActions.length === 1 ? '' : 's'}`}
                    </span>
                  </>
                )}
              </Btn>
            </div>
          </div>
        ) : null}

        {step === 'success' ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(5, 150, 105, 0.12)',
                color: '#059669',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Icon name="check" size={26} />
            </div>
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
