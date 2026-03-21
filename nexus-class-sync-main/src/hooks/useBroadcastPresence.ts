import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PresenceStudent = { id: string; username?: string; full_name?: string };

// Overloads: legacy and new object-based API
export function useBroadcastPresence(classId?: string, studentId?: string): void;
export function useBroadcastPresence(params: { student: PresenceStudent; classId: string }): { isOnline: boolean; startPresence: () => void; stopPresence: () => void };
export function useBroadcastPresence(
  arg1?: string | { student: PresenceStudent; classId: string },
  arg2?: string
) {
  const isObjectParams = typeof arg1 === 'object' && arg1 !== null;
  const classId = isObjectParams ? (arg1 as any).classId : (arg1 as string | undefined);
  const studentId = isObjectParams ? (arg1 as any).student?.id : (arg2 as string | undefined);
  const username = isObjectParams ? (arg1 as any).student?.username : undefined;
  const full_name = isObjectParams ? (arg1 as any).student?.full_name : undefined;
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const hbRef = useRef<number | null>(null);
  const [online, setOnline] = useState(false);

  const ensureChannel = useCallback(() => {
    if (!classId || !studentId) return null;
    if (chanRef.current) return chanRef.current;
    const channel = supabase.channel(`class_${classId}_presence`, {
      config: {
        presence: { key: studentId },
        broadcast: { self: true }
      }
    });
    chanRef.current = channel;
    // Student: subscribe and call .track() only — NO presence event listeners (sync, join, leave)
    return channel;
  }, [classId, studentId]);

  const startPresence = useCallback(() => {
    const channel = ensureChannel();
    if (!channel) return;
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const now = new Date().toISOString();
        const presenceData = {
          student_id: studentId,
          username: username ?? '',
          full_name: full_name ?? '',
          online_at: now,
          last_heartbeat: now
        };
        try {
          await channel.track(presenceData);
          setOnline(true);
        } catch (e) {
          console.error('[Student] presence track error:', e);
        }
      }
    });
    if (hbRef.current) window.clearInterval(hbRef.current);
    hbRef.current = window.setInterval(async () => {
      const now = new Date().toISOString();
      const presenceData = {
        student_id: studentId,
        username: username ?? '',
        full_name: full_name ?? '',
        online_at: now,
        last_heartbeat: now
      };
      try {
        await channel.track(presenceData);
        setOnline(true);
      } catch (e) {
        console.error('[Student] presence heartbeat error:', e);
      }
    }, 60 * 1000); // 60 second heartbeat
  }, [ensureChannel, studentId, username, full_name]);

  const stopPresence = useCallback(() => {
    if (hbRef.current) { window.clearInterval(hbRef.current); hbRef.current = null; }
    try { chanRef.current?.untrack(); } catch {}
    try { chanRef.current?.unsubscribe(); } catch {}
    chanRef.current = null;
    setOnline(false);
  }, []);

  useEffect(() => {
    if (!isObjectParams && classId && studentId) {
      startPresence();
      return () => stopPresence();
    }
  }, [isObjectParams, classId, studentId, startPresence, stopPresence]);

  if (isObjectParams) {
    return useMemo(() => ({ isOnline: online, startPresence, stopPresence }), [online, startPresence, stopPresence]) as any;
  }
}
