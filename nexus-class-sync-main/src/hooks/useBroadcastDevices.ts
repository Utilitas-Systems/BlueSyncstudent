import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type SimpleDevice = { name: string; connected: boolean };
type BroadcastDevice = { name: string; type?: string; isConnected?: boolean; connected?: boolean };

function normalizeDevices(devices: BroadcastDevice[]) {
  return (devices || []).map((d) => ({
    name: d.name,
    isConnected: typeof d.isConnected === 'boolean' ? d.isConnected : !!d.connected,
    type: d.type || 'bluetooth',
  }));
}

// Overloads for backward compatibility and new API
export function useBroadcastDevices(classId?: string, devices?: Array<SimpleDevice>): void;
export function useBroadcastDevices(params: { studentId: string; classId: string }): { broadcastDeviceList: (devices: BroadcastDevice[]) => void };

export function useBroadcastDevices(
  arg1?: string | { studentId: string; classId: string },
  arg2?: Array<SimpleDevice>
) {
  const isObjectParams = typeof arg1 === 'object' && arg1 !== null;
  const classId = isObjectParams ? (arg1 as any).classId : (arg1 as string | undefined);
  const studentId = isObjectParams ? (arg1 as any).studentId : undefined;
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const persistDevices = async (sid: string | undefined, devices: BroadcastDevice[]) => {
    let studentIdForWrite = sid;
    if (!studentIdForWrite) {
      try {
        const raw = sessionStorage.getItem('student_user');
        if (raw) {
          const parsed = JSON.parse(raw) as { id?: string };
          studentIdForWrite = parsed?.id;
        }
      } catch {
        // ignore parse errors
      }
    }
    if (!studentIdForWrite) return;
    const normalized = normalizeDevices(devices);
    const nowIso = new Date().toISOString();
    const rows = normalized.map((d) => ({
      student_id: studentIdForWrite,
      device_name: d.name,
      device_type: d.type || 'bluetooth',
      is_connected: d.isConnected,
      last_connected: d.isConnected ? nowIso : null,
      last_detected_at: nowIso,
      updated_at: nowIso,
      connection_status: d.isConnected ? 'connected' : 'disconnected',
    }));
    try {
      if (rows.length === 0) {
        const { error } = await supabase
          .from('student_devices')
          .delete()
          .eq('student_id', studentIdForWrite);
        if (error) {
          console.error('[useBroadcastDevices] Error clearing student_devices:', error);
        }
        return;
      }
      const { error: upsertError } = await supabase
        .from('student_devices')
        .upsert(rows, { onConflict: 'student_id,device_name' });
      if (upsertError) {
        console.error('[useBroadcastDevices] Error upserting student_devices:', upsertError);
        return;
      }
      const keep = new Set(rows.map((r) => r.device_name));
      const { data: existingRows, error: selError } = await supabase
        .from('student_devices')
        .select('id, device_name')
        .eq('student_id', studentIdForWrite);
      if (selError) {
        console.error('[useBroadcastDevices] Error listing student_devices:', selError);
        return;
      }
      const staleIds = (existingRows || [])
        .filter((r) => r.device_name && !keep.has(r.device_name))
        .map((r) => r.id);
      if (staleIds.length > 0) {
        const { error: delError } = await supabase
          .from('student_devices')
          .delete()
          .in('id', staleIds);
        if (delError) {
          console.error('[useBroadcastDevices] Error removing stale student_devices:', delError);
        }
      }
      try { console.log('[Student] devices upserted', rows.length); } catch {}
    } catch (e) {
      console.error('[useBroadcastDevices] Unexpected upsert error:', e);
    }
  };

  // Legacy positional usage: subscribe and broadcast reactively
  useEffect(() => {
    if (isObjectParams) return; // handled below
    if (!classId) return;
    const channel = supabase.channel(`class_${classId}_devices`, { config: { broadcast: { self: true } } });
    chanRef.current = channel;
    channel.subscribe((s) => { try { console.log('[Student] devices subscribe status:', s); } catch {} });
    channel.on('broadcast', { event: 'device_list' }, (e) => { try { console.log('[Student] echo device_list', e.payload); } catch {} });
    // initial full list on mount
    if (Array.isArray(arg2)) {
      channel.send({ type: 'broadcast', event: 'device_list', payload: { devices: arg2, ts: Date.now() } });
      void persistDevices(undefined, (arg2 || []).map(d => ({ name: d.name, isConnected: !!d.connected, type: 'bluetooth' })));
      try { console.log('[Student] devices initial list sent', arg2); } catch {}
    }
    return () => { try { channel.unsubscribe(); } catch {} };
  }, [isObjectParams, classId]);

  useEffect(() => {
    if (isObjectParams) return; // handled below
    if (!chanRef.current || !Array.isArray(arg2)) return;
    // delta update on change
    chanRef.current.send({ type: 'broadcast', event: 'device_update', payload: { devices: arg2, ts: Date.now() } });
    void persistDevices(undefined, (arg2 || []).map(d => ({ name: d.name, isConnected: !!d.connected, type: 'bluetooth' })));
  }, [isObjectParams, Array.isArray(arg2) ? JSON.stringify(arg2) : arg2]);

  // New object API: return broadcast function
  const broadcastDeviceList = useMemo(() => {
    if (!isObjectParams) return undefined;
    const fn = (devices: BroadcastDevice[]) => {
      try {
        if (!chanRef.current && classId) {
          const channel = supabase.channel(`class_${classId}_devices`, { config: { broadcast: { self: true } } });
          chanRef.current = channel;
          channel.subscribe((s) => { try { console.log('[Student] devices subscribe status:', s); } catch {} });
        }
        if (!chanRef.current) return;
        const normalized = normalizeDevices(devices || []);
        chanRef.current.send({ type: 'broadcast', event: 'device_list', payload: { student_id: studentId, devices: normalized, timestamp: new Date().toISOString() } });
        void persistDevices(studentId, normalized);
        try { console.log('[Student] devices list sent', normalized); } catch {}
      } catch (error) {
        console.error('[useBroadcastDevices] Error broadcasting devices:', error);
      }
    };
    return fn;
  }, [isObjectParams, classId, studentId]);

  if (isObjectParams) {
    return { broadcastDeviceList: (broadcastDeviceList || (() => {})) as (devices: BroadcastDevice[]) => void };
  }
  
  return undefined;
}
