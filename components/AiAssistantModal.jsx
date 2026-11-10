'use client';
import { useState, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, notifyChanged } from '@/lib/auth';
import { post, upload } from '@/lib/api';
import { useVoiceInput } from '@/lib/useVoiceInput';
import { sanitizeAiActions } from '@/lib/aiActions';
import AiActionsList from '@/components/AiActionsList';
import { Sheet, Btn, Icon, Spinner, formatErrorMessage } from '@/components/ui';
import { AiReplyBody, parseAiReply } from '@/components/StepTimeline';

export default function AiAssistantModal({ onClose, onDone }) {
  const { lang, reloadFamily } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState('idle'); // 'idle' | 'analyzing' | 'review' | 'success'
  const [errorMsg, setErrorMsg] = useState('');
  const [typedText, setTypedText] = useState('');

  const [analysis, setAnalysis] = useState(null);
  const [selectedActions, setSelectedActions] = useState([]);
  const [applying, setApplying] = useState(false);
  const [savedSummary, setSavedSummary] = useState({ hasRecipe: false, hasGrocery: false });

  const inputId = useId();

  const handleVoiceResult = useCallback(async ({ transcript, audioFile, speechLang, action }) => {
    if (transcript && action === 'edit') {
      setTypedText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      return;
    }

    setStep('analyzing');
    setErrorMsg('');
    try {
      let res;
      if (transcript) {
        res = await post('/ai/analyze', { text: transcript, ...(speechLang ? { speechLang } : {}) });
      } else if (audioFile) {
        const fd = new FormData();
        fd.append('file', audioFile);
        if (speechLang) fd.append('speechLang', speechLang);
        res = await upload('/ai/analyze', fd);
      } else {
        setStep('idle');
        return;
      }
      setAnalysis(res);
      setSelectedActions(res.actions || []);
      setStep('review');
    } catch (err) {
      setErrorMsg(formatErrorMessage(err) || 'Failed to analyze voice message');
      setStep('idle');
    }
  }, []);

  const voice = useVoiceInput({
    uiLang: lang,
    disabled: step === 'analyzing' || applying,
    onResult: handleVoiceResult,
  });

  const analyzeTypedText = async (e) => {
    e?.preventDefault();
    const t = typedText.trim();
    if (!t || step === 'analyzing') return;
    setStep('analyzing');
    setErrorMsg('');
    try {
      const res = await post('/ai/analyze', { text: t });
      setAnalysis(res);
      setSelectedActions(res.actions || []);
      setStep('review');
    } catch (err) {
      setErrorMsg(formatErrorMessage(err) || 'Failed to analyze text');
      setStep('idle');
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
      const cleanedActions = sanitizeAiActions(selectedActions);
      const res = await post('/ai/apply', { actions: cleanedActions, notifyInChat: true });
      const items = Array.isArray(res?.items) ? res.items : [];
      setSavedSummary({
        hasRecipe: items.some((x) => x.type === 'recipe') || cleanedActions.some((a) => a.type?.includes('recipe')),
        hasGrocery: items.some((x) => x.type === 'grocery') || cleanedActions.some((a) => a.type?.includes('grocery')),
      });
      setStep('success');
      notifyChanged();
      reloadFamily().catch(() => {});
      if (onDone) onDone();
    } catch (err) {
      setErrorMsg(formatErrorMessage(err) || 'Failed to save items');
    } finally {
      setApplying(false);
    }
  };

  const formatSecs = (s) => {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r < 10 ? '0' : ''}${r}`;
  };

  const recipeActions = (analysis?.actions || []).filter((a) => a.type?.includes('recipe'));
  const groceryActions = (analysis?.actions || []).filter((a) => a.type?.includes('grocery'));
  const hasInlineSteps = Boolean(
    analysis?.summary &&
      parseAiReply(analysis.summary, { hasRecipeAction: recipeActions.length > 0 }).some((b) => b.type === 'steps')
  );

  const displayedError = errorMsg || voice.error;
  const voiceBadge = voice.voiceLocale === 'ml-IN' ? 'ML' : 'EN';

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

        {displayedError ? (
          <div role="alert" style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', borderRadius: 8, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert" size={16} />
            <span className="grow">{displayedError}</span>
          </div>
        ) : null}

        {step === 'idle' && !voice.isRecording ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <button
              type="button"
              className="ai-modal-pulse"
              onClick={() => voice.start()}
              aria-label={lang === 'ml' ? 'സംസാരിക്കാൻ ഇവിടെ അമർത്തുക' : 'Tap to speak'}
            >
              <Icon name="mic" size={32} />
            </button>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>
              {lang === 'ml' ? 'സംസാരിക്കാൻ ഇവിടെ അമർത്തുക' : 'Tap to speak'}
            </div>
            <div className="muted small" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>{lang === 'ml' ? 'ഭാഷ:' : 'Voice:'}</span>
              <button
                type="button"
                className="voice-lang-pill"
                onClick={voice.toggleVoiceLocale}
                aria-label={
                  voiceBadge === 'ML'
                    ? 'Speech language: Malayalam. Switch to English'
                    : 'Speech language: English. Switch to Malayalam'
                }
              >
                {voiceBadge === 'ML' ? 'മലയാളം (ML)' : 'English (EN)'}
              </button>
            </div>

            <div style={{ margin: '20px 0 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              <span className="muted small">{lang === 'ml' ? 'അല്ലെങ്കിൽ എഴുതുക' : 'or type below'}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            </div>

            <form onSubmit={analyzeTypedText} style={{ display: 'flex', gap: 8 }}>
              <label htmlFor={inputId} className="visually-hidden">
                {lang === 'ml' ? 'സന്ദേശം ടൈപ്പ് ചെയ്യുക' : 'Type your request'}
              </label>
              <input
                id={inputId}
                className="input"
                style={{ flex: 1 }}
                placeholder={lang === 'ml' ? 'ഉദാ: ബിരിയാണി ഉണ്ടാക്കണം, സാധനങ്ങൾ ചേർക്കൂ...' : 'e.g. Suggest biryani recipe and groceries...'}
                value={typedText}
                onChange={(e) => setTypedText(e.target.value)}
                autoComplete="off"
              />
              <Btn type="submit" disabled={!typedText.trim()}>
                {lang === 'ml' ? 'പരിശോധിക്കുക' : 'Check'}
              </Btn>
            </form>
          </div>
        ) : null}

        {voice.isRecording ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <button
              type="button"
              className="ai-modal-pulse recording"
              onClick={() => voice.stop('send')}
              aria-label={lang === 'ml' ? 'നിർത്തി പ്രോസസ്സ് ചെയ്യുക' : 'Stop and process recording'}
            >
              <span style={{ width: 20, height: 20, background: '#FFFFFF', borderRadius: 4 }} />
            </button>
            <div style={{ fontWeight: 700, fontSize: 18, color: '#DC2626', marginTop: 8 }}>
              {formatSecs(voice.seconds)} / 0:30
            </div>
            {voice.liveTranscript ? (
              <div className="ai-transcription-box" style={{ marginTop: 10, textAlign: 'left' }}>
                “{voice.liveTranscript}”
              </div>
            ) : (
              <div className="muted small" style={{ marginTop: 4 }}>
                {lang === 'ml' ? `കേൾക്കുന്നു (${voiceBadge})... പറഞ്ഞ് കഴിഞ്ഞ് മുകളിൽ അമർത്തുക` : `Listening (${voiceBadge})... Tap above when finished speaking`}
              </div>
            )}
            <div style={{ marginTop: 14, display: 'inline-flex', gap: 8 }}>
              <Btn tone="ghost" size="sm" onClick={voice.cancel}>
                {lang === 'ml' ? 'റദ്ദാക്കുക' : 'Cancel'}
              </Btn>
              {voice.mode === 'speech' && voice.liveTranscript ? (
                <Btn tone="ghost" size="sm" onClick={() => voice.stop('edit')}>
                  {lang === 'ml' ? 'തിരുത്തുക' : 'Edit text'}
                </Btn>
              ) : null}
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
              <div className="ai-reply-card">
                <AiReplyBody
                  text={analysis.summary}
                  lang={lang}
                  hasRecipeAction={recipeActions.length > 0}
                  missingNames={groceryActions.map((g) => g.title)}
                />
              </div>
            ) : null}

            <div>
              {analysis.actions && analysis.actions.length > 0 ? (
                <AiActionsList
                  actions={analysis.actions}
                  selected={selectedActions}
                  onToggle={toggleAction}
                  onApply={applyActions}
                  applying={applying}
                  applied={false}
                  lang={lang}
                  hasInlineSteps={hasInlineSteps}
                  onNavigate={onClose}
                  secondaryAction={
                    <Btn tone="ghost" onClick={() => setStep('idle')}>
                      {lang === 'ml' ? 'വീണ്ടും പറയാം' : 'Try again'}
                    </Btn>
                  }
                />
              ) : (
                <div className="col" style={{ gap: 10 }}>
                  <div className="muted small" style={{ padding: '4px 0' }}>
                    {lang === 'ml' ? 'പ്രത്യേക ടാസ്കുകൾ ഒന്നും കണ്ടെത്തിയില്ല.' : 'No specific tasks or items found.'}
                  </div>
                  <Btn tone="ghost" onClick={() => setStep('idle')}>
                    {lang === 'ml' ? 'വീണ്ടും പറയാം' : 'Try again'}
                  </Btn>
                </div>
              )}
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
              {savedSummary.hasRecipe
                ? lang === 'ml'
                  ? 'പാചകക്കുറിപ്പും ലിസ്റ്റുകളും കുടുംബത്തിനായി സേവ് ചെയ്തു.'
                  : 'Saved to your family Recipes & lists.'
                : lang === 'ml'
                ? 'കുടുംബാംഗങ്ങൾക്കെല്ലാം കാണാവുന്നതാണ്.'
                : 'All items are now added to your family lists.'}
            </div>
            <div className="row" style={{ gap: 10 }}>
              {savedSummary.hasRecipe || savedSummary.hasGrocery ? (
                <Btn
                  tone="ghost"
                  className="grow"
                  onClick={() => {
                    onClose();
                    router.push(savedSummary.hasRecipe ? '/planner?tab=recipes' : '/planner?tab=grocery');
                  }}
                >
                  {savedSummary.hasRecipe
                    ? lang === 'ml' ? 'പാചകക്കുറിപ്പ് കാണുക' : 'View Recipes'
                    : lang === 'ml' ? 'ലിസ്റ്റ് കാണുക' : 'View Grocery'}
                </Btn>
              ) : null}
              <Btn onClick={onClose} className="grow">
                {lang === 'ml' ? 'ശരി' : 'Done'}
              </Btn>
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
