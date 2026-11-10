'use client';
import { useState, useRef, useEffect, useCallback } from 'react';

const MAX_SECONDS = 30;
const STT_BLOCKED_KEY = 'hommi_stt_blocked';

const LANG_TO_LOCALE = {
  ml: 'ml-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  en: 'en-IN',
};

export function localeForUiLang(lang) {
  return LANG_TO_LOCALE[lang] || 'en-IN';
}

function getSpeechCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isLiveSpeechBlocked() {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(STT_BLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

function markLiveSpeechBlocked() {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(STT_BLOCKED_KEY, '1');
  } catch {}
}

function pickSupportedAudioMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

function createAudioRecorder(stream, mimeType) {
  if (mimeType) {
    try {
      return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24_000 });
    } catch {
      try {
        return new MediaRecorder(stream, { mimeType });
      } catch {}
    }
  }
  return new MediaRecorder(stream);
}

/**
 * Unified hybrid voice input hook:
 * 1) Uses live browser SpeechRecognition when available (zero audio upload latency).
 * 2) Automatically falls back to compressed mono MediaRecorder -> direct API audio upload
 *    on browsers without Web Speech support or where speech servers are blocked (e.g. Brave, Firefox).
 */
export function useVoiceInput({ uiLang = 'en', onResult, disabled = false } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [mode, setMode] = useState('audio'); // 'speech' | 'audio'
  const [seconds, setSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceLocale, setVoiceLocale] = useState(() => localeForUiLang(uiLang));
  const [error, setError] = useState('');

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const uiLangRef = useRef(uiLang);
  uiLangRef.current = uiLang;

  const voiceLocaleRef = useRef(voiceLocale);
  voiceLocaleRef.current = voiceLocale;

  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');
  const activeModeRef = useRef('audio');
  const deliverActionRef = useRef('send'); // 'send' | 'edit'

  // Sync default speech locale if user changes UI language before recording
  useEffect(() => {
    setVoiceLocale((prev) => {
      const target = localeForUiLang(uiLang);
      if (prev === 'en-IN' || prev === 'ml-IN' || prev === 'hi-IN' || prev === 'ta-IN') {
        return target;
      }
      return prev;
    });
  }, [uiLang]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const cleanupAll = useCallback(() => {
    clearTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.onresult = null; recognitionRef.current.onerror = null; recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    stopTracks();
  }, [clearTimer, stopTracks]);

  useEffect(() => cleanupAll, [cleanupAll]);

  const emitTooShortError = useCallback(() => {
    const l = uiLangRef.current;
    setError(l === 'ml' ? 'കുറച്ചുകൂടി വ്യക്തമായി സംസാരിക്കൂ.' : 'Please speak a little longer.');
  }, []);

  const startTimer = useCallback((onMaxReached) => {
    clearTimer();
    startedAtRef.current = Date.now();
    setSeconds(0);
    timerRef.current = setInterval(() => {
      const elapsed = Math.min(MAX_SECONDS, Math.floor((Date.now() - startedAtRef.current) / 1000));
      setSeconds(elapsed);
      if (elapsed >= MAX_SECONDS) {
        clearTimer();
        onMaxReached();
      }
    }, 250);
  }, [clearTimer]);

  const stop = useCallback((action = 'send') => {
    clearTimer();
    deliverActionRef.current = action;
    cancelledRef.current = false;

    if (activeModeRef.current === 'speech') {
      const rec = recognitionRef.current;
      const combined = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
      if (rec) {
        try { rec.stop(); } catch {}
      } else {
        setIsRecording(false);
      }
      // If onend hasn't fired quickly or nothing captured, let onend finalize;
      // if no rec ref, emit directly if valid.
      if (!rec && combined) {
        onResultRef.current?.({ transcript: combined, speechLang: voiceLocaleRef.current, action });
      }
      return;
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setIsRecording(false);
      stopTracks();
      return;
    }
    try {
      recorder.stop();
    } catch {
      setIsRecording(false);
      stopTracks();
    }
  }, [clearTimer, stopTracks]);

  const startMediaRecorder = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const l = uiLangRef.current;
        setError(l === 'ml' ? 'ഈ ബ്രൗസറിൽ മൈക്രോഫോൺ സപ്പോർട്ട് ഇല്ല.' : 'Microphone is not supported in this browser.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;

      const mimeType = pickSupportedAudioMime();
      const recorder = createAudioRecorder(stream, mimeType);
      recorderRef.current = recorder;
      chunksRef.current = [];
      activeModeRef.current = 'audio';
      setMode('audio');
      setLiveTranscript('');
      setError('');
      cancelledRef.current = false;
      deliverActionRef.current = 'send';

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        clearTimer();
        stopTracks();
        setIsRecording(false);
        const durationMs = Date.now() - startedAtRef.current;
        const mime = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0].trim();
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        recorderRef.current = null;

        if (cancelledRef.current) return;
        if (durationMs < 350 || blob.size < 250) {
          emitTooShortError();
          return;
        }

        const ext = mime.includes('mp4') ? 'mp4' : mime.includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `hommi-voice-${Date.now()}.${ext}`, { type: mime });
        onResultRef.current?.({
          audioFile: file,
          speechLang: voiceLocaleRef.current,
          action: deliverActionRef.current,
        });
      };

      recorder.start(250);
      setIsRecording(true);
      startTimer(() => stop('send'));
    } catch {
      stopTracks();
      setIsRecording(false);
      const l = uiLangRef.current;
      setError(l === 'ml' ? 'മൈക്രോഫോൺ അനുമതി ലഭ്യമല്ല.' : 'Microphone access denied or unavailable.');
    }
  }, [clearTimer, emitTooShortError, startTimer, stop, stopTracks]);

  const start = useCallback(async ({ preferAudio = false } = {}) => {
    if (disabled || isRecording) return;
    setError('');
    cancelledRef.current = false;
    finalTranscriptRef.current = '';
    interimTranscriptRef.current = '';
    setLiveTranscript('');

    const SpeechCtor = getSpeechCtor();
    const canTrySpeech = Boolean(SpeechCtor) && !preferAudio && !isLiveSpeechBlocked();

    if (!canTrySpeech) {
      await startMediaRecorder();
      return;
    }

    try {
      const rec = new SpeechCtor();
      recognitionRef.current = rec;
      activeModeRef.current = 'speech';
      setMode('speech');
      rec.lang = voiceLocaleRef.current;
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      deliverActionRef.current = 'send';

      let gotAnyTranscript = false;
      let fellBackToAudio = false;

      rec.onresult = (event) => {
        let finals = '';
        let interims = '';
        for (let i = 0; i < event.results.length; i++) {
          const r = event.results[i];
          const txt = r[0]?.transcript || '';
          if (r.isFinal) finals += `${txt} `;
          else interims += `${txt} `;
        }
        finalTranscriptRef.current = finals.trim();
        interimTranscriptRef.current = interims.trim();
        const combined = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
        if (combined) gotAnyTranscript = true;
        setLiveTranscript(combined);
      };

      rec.onerror = (event) => {
        const code = event?.error || '';
        if (code === 'aborted' || cancelledRef.current) return;

        // Privacy browsers (e.g. Brave) expose webkitSpeechRecognition but block Google speech endpoints ('network' / 'service-not-allowed')
        if ((code === 'network' || code === 'service-not-allowed' || code === 'language-not-supported') && !gotAnyTranscript) {
          fellBackToAudio = true;
          markLiveSpeechBlocked();
          recognitionRef.current = null;
          clearTimer();
          try { rec.stop(); } catch {}
          startMediaRecorder();
          return;
        }

        if (code === 'not-allowed') {
          clearTimer();
          setIsRecording(false);
          recognitionRef.current = null;
          const l = uiLangRef.current;
          setError(l === 'ml' ? 'മൈക്രോഫോൺ അനുമതി ലഭ്യമല്ല.' : 'Microphone permission was denied.');
        }
      };

      rec.onend = () => {
        if (fellBackToAudio) return;
        clearTimer();
        recognitionRef.current = null;
        setIsRecording(false);
        if (cancelledRef.current) return;

        const transcript = `${finalTranscriptRef.current} ${interimTranscriptRef.current}`.trim();
        if (!transcript) {
          emitTooShortError();
          return;
        }
        onResultRef.current?.({
          transcript,
          speechLang: voiceLocaleRef.current,
          action: deliverActionRef.current,
        });
      };

      rec.start();
      setIsRecording(true);
      startTimer(() => stop('send'));
    } catch {
      markLiveSpeechBlocked();
      await startMediaRecorder();
    }
  }, [clearTimer, disabled, emitTooShortError, isRecording, startMediaRecorder, startTimer, stop]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setLiveTranscript('');
    setIsRecording(false);
    setSeconds(0);
    cleanupAll();
  }, [cleanupAll]);

  const toggleVoiceLocale = useCallback(() => {
    setVoiceLocale((prev) => (prev === 'ml-IN' ? 'en-IN' : 'ml-IN'));
  }, []);

  const clearError = useCallback(() => setError(''), []);

  return {
    isRecording,
    mode,
    seconds,
    maxSeconds: MAX_SECONDS,
    liveTranscript,
    voiceLocale,
    setVoiceLocale,
    toggleVoiceLocale,
    error,
    clearError,
    start,
    stop,
    cancel,
  };
}

