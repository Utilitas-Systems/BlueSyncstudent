import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/integrations/supabase/client';
import { reissueStudentTokenForClass } from '@/lib/studentLogin';
import { readStoredClassCode } from '@/lib/studentClass';
import { formatRpcError } from '@/lib/rpcError';
import {
  clearStudentAuth,
  getSessionToken,
  isInvalidSessionError,
  requireSessionToken,
  setSessionToken,
} from '@/lib/studentSession';

const OFFLINE_URL = `${SUPABASE_URL.replace('.supabase.co', '.functions.supabase.co')}/student-offline`;

type RpcError = { message?: string; code?: string };

function throwIfInvalidSession(error: RpcError | null): void {
  if (isInvalidSessionError(error)) {
    clearStudentAuth();
    throw new Error('Session expired. Please sign in again.');
  }
}

function shouldRetryJoinWithClassToken(error: RpcError | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    isInvalidSessionError(error) ||
    error.code === '28000' ||
    msg.includes('not authenticated') ||
    !msg.trim()
  );
}

async function callJoinClassByCodeV2(token: string, classCode: string) {
  return supabase.rpc('join_class_by_code_v2' as never, {
    p_session_token: token,
    p_class_code: classCode,
  } as never);
}

export type JoinedClass = {
  id: string;
  class_code: string;
  class_name: string;
  already_enrolled?: boolean;
};

function parseJoinedClass(data: unknown, fallbackCode: string): JoinedClass | null {
  if (typeof data === 'string' && data.length >= 32) {
    return { id: data, class_code: fallbackCode, class_name: 'Class' };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = String(r.class_id ?? r.id ?? '');
  if (!id) return null;
  return {
    id,
    class_code: String(r.class_code ?? fallbackCode),
    class_name: String(r.class_name ?? 'Class'),
    already_enrolled: r.already_enrolled === true,
  };
}

/** Join with an explicit token (e.g. immediately after login, before session is read back). */
export async function joinClassWithToken(token: string, classCode: string): Promise<JoinedClass> {
  const trimmed = classCode.trim().toUpperCase();
  const { data, error } = await callJoinClassByCodeV2(token, trimmed);
  if (error) {
    throwIfInvalidSession(error);
    throw new Error(formatRpcError(error, 'Could not join class. Check the code and try again.'));
  }
  const parsed = parseJoinedClass(data, trimmed);
  if (!parsed) {
    throw new Error(`No class with code "${trimmed}" found in your school.`);
  }
  return parsed;
}

export async function joinClassByCode(classCode: string): Promise<JoinedClass> {
  const trimmed = classCode.trim().toUpperCase();
  let token = requireSessionToken();

  let { data, error } = await callJoinClassByCodeV2(token, trimmed);

  if (error && shouldRetryJoinWithClassToken(error)) {
    const fresh = await reissueStudentTokenForClass(trimmed);
    if (fresh) {
      token = fresh;
      setSessionToken(fresh);
      ({ data, error } = await callJoinClassByCodeV2(token, trimmed));
    }
  }

  if (error) {
    throwIfInvalidSession(error);
    throw new Error(formatRpcError(error, 'Could not join class. Check the code and try again.'));
  }

  const parsed = parseJoinedClass(data, trimmed);
  if (!parsed) {
    throw new Error(`No class with code "${trimmed}" found in your school.`);
  }
  return parsed;
}

export async function updateStudentStatus(isOnline: boolean): Promise<void> {
  let token = requireSessionToken();
  let { error } = await supabase.rpc('update_student_status_v2' as never, {
    p_session_token: token,
    p_is_online: isOnline,
  } as never);

  if (error && shouldRetryJoinWithClassToken(error)) {
    const classCode = readStoredClassCode();
    if (classCode) {
      const fresh = await reissueStudentTokenForClass(classCode);
      if (fresh) {
        token = fresh;
        setSessionToken(fresh);
        ({ error } = await supabase.rpc('update_student_status_v2' as never, {
          p_session_token: token,
          p_is_online: isOnline,
        } as never));
      }
    }
  }

  if (error) {
    throwIfInvalidSession(error);
    console.error('[studentRpc] update_student_status_v2 failed', error);
    throw error;
  }
}

export async function updateStudentAudioLevel(audioLevel: number): Promise<void> {
  const token = getSessionToken();
  if (!token) return;
  const { error } = await supabase.rpc('update_student_audio_level_v2' as never, {
    p_session_token: token,
    p_audio_level: audioLevel,
  } as never);
  if (error) {
    if (isInvalidSessionError(error)) clearStudentAuth();
    else console.error('[studentRpc] update_student_audio_level_v2 failed', error);
  }
}

export async function studentLeaveClass(classId: string): Promise<void> {
  const token = requireSessionToken();
  const { error } = await supabase.rpc('student_leave_class_v2' as never, {
    p_session_token: token,
    p_class_id: classId,
  } as never);
  if (error) {
    throwIfInvalidSession(error);
    throw error;
  }
}

export async function upsertStudentDevices(studentId: string, deviceNames: string[]): Promise<void> {
  if (!studentId) return;
  const { error } = await supabase.rpc('upsert_student_devices' as never, {
    p_student_id: studentId,
    p_devices: deviceNames,
  } as never);
  if (error) {
    console.error('[studentRpc] upsert_student_devices failed', error);
    throw new Error(formatRpcError(error, 'Failed to save devices to server.'));
  }
}

export async function fetchStudentClasses(): Promise<
  Array<{ id: string; class_code?: string; class_name?: string; created_at?: string; teacher_id?: string }>
> {
  const token = requireSessionToken();
  const { data, error } = await supabase.rpc('get_student_classes' as never, {
    p_session_token: token,
  } as never);
  if (error) {
    throwIfInvalidSession(error);
    console.error('[studentRpc] get_student_classes failed', error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

/** Fire-and-forget offline beacon (app quit / tab close). */
export function beaconStudentOffline(): void {
  const token = getSessionToken();
  if (!token) return;
  fetch(OFFLINE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
    keepalive: true,
  }).catch(() => {});
}
