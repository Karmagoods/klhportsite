// tts.js
// Browser TTS (free) + Optional Google Cloud TTS (via Firebase backend)

let voices = [];
let currentUtterance = null;
let voicesLoaded = false;

// ---- CONFIG ----
const CLOUD_TTS_ENDPOINT =
  'https://us-central1-klhinnovation-6eac7.cloudfunctions.net/runGoogleTTS';

// Soft safety limit to protect quota
const CLOUD_CHAR_LIMIT = 500;

// ----------------
// Voice Loading
// ----------------
function loadVoices() {
  voices = window.speechSynthesis.getVoices() || [];
  voicesLoaded = voices.length > 0;
}

if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

// ----------------
// Utils
// ----------------
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function findVoice({ voiceName, lang }) {
  if (!voices.length) return null;

  if (voiceName) {
    const exact = voices.find(v => v.name === voiceName);
    if (exact) return exact;

    const partial = voices.find(v =>
      v.name.toLowerCase().includes(voiceName.toLowerCase())
    );
    if (partial) return partial;
  }

  if (lang) {
    const exactLang = voices.find(v => v.lang === lang);
    if (exactLang) return exactLang;

    const partialLang = voices.find(v =>
      v.lang?.toLowerCase().startsWith(lang.toLowerCase())
    );
    if (partialLang) return partialLang;
  }

  return voices[0] || null;
}

// ----------------
// Browser TTS (FREE)
// ----------------
export function speak(text, options = {}) {
  if (!('speechSynthesis' in window)) {
    console.error('Text-to-Speech not supported in this browser.');
    return;
  }

  if (!text?.trim()) return;

  stop();

  currentUtterance = new SpeechSynthesisUtterance(text);

  currentUtterance.rate = clamp(options.rate ?? 1, 0.5, 2);
  currentUtterance.pitch = clamp(options.pitch ?? 1, 0, 2);
  currentUtterance.volume = clamp(options.volume ?? 1, 0, 1);

  if (options.lang) {
    currentUtterance.lang = options.lang;
  }

  const voice = findVoice(options);
  if (voice) currentUtterance.voice = voice;

  if (typeof options.onStart === 'function') currentUtterance.onstart = options.onStart;
  if (typeof options.onEnd === 'function') currentUtterance.onend = options.onEnd;
  if (typeof options.onError === 'function') currentUtterance.onerror = options.onError;

  speechSynthesis.speak(currentUtterance);
}

// ----------------
// Cloud TTS (LIMITED)
// ----------------
export async function speakCloud(
  text,
  {
    voice = 'en-US-Neural2-D',
    rate = 1,
    pitch = 0,
    onStart,
    onEnd,
    onError,
    fallbackToBrowser = true,
  } = {}
) {
  if (!text?.trim()) return;

  // Automatically fallback to browser if over quota
  if (text.length > CLOUD_CHAR_LIMIT) {
    console.warn('Cloud TTS limit exceeded, using browser TTS instead.');
    if (fallbackToBrowser) speak(text, { rate, pitch, onStart, onEnd, onError });
    return;
  }

  try {
    onStart?.();

    const res = await fetch(CLOUD_TTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, speakingRate: rate, pitch }),
    });

    if (!res.ok) throw new Error('Cloud TTS request failed');

    const { audioBase64 } = await res.json();

    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audio.play();
    audio.onended = () => onEnd?.();
  } catch (err) {
    console.error('Cloud TTS error:', err);
    onError?.(err);
    if (fallbackToBrowser) speak(text, { rate, pitch, onStart, onEnd, onError });
  }
}

// ----------------
// Controls
// ----------------
export function stop() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function pause() {
  if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.pause();
}

export function resume() {
  if ('speechSynthesis' in window && speechSynthesis.paused) speechSynthesis.resume();
}

export function isSpeaking() {
  return 'speechSynthesis' in window && speechSynthesis.speaking;
}

// ----------------
// Voice Helpers
// ----------------
export function getVoices() {
  return voices;
}

export function waitForVoices() {
  return new Promise(resolve => {
    if (voicesLoaded) return resolve(voices);
    const interval = setInterval(() => {
      if (voices.length) {
        clearInterval(interval);
        voicesLoaded = true;
        resolve(voices);
      }
    }, 50);
  });
}

export function getStyleSettings(style) {
  switch (style) {
    case 'calm':
      return { rate: 0.9, pitch: 0.9 };
    case 'excited':
      return { rate: 1.2, pitch: 1.3 };
    case 'deep':
      return { rate: 0.95, pitch: 0.7 };
    default:
      return { rate: 1, pitch: 1 };
  }
}

export function getCurrentUtterance() {
  return currentUtterance;
}

// ----------------
// Auto speak helper
// ----------------
export async function speakAuto(text, options = {}) {
  if (text.length <= CLOUD_CHAR_LIMIT) {
    await speakCloud(text, options);
  } else {
    speak(text, options);
  }
}
