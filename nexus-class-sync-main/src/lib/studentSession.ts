import { supabase } from '@/integrations/supabase/client';
import { clearLoginCreds } from '@/lib/studentLogin';
import { clearStudentClass } from '@/lib/studentClass';
import { invalidateDeviceChannels } from '@/lib/pushStudentDeviceList';

const SESSION_TOKEN_KEY = 'student_session_token';
const SESSION_EXPIRED_EVENT = 'bluesync:session-expired';

export function getSessionToken(): string | null {
  try {
    return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  sessionStorage.setItem(SESSION_TOKEN_KEY, token);
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    /* ignore quota */
  }
}

export function clearSessionToken(): void {
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function requireSessionToken(): string {
  const token = getSessionToken();
  if (!token) {
    throw new Error('No student session token — please sign in again.');
  }
  return token;
}

export function isInvalidSessionError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('invalid session') ||
    msg.includes('session expired') ||
    msg.includes('session token expired') ||
    msg.includes('invalid or expired session')
  );
}

export function emitSessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

export function onSessionExpired(handler: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

/** Wipe auth state and notify UI to return to login. */
export function clearStudentAuth(options?: { silent?: boolean }): void {
  clearSessionToken();
  sessionStorage.removeItem('student_user');
  sessionStorage.removeItem('student_school');
  clearStudentClass();
  clearLoginCreds();
  invalidateDeviceChannels();
  void import('@/hooks/useBroadcastPresence').then((m) => m.stopStudentPresenceSession());
  if (!options?.silent) {
    emitSessionExpired();
  }
}

/** Optional boot check — skipped if verify_session_token is not exposed to anon. */
export async function verifyStoredSession(): Promise<boolean> {
  const token = getSessionToken();
  if (!token) return false;

  const { data, error } = await supabase.rpc('verify_session_token' as never, {
    p_session_token: token,
  } as never);

  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('permission denied for function') || error.code === 'PGRST202') {
      return true;
    }
    if (isInvalidSessionError(error)) return false;
    return true;
  }

  if (data === false || data === null) return false;
  if (Array.isArray(data) && data.length === 0) return false;
  if (typeof data === 'object' && data !== null && 'is_valid' in (data as object)) {
    return Boolean((data as { is_valid?: boolean }).is_valid);
  }
  return true;
}
