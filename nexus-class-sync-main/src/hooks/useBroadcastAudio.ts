import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { supabase } from '@/integrations/supabase/client';

const MAC_SESSION_ZERO_HINT = 'bluesync-mac-audio-zero-hint-v1';

const MAC_HELP_FOOTER = `

To share system audio levels with your teacher (videos, browser, apps):

1. Open System Settings → Privacy & Security → Screen Recording.
2. Turn ON BlueSync Student.
3. Quit and reopen BlueSync if macOS asks you to.

Apple requires Screen Recording permission for system audio metering. The app does not save screen recordings—it only reads audio levels, similar to the Windows version.`;

const MAC_ZERO_ONLY_HELP = `We have not detected system audio for a little while.

• Confirm Screen Recording is ON for BlueSync (System Settings → Privacy & Security → Screen Recording).
• Play sound from a video or music while this class session is active—levels measure what plays through the Mac, not a microphone.
• Restart the app after changing permissions.`;

type PeakDetails = {
  peak: number;
  isMacos?: boolean;
  macosMeterError?: string | null;
};

type BroadcastAudioObjectParams = {
  studentId: string;
  classId: string;
  enabled?: boolean;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveClassId(inputClassId?: string): string | null {
  const fromArg = (inputClassId || '').trim();
  if (UUID_RE.test(fromArg)) return fromArg;
  try {
    const explicit = (sessionStorage.getItem('current_class_id') || '').trim();
    if (UUID_RE.test(explicit)) return explicit;
  } catch {
    // ignore
  }
  try {
    const raw = sessionStorage.getItem('student_class');
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string };
      const id = (parsed?.id || '').trim();
      if (UUID_RE.test(id)) return id;
    }
  } catch {
    // ignore
  }
  return null;
}

function isBroadcastAudioObjectParams(
  arg: unknown
): arg is BroadcastAudioObjectParams {
  if (typeof arg !== 'object' || arg === null) return false;
  const o = arg as Record<string, unknown>;
  return typeof o.studentId === 'string' && typeof o.classId === 'string';
}

export type BroadcastAudioObjectResult = {
  audioLevel: number;
  isListening: boolean;
  macAudioHelpOpen: boolean;
  macAudioHelpTitle: string;
  macAudioHelpMessage: string;
  closeMacAudioHelp: () => void;
};

