import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { resolveRealtimeChannel } from '@/lib/realtimeChannel';

interface StudentAttentionOptions {
  classId: string | null;
  studentId: string;
  onAttentionAlert?: (data: AttentionAlert) => void;
}

export interface AttentionAlert {
  type: 'individual' | 'all';
  message: string;
  timestamp: string;
  alert_type: string;
}

/**
 * Student subscribes to signed realtime channels:
 * 1. student_alerts — personal alerts (event: student_alert)
 * 2. class_alerts — class-wide alerts (event: all_students_alert)
 */
export const useStudentAttentionListener = ({
  classId,
  studentId,
  onAttentionAlert
}: StudentAttentionOptions) => {
  const personalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const classChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callbackRef = useRef(onAttentionAlert);
  callbackRef.current = onAttentionAlert;

  useEffect(() => {
    if (!studentId) {
      return;
    }

    let cancelled = false;

    const cleanup = () => {
      if (personalChannelRef.current) {
        supabase.removeChannel(personalChannelRef.current);
        personalChannelRef.current = null;
      }
      if (classChannelRef.current) {
        supabase.removeChannel(classChannelRef.current);
        classChannelRef.current = null;
      }
    };

    void (async () => {
      const personalChannelName = await resolveRealtimeChannel('student_alerts', studentId);
      if (cancelled || !personalChannelName) {
        console.error('[attention] Failed to resolve personal alerts channel');
        return;
      }

      const personalChannel = supabase.channel(personalChannelName);
      personalChannelRef.current = personalChannel;

      personalChannel.on('broadcast', { event: 'student_alert' }, (payload: { payload?: Record<string, unknown> }) => {
        const p = payload.payload || {};
        callbackRef.current?.({
          type: 'individual',
          message: (p.message as string) ?? 'Teacher needs your attention',
          timestamp: (p.timestamp as string) ?? new Date().toISOString(),
          alert_type: (p.alert_type as string) ?? 'individual'
        });
      });

      personalChannel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[attention] Failed to subscribe to personal alerts:', personalChannelName);
        }
      });

      if (classId) {
        const classChannelName = await resolveRealtimeChannel('class_alerts', classId);
        if (cancelled || !classChannelName) {
          console.error('[attention] Failed to resolve class alerts channel');
          return;
        }

        const classChannel = supabase.channel(classChannelName);
        classChannelRef.current = classChannel;

        classChannel.on('broadcast', { event: 'all_students_alert' }, (payload: { payload?: Record<string, unknown> }) => {
          const p = payload.payload || {};
          callbackRef.current?.({
            type: 'all',
            message: (p.message as string) ?? "Teacher needs everyone's attention",
            timestamp: (p.timestamp as string) ?? new Date().toISOString(),
            alert_type: (p.alert_type as string) ?? 'all'
          });
        });

        classChannel.subscribe((status) => {
          if (status === 'CHANNEL_ERROR') {
            console.error('[attention] Failed to subscribe to class alerts:', classChannelName);
          }
        });
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [classId, studentId]);

  return {
    isListening: !!personalChannelRef.current || !!classChannelRef.current
  };
};
