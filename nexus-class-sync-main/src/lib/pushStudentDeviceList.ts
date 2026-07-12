import { supabase } from '@/integrations/supabase/client';
import { resolveRealtimeChannel } from '@/lib/realtimeChannel';
import { upsertStudentDevices } from '@/lib/studentRpc';
import { getMockBluetoothDevices } from '@/lib/mockBluetoothDevices';

export type PushDevice = { name: string; type?: string; isConnected?: boolean };

export type NormalizedDevice = { name: string; type: string; isConnected: boolean };

type RealtimeChannel = ReturnType<typeof supabase.channel>;

type CachedChannels = {
  channels: RealtimeChannel[];
  ready: Promise<RealtimeChannel[]>;
};

const channelCache = new Map<string, CachedChannels>();

export function withMockDevices(real: PushDevice[]): PushDevice[] {
  const merged: PushDevice[] = [...real];
  const seen = new Set(merged.map((d) => (d.name || '').toLowerCase()));
  for (const mock of getMockBluetoothDevices()) {
    const key = mock.name.toLowerCase();
    if (!seen.has(key)) {
      merged.push({ name: mock.name, type: mock.type, isConnected: mock.isConnected });
      seen.add(key);
    }
  }
  return merged;
}

export function normalizeDeviceList(devices: PushDevice[]): NormalizedDevice[] {
  return (devices || []).map((d) => ({
    name: d.name,
    type: d.type || 'bluetooth',
    isConnected: typeof d.isConnected === 'boolean' ? d.isConnected : true,
  }));
}

function subscribeBroadcastChannel(name: string): Promise<RealtimeChannel> {
  const channel = supabase.channel(name, { config: { broadcast: { self: true } } });
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error(`Timed out subscribing to ${name}`));
    }, 15000);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        window.clearTimeout(timeout);
        resolve(channel);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(timeout);
        reject(new Error(`Channel ${name}: ${status}`));
      }
    });
  });
}

/** Drop cached realtime subscriptions (logout / class switch). */
export function invalidateDeviceChannels(classId?: string): void {
  const ids = classId ? [classId] : [...channelCache.keys()];
  for (const id of ids) {
    const entry = channelCache.get(id);
    if (!entry) continue;
    for (const ch of entry.channels) {
      try {
        supabase.removeChannel(ch);
      } catch {
        /* ignore */
      }
    }
    channelCache.delete(id);
  }
}

/** Teacher portal listens on legacy names; signed channel when available. */
export async function resolveClassDeviceChannelNames(classId: string): Promise<string[]> {
  const names = new Set<string>();
  names.add(`class_${classId}_devices`);
  try {
    const signed = await resolveRealtimeChannel('class_devices', classId);
    if (signed) names.add(signed);
  } catch (e) {
    console.warn('[devices] signed channel lookup failed', e);
  }
  return [...names];
}

async function ensureDeviceChannels(classId: string): Promise<RealtimeChannel[]> {
  const cached = channelCache.get(classId);
  if (cached) {
    return cached.ready;
  }

  const ready = (async () => {
    const names = await resolveClassDeviceChannelNames(classId);
    const channels: RealtimeChannel[] = [];
    for (const name of names) {
      try {
        channels.push(await subscribeBroadcastChannel(name));
        console.log('[devices] subscribed', name);
      } catch (e) {
        console.error('[devices] subscribe failed', name, e);
      }
    }
    if (channels.length === 0) {
      throw new Error('No device broadcast channels available');
    }
    const entry = channelCache.get(classId);
    if (entry) entry.channels = channels;
    return channels;
  })();

  channelCache.set(classId, { channels: [], ready });
  return ready;
}

export async function sendClassDeviceListBroadcast(
  studentId: string,
  classId: string,
  devices: NormalizedDevice[]
): Promise<void> {
  if (!studentId || !classId) {
    console.warn('[devices] skip broadcast — missing studentId or classId');
    return;
  }

  const payload = {
    student_id: studentId,
    devices,
    timestamp: new Date().toISOString(),
  };

  try {
    const channels = await ensureDeviceChannels(classId);
    for (const channel of channels) {
      const status = await channel.send({
        type: 'broadcast',
        event: 'device_list',
        payload,
      });
      if (status !== 'ok') {
        console.warn('[devices] broadcast send status', status);
      }
    }
  } catch (e) {
    console.error('[devices] realtime broadcast failed', e);
  }

  try {
    await upsertStudentDevices(studentId, devices.map((d) => d.name));
    console.log('[devices] upsert_student_devices ok', devices.length, 'device(s)');
  } catch (e) {
    console.error('[devices] upsert_student_devices failed', e);
  }
}

/** Realtime + DB snapshot; merges mock test device when enabled. */
export async function pushStudentDeviceList(
  studentId: string,
  classId: string,
  realDevices: PushDevice[]
): Promise<void> {
  const devices = normalizeDeviceList(withMockDevices(realDevices));
  await sendClassDeviceListBroadcast(studentId, classId, devices);
}

export function readStudentDeviceContext(): { studentId: string; classId: string } | null {
  try {
    const userRaw = sessionStorage.getItem('student_user');
    const classRaw =
      sessionStorage.getItem('student_class') ?? localStorage.getItem('student_class');
    if (!userRaw || !classRaw) return null;
    const user = JSON.parse(userRaw);
    const cls = JSON.parse(classRaw);
    if (!user?.id || !cls?.id) return null;
    return { studentId: user.id, classId: cls.id };
  } catch {
    return null;
  }
}