// Overloads to support legacy positional args and new object-based API
export function useBroadcastAudio(classId?: string, enabled?: boolean): number;
export function useBroadcastAudio(
  params: BroadcastAudioObjectParams
): BroadcastAudioObjectResult;
export function useBroadcastAudio(
  arg1?: string | BroadcastAudioObjectParams,
  arg2: boolean = true
): number | BroadcastAudioObjectResult {
  const isObjectParams = isBroadcastAudioObjectParams(arg1);
  const classId = isObjectParams ? arg1.classId : arg1;
  const studentId = isObjectParams ? arg1.studentId : undefined;
  const enabled = isObjectParams ? !!arg1.enabled : arg2;

  const [level, setLevel] = useState(0);
  const [macHelpOpen, setMacHelpOpen] = useState(false);
  const [macHelpTitle, setMacHelpTitle] = useState('');
  const [macHelpMessage, setMacHelpMessage] = useState('');
  const checkIntervalRef = useRef<number | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastIsTalkingRef = useRef<boolean | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const subscribedRef = useRef(false);
  const lastLoggedStateRef = useRef<boolean | null>(null);
  const lastMeterErrorShownRef = useRef<string | null>(null);
  const macSilentStreakRef = useRef(0);

  const showMacHelp = useCallback((title: string, message: string) => {
    setMacHelpTitle(title);
    setMacHelpMessage(message);
    setMacHelpOpen(true);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) {
        window.clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (chanRef.current) {
        try {
          chanRef.current.unsubscribe();
        } catch {
          /* ignore */
        }
        chanRef.current = null;
      }
      setLevel(0);
      lastIsTalkingRef.current = null;
      subscribedRef.current = false;
      macSilentStreakRef.current = 0;
      return;
    }

    const effectiveClassId = resolveClassId(classId);
    subscribedRef.current = false;
    if (effectiveClassId) {
      const channelName = `class_${effectiveClassId}_audio`;
      const channel = supabase.channel(channelName, { config: { broadcast: { self: true } } });
      chanRef.current = channel;
      channel.on('broadcast', { event: 'audio_level' }, () => {});
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          subscribedRef.current = true;
          console.log('[useBroadcastAudio] Subscribed', {
            channel: channelName,
            classId: effectiveClassId,
            studentId
          });
        } else {
          console.log('[useBroadcastAudio] Channel status', {
            channel: channelName,
            status,
            classId: effectiveClassId,
            studentId
          });
        }
      });
    } else {
      console.warn('[useBroadcastAudio] No valid classId found for audio broadcast', {
        classIdFromHook: classId,
        studentId
      });
    }

    const sendPayload = async (audioLevel: number, isTalking: boolean) => {
      const effectiveClassId = resolveClassId(classId);
      if (!chanRef.current || !effectiveClassId || !subscribedRef.current) {
        console.warn('[useBroadcastAudio] Skip send; channel not ready', {
          hasChannel: !!chanRef.current,
          subscribed: subscribedRef.current,
          classId: effectiveClassId,
          studentId,
          isTalking
        });
        return;
      }
      const timestamp = new Date().toISOString();
      try {
        await chanRef.current.send({
          type: 'broadcast',
          event: 'audio_level',
          payload: {
            student_id: studentId,
            audio_level: audioLevel,
            is_talking: isTalking,
            timestamp,
          },
        });
        lastBroadcastTimeRef.current = Date.now();
        console.log('[useBroadcastAudio] Sent audio_level', {
          classId: effectiveClassId,
          studentId,
          isTalking,
          audioLevel,
          reason: lastIsTalkingRef.current === null ? 'initial' : (lastIsTalkingRef.current !== isTalking ? 'state-change' : 'heartbeat')
        });
      } catch (e) {
        console.error('[useBroadcastAudio] Error broadcasting:', e);
      }
    };

    checkIntervalRef.current = window.setInterval(async () => {
      try {
        let isPlaying = false;
        let levelValue = 0;
        let details: PeakDetails | undefined;
        try {
          isPlaying = await invoke<boolean>('check_audio_playback');
          levelValue = isPlaying ? 50 : 0;
        } catch {
          // Fallback for older builds that do not expose `check_audio_playback`.
          try {
            const d = await invoke<PeakDetails>('get_system_audio_peak_detailed');
            details = d;
            isPlaying = (Number(d.peak) || 0) >= 0.01;
            levelValue = isPlaying ? 50 : 0;
          } catch {
            const peak = await invoke<number>('get_system_audio_peak');
            isPlaying = (Number(peak) || 0) >= 0.01;
            levelValue = isPlaying ? 50 : 0;
          }
        }

        // Fetch details only for macOS setup diagnostics if not already retrieved above.
        try {
          if (!details) {
            details = await invoke<PeakDetails>('get_system_audio_peak_detailed');
          }
        } catch {
          // Non-fatal; diagnostics are optional.
        }

        setLevel(levelValue);
        if (lastLoggedStateRef.current !== isPlaying) {
          lastLoggedStateRef.current = isPlaying;
          console.log('[useBroadcastAudio] Playback state changed', {
            classId: resolveClassId(classId),
            studentId,
            isPlaying,
            levelValue
          });
        }

        if (details?.isMacos && details.macosMeterError) {
          const err = String(details.macosMeterError);
          if (err !== lastMeterErrorShownRef.current) {
            lastMeterErrorShownRef.current = err;
            showMacHelp('System audio is not available', `${err}${MAC_HELP_FOOTER}`);
          }
          macSilentStreakRef.current = 0;
        } else {
          if (details?.isMacos) {
            lastMeterErrorShownRef.current = null;
          }
          if (details?.isMacos && !isPlaying) {
            macSilentStreakRef.current += 1;
            if (
              macSilentStreakRef.current >= 6 &&
              typeof sessionStorage !== 'undefined' &&
              !sessionStorage.getItem(MAC_SESSION_ZERO_HINT)
            ) {
              sessionStorage.setItem(MAC_SESSION_ZERO_HINT, '1');
              showMacHelp('No system audio detected', `${MAC_ZERO_ONLY_HELP}${MAC_HELP_FOOTER}`);
            }
          } else {
            macSilentStreakRef.current = 0;
          }
        }

        const isTalking = isPlaying;
        const now = Date.now();
        const timeSinceLastBroadcast = now - lastBroadcastTimeRef.current;
        const stateChanged = lastIsTalkingRef.current !== null && lastIsTalkingRef.current !== isTalking;
        const heartbeatDue = timeSinceLastBroadcast >= 30 * 1000;

        const shouldBroadcast = stateChanged || heartbeatDue;
        if (shouldBroadcast) {
          await sendPayload(levelValue, isTalking);
          lastIsTalkingRef.current = isTalking;
        } else if (lastIsTalkingRef.current === null) {
          lastIsTalkingRef.current = isTalking;
          await sendPayload(levelValue, isTalking);
        }
      } catch (error) {
        console.error('[useBroadcastAudio] Error getting audio peak:', error);
        setLevel(0);
        try {
          const d = await invoke<PeakDetails>('get_system_audio_peak_detailed');
          if (d.isMacos) {
            showMacHelp(
              'System audio is not available',
              `${String(error)}${MAC_HELP_FOOTER}`
            );
          }
        } catch {
          /* not tauri or command missing */
        }
      }
    }, 2 * 1000);

    return () => {
      if (checkIntervalRef.current) {
        window.clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (chanRef.current && classId && studentId) {
        chanRef.current
          .send({
            type: 'broadcast',
            event: 'audio_level',
            payload: {
              student_id: studentId,
              audio_level: 0,
              is_talking: false,
              timestamp: new Date().toISOString(),
            },
          })
          .catch(() => {});
      }
      if (chanRef.current) {
        try {
          console.log('[useBroadcastAudio] Unsubscribe audio channel', { classId, studentId });
          chanRef.current.unsubscribe();
        } catch {
          /* ignore */
        }
        chanRef.current = null;
      }
    };
  }, [classId, enabled, studentId, showMacHelp]);

  const result = useMemo(() => {
    if (isObjectParams) {
      return {
        audioLevel: level,
        isListening: !!classId && !!enabled,
        macAudioHelpOpen: macHelpOpen,
        macAudioHelpTitle: macHelpTitle,
        macAudioHelpMessage: macHelpMessage,
        closeMacAudioHelp: () => setMacHelpOpen(false),
      };
    }
    return level;
  }, [isObjectParams, level, classId, enabled, macHelpOpen, macHelpTitle, macHelpMessage]);

  return result;
}
