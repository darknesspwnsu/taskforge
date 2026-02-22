import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { isVoiceDictationSupported, startVoiceDictation } from '../lib/voiceDictation';

export function VoiceDictationButton({
  onTranscript,
  onError,
}: {
  onTranscript: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const sessionRef = useRef<{ stop: () => void } | null>(null);

  const supported = isVoiceDictationSupported();

  const toggle = () => {
    if (!supported) {
      onError?.('Voice dictation is currently available in supported web browsers.');
      return;
    }

    if (listening) {
      sessionRef.current?.stop();
      sessionRef.current = null;
      setListening(false);
      return;
    }

    sessionRef.current = startVoiceDictation({
      onTranscript,
      onError,
      onStart: () => setListening(true),
      onEnd: () => setListening(false),
    });
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.button, listening && styles.listening, !supported && styles.disabled]}>
      <FontAwesome name="microphone" size={14} color={listening ? '#fff' : colors.brandDark} />
      <Text style={[styles.label, listening && styles.listeningLabel]}>
        {listening ? 'Stop Voice' : 'Voice'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignSelf: 'flex-start',
    backgroundColor: '#ECFAF8',
  },
  disabled: {
    opacity: 0.45,
  },
  listening: {
    backgroundColor: colors.brand,
  },
  label: {
    color: colors.brandDark,
    fontSize: 12,
    fontWeight: '700',
  },
  listeningLabel: {
    color: '#fff',
  },
});
