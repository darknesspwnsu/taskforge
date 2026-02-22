import { Platform } from 'react-native';

type VoiceDictationOptions = {
  lang?: string;
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
};

type VoiceDictationSession = {
  stop: () => void;
};

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

type WebWindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
};

function getSpeechConstructor(): SpeechRecognitionConstructorLike | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return null;
  }

  const webWindow = window as WebWindowWithSpeech;
  return webWindow.SpeechRecognition ?? webWindow.webkitSpeechRecognition ?? null;
}

export function isVoiceDictationSupported(): boolean {
  return Boolean(getSpeechConstructor());
}

export function startVoiceDictation(options: VoiceDictationOptions): VoiceDictationSession | null {
  const Recognition = getSpeechConstructor();

  if (!Recognition) {
    options.onError?.('Voice dictation is not supported on this device/browser.');
    return null;
  }

  const recognition = new Recognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options.lang ?? 'en-US';

  recognition.onstart = () => {
    options.onStart?.();
  };

  recognition.onresult = (event) => {
    const chunks: string[] = [];

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const chunk = event.results[index]?.[0]?.transcript;
      if (chunk) {
        chunks.push(chunk);
      }
    }

    const transcript = chunks.join(' ').trim();
    if (transcript) {
      options.onTranscript(transcript);
    }
  };

  recognition.onerror = (event) => {
    options.onError?.(event.error ? `Voice dictation error: ${event.error}` : 'Voice dictation failed.');
  };

  recognition.onend = () => {
    options.onEnd?.();
  };

  recognition.start();

  return {
    stop: () => {
      recognition.stop();
    },
  };
}
