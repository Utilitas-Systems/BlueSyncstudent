import { useEffect, useMemo } from 'react';
import { pushStudentDeviceList } from '@/lib/pushStudentDeviceList';

type SimpleDevice = { name: string; connected: boolean };
type BroadcastDevice = { name: string; type?: string; isConnected?: boolean; connected?: boolean };

function toPushDevices(devices: BroadcastDevice[]) {
  return (devices || []).map((d) => ({
    name: d.name,
    type: d.type || 'bluetooth',
    isConnected: typeof d.isConnected === 'boolean' ? d.isConnected : !!d.connected,
  }));
}

export function useBroadcastDevices(classId?: string, devices?: Array<SimpleDevice>): void;
export function useBroadcastDevices(params: {
  studentId: string;
  classId: string;
}): { broadcastDeviceList: (devices: BroadcastDevice[]) => void };

export function useBroadcastDevices(
  arg1?: string | { studentId: string; classId: string },
  arg2?: Array<SimpleDevice>
) {
  const isObjectParams = typeof arg1 === 'object' && arg1 !== null;
  const classId = isObjectParams ? (arg1 as { classId: string }).classId : (arg1 as string | undefined);
  const studentId = isObjectParams ? (arg1 as { studentId: string }).studentId : undefined;

  const broadcastDeviceList = useMemo(() => {
    if (!isObjectParams) return undefined;
    const fn = (devices: BroadcastDevice[]) => {
      if (!classId || !studentId) return;
      void pushStudentDeviceList(studentId, classId, toPushDevices(devices));
    };
    return fn;
  }, [isObjectParams, classId, studentId]);

  useEffect(() => {
    if (isObjectParams || !classId || !studentId || !Array.isArray(arg2)) return;
    void pushStudentDeviceList(studentId, classId, toPushDevices(arg2));
  }, [isObjectParams, classId, studentId, Array.isArray(arg2) ? JSON.stringify(arg2) : arg2]);

  if (isObjectParams) {
    return {
      broadcastDeviceList: (broadcastDeviceList || (() => {})) as (devices: BroadcastDevice[]) => void,
    };
  }

  return undefined;
}
