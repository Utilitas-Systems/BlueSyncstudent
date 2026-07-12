import { supabase } from '@/integrations/supabase/client';
import { getSessionToken, isInvalidSessionError, clearStudentAuth } from '@/lib/studentSession';

export type RealtimeChannelKind =
  | 'student_alerts'
  | 'class_audio'
  | 'class_devices'
  | 'class_alerts'
  | 'class_presence';

/** Fetch HMAC-signed channel name (rt-<hex>) from the backend. */
export async function resolveRealtimeChannel(
  kind: RealtimeChannelKind,
  targetId: string
): Promise<string | null> {
  const token = getSessionToken();
  if (!token || !targetId) return null;

  const { data, error } = await supabase.rpc('get_realtime_channel_key' as never, {
    p_session_token: token,
    p_kind: kind,
    p_target_id: targetId,
  } as never);

  if (error) {
    if (isInvalidSessionError(error)) {
      clearStudentAuth();
    } else {
      console.error('[realtime] get_realtime_channel_key failed', { kind, targetId, error });
    }
    return null;
  }
  if (data == null || data === '') return null;
  return String(data);
}
