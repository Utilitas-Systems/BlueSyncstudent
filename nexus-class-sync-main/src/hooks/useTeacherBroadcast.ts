import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BluetoothDevice {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  sharing: boolean;
}

interface StudentDeviceData {
  student_id: string;
  devices: BluetoothDevice[];
  timestamp: string;
}

interface StudentAudioData {
  student_id: string;
  audio_level: number;
  is_talking: boolean;
  timestamp: string;
}

interface TeacherBroadcastOptions {
  classId: string | null;
  onDeviceUpdate?: (data: StudentDeviceData) => void;
  onDeviceList?: (data: { student_id: string; devices: BluetoothDevice[] }) => void;
  onAudioLevel?: (data: StudentAudioData) => void;
}

export const useTeacherBroadcast = ({ 
  classId, 
  onDeviceUpdate,
  onDeviceList,
  onAudioLevel
}: TeacherBroadcastOptions) => {
  const devicesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const audioChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callbackRef = useRef(onDeviceUpdate);
  const listCallbackRef = useRef(onDeviceList);
  const audioCallbackRef = useRef(onAudioLevel);
  const [studentDevices, setStudentDevices] = useState<Map<string, BluetoothDevice[]>>(new Map());
  const [studentAudio, setStudentAudio] = useState<Map<string, { audioLevel: number; lastUpdate: string }>>(new Map());

  callbackRef.current = onDeviceUpdate;
  listCallbackRef.current = onDeviceList;
  audioCallbackRef.current = onAudioLevel;

  useEffect(() => {
    if (!classId) {
      return;
    }

    if (devicesChannelRef.current) {
      supabase.removeChannel(devicesChannelRef.current);
      devicesChannelRef.current = null;
    }
    if (audioChannelRef.current) {
      supabase.removeChannel(audioChannelRef.current);
      audioChannelRef.current = null;
    }

    // --- DEVICES CHANNEL ---
    const devicesChannelName = `class_${classId}_devices`;
    const devicesChannel = supabase.channel(devicesChannelName);
    devicesChannelRef.current = devicesChannel;
    
    devicesChannel.on('broadcast', { event: 'device_update' }, (payload: any) => {
      console.log('[teacher-devices] Received device_update:', payload);
      const { student_id, devices, timestamp } = payload.payload || {};
      
      if (student_id && devices) {
        // Update local state
        setStudentDevices(prev => {
          const newMap = new Map(prev);
          newMap.set(student_id, devices);
          return newMap;
        });

        // Call callback
        callbackRef.current?.({
          student_id,
          devices,
          timestamp
        });
      }
    });

    // Listen for device_list events (full list request)
    devicesChannel.on('broadcast', { event: 'device_list' }, (payload: any) => {
      console.log('[teacher-devices] Received device_list:', payload);
      const { student_id, devices } = payload.payload || {};
      
      if (student_id && devices) {
        // Update local state
        setStudentDevices(prev => {
          const newMap = new Map(prev);
          newMap.set(student_id, devices);
          return newMap;
        });

        // Call callback
        listCallbackRef.current?.({
          student_id,
          devices
        });
      }
    });

    devicesChannel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[teacher] Failed to subscribe to devices channel:', devicesChannelName);
      }
    });

    // --- AUDIO CHANNEL ---
    const audioChannelName = `class_${classId}_audio`;
    const audioChannel = supabase.channel(audioChannelName);
    audioChannelRef.current = audioChannel;

    audioChannel.on('broadcast', { event: 'audio_level' }, (payload: any) => {
      const p = payload.payload || {};
      const { student_id, audio_level, is_talking, timestamp } = p;
      if (student_id != null && timestamp) {
        setStudentAudio(prev => {
          const next = new Map(prev);
          next.set(student_id, {
            audioLevel: typeof audio_level === 'number' ? audio_level : 0,
            lastUpdate: timestamp
          });
          return next;
        });
        audioCallbackRef.current?.({
          student_id,
          audio_level: typeof audio_level === 'number' ? audio_level : 0,
          is_talking: !!is_talking,
          timestamp
        });
      }
    });

    audioChannel.subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error('[teacher] Failed to subscribe to audio channel:', audioChannelName);
      }
    });

    return () => {
      if (devicesChannelRef.current) {
        supabase.removeChannel(devicesChannelRef.current);
        devicesChannelRef.current = null;
      }
      if (audioChannelRef.current) {
        supabase.removeChannel(audioChannelRef.current);
        audioChannelRef.current = null;
      }
    };
  }, [classId]);

  return {
    isListening: !!(devicesChannelRef.current || audioChannelRef.current),
    studentDevices,
    studentAudio
  };
};


