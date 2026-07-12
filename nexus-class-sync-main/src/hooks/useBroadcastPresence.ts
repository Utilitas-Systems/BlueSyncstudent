import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveRealtimeChannel } from '@/lib/realtimeChannel';

type PresenceStudent = { id: string; username?: string; full_name?: string };

// ponytail: one presence session survives Dashboard ↔ Settings navigation; stop only on logout/close
const shared = {
  sessionKey: '',
  channels: [] as ReturnType<typeof supabase.channel>[],
  hb: null as number | null,
  listeners: new Set<(online: boolean) => void>(),
};

function presenceKey(classId: string, studentId: string) {
  return `${classId}:${studentId}`;
}

function notifyPresenceListeners(online: boolean) {
  shared.listeners.forEach((fn) => fn(online));
}

async function resolveClassPresenceChannelNames(classId: string): Promise<string[]> {
  const names = new Set<string>();
  // Teacher portal listens here — subscribe first
  names.add(`class_${classId}_presence`);
  try {
    const signed = await resolveRealtimeChannel('class_presence', classId);
    if (signed) names.add(signed);
  } catch (e) {
    console.warn('[presence] signed channel lookup failed', e);
  }
  return [...names];
}

function subscribePresenceChannel(
  channelName: string,
  studentId: string
): Promise<ReturnType<typeof supabase.channel>> {
  const channel = supabase.channel(channelName, {
    config: {
      presence: { key: studentId },
      broadcast: { self: true },
    },
  });
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`Presence subscribe timeout: ${channelName}`));
    }, 15000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(timeout);
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(timeout);
        reject(new Error(`Presence channel ${channelName}: ${status}`));
      }
    });
  });
}

export function stopStudentPresenceSession(): void {
  if (shared.hb) {
    window.clearInterval(shared.hb);
    shared.hb = null;
  }
  for (const channel of shared.channels) {
    try {
      channel.untrack();
    } catch {}
    try {
      channel.unsubscribe();
    } catch {}
  }
  shared.channels = [];
  shared.sessionKey = '';
  notifyPresenceListeners(false);
}

async function startSharedPresence(
  classId: string,
  studentId: string,
  username: string,
  full_name: string
): Promise<void> {
  const key = presenceKey(classId, studentId);
  if (shared.sessionKey === key && shared.channels.length > 0) {
    notifyPresenceListeners(true);
    return;
  }

  stopStudentPresenceSession();
  shared.sessionKey = key;

  const channelNames = await resolveClassPresenceChannelNames(classId);
  const channels: ReturnType<typeof supabase.channel>[] = [];
  for (const channelName of channelNames) {
    try {
      channels.push(await subscribePresenceChannel(channelName, studentId));
      console.log('[Student] presence subscribed', channelName);
    } catch (e) {
      console.error('[Student] presence subscribe failed', channelName, e);
    }
  }
  if (channels.length === 0) {
    shared.sessionKey = '';
    return;
  }
  shared.channels = channels;

  const trackAll = async () => {
    const now = new Date().toISOString();
    const presenceData = {
      student_id: studentId,
      username,
      full_name,
      online_at: now,
      last_heartbeat: now,
    };
    let ok = false;
    for (const channel of shared.channels) {
      try {
        await channel.track(presenceData);
        ok = true;
      } catch (e) {
        console.error('[Student] presence track error:', e);
      }
    }
    if (ok) notifyPresenceListeners(true);
  };

  await trackAll();

  shared.hb = window.setInterval(() => {
    void trackAll();
  }, 30 * 1000);
}

function isSharedPresenceActive(classId: string, studentId: string): boolean {
  return shared.sessionKey === presenceKey(classId, studentId) && shared.channels.length > 0;
}

// Overloads: legacy and new object-based API
export function useBroadcastPresence(classId?: string, studentId?: string): void;
export function useBroadcastPresence(params: {
  student: PresenceStudent;
  classId: string;
}): { isOnline: boolean; startPresence: () => void; stopPresence: () => void };
export function useBroadcastPresence(
  arg1?: string | { student: PresenceStudent; classId: string },
  arg2?: string
) {
  const isObjectParams = typeof arg1 === 'object' && arg1 !== null;
  const classId = isObjectParams ? (arg1 as { classId: string }).classId : (arg1 as string | undefined);
  const studentId = isObjectParams
    ? (arg1 as { student: PresenceStudent }).student?.id
    : (arg2 as string | undefined);
  const username = isObjectParams
    ? (arg1 as { student: PresenceStudent }).student?.username ?? ''
    : '';
  const full_name = isObjectParams
    ? (arg1 as { student: PresenceStudent }).student?.full_name ?? ''
    : '';
  const [online, setOnline] = useState(() =>
    !!(classId && studentId && isSharedPresenceActive(classId, studentId))
  );

  useEffect(() => {
    if (!isObjectParams || !classId || !studentId) return;
    const listener = (v: boolean) => setOnline(v);
    shared.listeners.add(listener);
    if (isSharedPresenceActive(classId, studentId)) setOnline(true);
    return () => {
      shared.listeners.delete(listener);
    };
  }, [isObjectParams, classId, studentId]);

  const startPresence = useCallback(() => {
    if (!classId || !studentId) return;
    void startSharedPresence(classId, studentId, username, full_name);
  }, [classId, studentId, username, full_name]);

  const stopPresence = useCallback(() => {
    stopStudentPresenceSession();
    setOnline(false);
  }, []);

  useEffect(() => {
    if (!isObjectParams && classId && studentId) {
      void startSharedPresence(classId, studentId, '', '');
      return () => stopStudentPresenceSession();
    }
  }, [isObjectParams, classId, studentId]);

  if (isObjectParams) {
    return useMemo(
      () => ({ isOnline: online, startPresence, stopPresence }),
      [online, startPresence, stopPresence]
    ) as { isOnline: boolean; startPresence: () => void; stopPresence: () => void };
  }
}
