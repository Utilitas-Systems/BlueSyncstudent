import { useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { supabase } from '@/integrations/supabase/client';

// Overloads to support legacy positional args and new object-based API
export function useBroadcastAudio(classId?: string, enabled?: boolean): number;
export function useBroadcastAudio(params: { studentId: string; classId: string; enabled?: boolean }): { audioLevel: number; isListening: boolean };
export function useBroadcastAudio(
  arg1?: string | { studentId: string; classId: string; enabled?: boolean },
  arg2: boolean = true
) {
  const isObjectParams = typeof arg1 === 'object' && arg1 !== null;
  const classId = isObjectParams ? (arg1 as any).classId : (arg1 as string | undefined);
  const studentId = isObjectParams ? (arg1 as any).studentId : undefined;
  const enabled = isObjectParams ? !!(arg1 as any).enabled : arg2;

  const [level, setLevel] = useState(0);
  const checkIntervalRef = useRef<number | null>(null);
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastIsTalkingRef = useRef<boolean | null>(null);
  const lastBroadcastTimeRef = useRef<number>(0);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (checkIntervalRef.current) { window.clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }
      if (chanRef.current) { try { chanRef.current.unsubscribe(); } catch {} chanRef.current = null; }
      setLevel(0);
      lastIsTalkingRef.current = null;
      subscribedRef.current = false;
      return;
    }

    subscribedRef.current = false;
    if (classId) {
      const channel = supabase.channel(`class_${classId}_audio`, { config: { broadcast: { self: true } } });
      chanRef.current = channel;
      channel.on('broadcast', { event: 'audio_level' }, () => {});
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') subscribedRef.current = true;
      });
    }

    const sendPayload = async (audioLevel: number, isTalking: boolean) => {
      if (!chanRef.current || !classId || !subscribedRef.current) return;
      const timestamp = new Date().toISOString();
      try {
        await chanRef.current.send({
          type: 'broadcast',
          event: 'audio_level',
          payload: {
            student_id: studentId,
            audio_level: audioLevel,
            is_talking: isTalking,
            timestamp
          }
        });
        lastBroadcastTimeRef.current = Date.now();
      } catch (e) {
        console.error('[useBroadcastAudio] Error broadcasting:', e);
      }
    };

    checkIntervalRef.current = window.setInterval(async () => {
      try {
        const peak = await invoke<number>('get_system_audio_peak');
        const rawPct = (Number(peak) || 0) * 100;
        const boosted = Math.min(100, rawPct * 3.5);
        const pct = Math.max(0, Math.round(boosted));
        setLevel(pct);

        const isTalking = pct > 20; // talking threshold
        const now = Date.now();
    const timeSinceLastBroadcast = now - lastBroadcastTimeRef.current;
    const stateChanged = lastIsTalkingRef.current !== null && lastIsTalkingRef.current !== isTalking;
    const heartbeatDue = timeSinceLastBroadcast >= 30 * 1000; // 30s heartbeat

        const shouldBroadcast = stateChanged || heartbeatDue;
        if (shouldBroadcast) {
          await sendPayload(pct, isTalking);
          lastIsTalkingRef.current = isTalking;
        } else if (lastIsTalkingRef.current === null) {
          lastIsTalkingRef.current = isTalking;
          await sendPayload(pct, isTalking);
        }
      } catch (error) {
        console.error('[useBroadcastAudio] Error getting audio peak:', error);
        setLevel(0);
      }
    }, 2 * 1000); // Check audio every 2 seconds

    return () => {
      if (checkIntervalRef.current) { window.clearInterval(checkIntervalRef.current); checkIntervalRef.current = null; }
      // Send final zero audio before cleanup (per transmission guide)
      if (chanRef.current && classId && studentId) {
        chanRef.current.send({
          type: 'broadcast',
          event: 'audio_level',
          payload: {
            student_id: studentId,
            audio_level: 0,
            is_talking: false,
            timestamp: new Date().toISOString()
          }
        }).catch(() => {});
      }
      if (chanRef.current) { try { chanRef.current.unsubscribe(); } catch {} chanRef.current = null; }
    };
  }, [classId, enabled, studentId]);

  const result = useMemo(() => {
    if (isObjectParams) {
      return { audioLevel: level, isListening: !!classId && !!enabled };
    }
    return level;
  }, [isObjectParams, level, classId, enabled]);

  return result as any;
}
