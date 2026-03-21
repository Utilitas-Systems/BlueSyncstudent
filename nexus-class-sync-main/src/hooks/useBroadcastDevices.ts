import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

type SimpleDevice = { name: string; connected: boolean };
type BroadcastDevice = { name: string; type?: string; isConnected?: boolean; connected?: boolean };

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
      try { console.log('[Student] devices initial list sent', arg2); } catch {}
    }
    return () => { try { channel.unsubscribe(); } catch {} };
  }, [isObjectParams, classId]);

  useEffect(() => {
    if (isObjectParams) return; // handled below
    if (!chanRef.current || !Array.isArray(arg2)) return;
    // delta update on change
    chanRef.current.send({ type: 'broadcast', event: 'device_update', payload: { devices: arg2, ts: Date.now() } });
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
        const normalized = (devices || []).map(d => ({
          name: d.name,
          isConnected: typeof d.isConnected === 'boolean' ? d.isConnected : !!d.connected,
          type: d.type,
        }));
        chanRef.current.send({ type: 'broadcast', event: 'device_list', payload: { student_id: studentId, devices: normalized, timestamp: new Date().toISOString() } });
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
