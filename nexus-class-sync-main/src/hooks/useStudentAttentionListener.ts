import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
 * Student subscribes to TWO channels:
 * 1. student_${studentId}_alerts — personal alerts (event: student_alert)
 * 2. class_${classId}_alerts — class-wide alerts (event: all_students_alert)
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

    // CHANNEL 1: Personal alerts (targeted to this student)
    const personalChannelName = `student_${studentId}_alerts`;
    const personalChannel = supabase.channel(personalChannelName);
    personalChannelRef.current = personalChannel;

    personalChannel.on('broadcast', { event: 'student_alert' }, (payload: any) => {
      const p = payload.payload || {};
      const { student_id, message, timestamp, alert_type } = p;
      callbackRef.current?.({
        type: 'individual',
        message: message ?? 'Teacher needs your attention',
        timestamp: timestamp ?? new Date().toISOString(),
        alert_type: alert_type ?? 'individual'
      });
    });

    personalChannel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[attention] Failed to subscribe to personal alerts:', personalChannelName);
      }
    });

    // CHANNEL 2: Class-wide alerts (sent to all students)
    if (classId) {
      const classChannelName = `class_${classId}_alerts`;
      const classChannel = supabase.channel(classChannelName);
      classChannelRef.current = classChannel;

      classChannel.on('broadcast', { event: 'all_students_alert' }, (payload: any) => {
        const p = payload.payload || {};
        const { message, timestamp, alert_type } = p;
        callbackRef.current?.({
          type: 'all',
          message: message ?? "Teacher needs everyone's attention",
          timestamp: timestamp ?? new Date().toISOString(),
          alert_type: alert_type ?? 'all'
        });
      });

      classChannel.subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error('[attention] Failed to subscribe to class alerts:', classChannelName);
        }
      });
    }

    return () => {
      cleanup();
    };
  }, [classId, studentId]);

  return {
    isListening: !!personalChannelRef.current || !!classChannelRef.current
  };
};
