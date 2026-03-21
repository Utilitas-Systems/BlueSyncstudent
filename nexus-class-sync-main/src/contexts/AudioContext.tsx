import { createContext, useContext, useState, ReactNode } from 'react';
import { useBroadcastAudio } from '@/hooks/useBroadcastAudio';

interface AudioContextType {
  audioLevel: number;
  isListening: boolean;
  analyser: AnalyserNode | null;
  lastBroadcastTime: string | null;
}

const AudioContext = createContext<AudioContextType>({
  audioLevel: 0,
  isListening: false,
  analyser: null,
  lastBroadcastTime: null,
});

export const useAudioContext = () => useContext(AudioContext);

interface AudioProviderProps {
  children: ReactNode;
  studentId: string | null;
  classId: string | null;
  enabled: boolean;
}

export const AudioProvider = ({ children, studentId, classId, enabled }: AudioProviderProps) => {
  const { audioLevel, isListening, analyser, lastBroadcastTime } = useBroadcastAudio({
    studentId: studentId || '',
    classId: classId || '',
    enabled: enabled && !!classId && !!studentId,
    updateInterval: 8000
  });

  return (
    <AudioContext.Provider value={{ audioLevel, isListening, analyser, lastBroadcastTime }}>
      {children}
    </AudioContext.Provider>
  );
};


