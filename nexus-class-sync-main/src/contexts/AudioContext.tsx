import { createContext, useContext, ReactNode } from 'react';
import { useBroadcastAudio } from '@/hooks/useBroadcastAudio';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const {
    audioLevel,
    isListening,
    macAudioHelpOpen,
    macAudioHelpTitle,
    macAudioHelpMessage,
    closeMacAudioHelp,
  } = useBroadcastAudio({
    studentId: studentId || '',
    classId: classId || '',
    enabled,
  });

  return (
    <>
      <AlertDialog
        open={macAudioHelpOpen}
        onOpenChange={(open) => {
          if (!open) closeMacAudioHelp();
        }}
      >
        <AlertDialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>{macAudioHelpTitle}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap text-left text-muted-foreground">
              {macAudioHelpMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction type="button" onClick={closeMacAudioHelp}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AudioContext.Provider
        value={{ audioLevel, isListening, analyser: null, lastBroadcastTime: null }}
      >
        {children}
      </AudioContext.Provider>
    </>
  );
};


