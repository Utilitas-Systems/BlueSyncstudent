import { supabase } from '@/integrations/supabase/client';
import { formatRpcError } from '@/lib/rpcError';

export type StudentLoginUser = {
  user_id: string;
  username: string;
  full_name: string;
  school_id: string;
  user_type: string;
  class_id?: string;
  class_code?: string;
  class_name?: string;
};

export type StudentLoginResult = {
  user: StudentLoginUser;
  sessionToken: string;
  classFromLogin?: { id: string; class_code: string; class_name: string };
  loginRpc?: 'login_student' | 'login_school_user';
};

function asRow(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') return null;
  return row as Record<string, unknown>;
}

export function extractSessionToken(row: Record<string, unknown>): string | null {
  for (const key of ['session_token', 'sessionToken', 'token', 'access_token']) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length >= 32) {
      return value.trim();
    }
  }
  return null;
}

function normalizeUser(row: Record<string, unknown>): StudentLoginUser {
  const userId = String(row.student_id ?? row.user_id ?? row.id ?? '');
  return {
    user_id: userId,
    username: String(row.username ?? ''),
    full_name: String(row.full_name ?? ''),
    school_id: String(row.school_id ?? ''),
    user_type: String(row.user_type ?? 'student'),
    class_id: row.class_id ? String(row.class_id) : undefined,
    class_code: row.class_code ? String(row.class_code) : undefined,
    class_name: row.class_name ? String(row.class_name) : undefined,
  };
}

function hasUserId(row: Record<string, unknown>): boolean {
  return Boolean(row.student_id ?? row.user_id ?? row.id);
}

function isMissingRpc(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const msg = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    /function.*does not exist|Could not find|no matches were found/i.test(msg)
  );
}

function parseLoginRow(data: unknown): StudentLoginResult | null {
  const row = asRow(data);
  if (!row || !hasUserId(row)) return null;

  if (row.requires_password_setup === true) {
    return null;
  }

  const sessionToken = extractSessionToken(row);
  if (!sessionToken) return null;

  const user = normalizeUser(row);
  const classId = user.class_id;
  const classFromLogin =
    classId && user.class_code
      ? {
          id: classId,
          class_code: user.class_code,
          class_name: user.class_name ?? 'Class',
        }
      : undefined;

  return { user, sessionToken, classFromLogin };
}

function parseLoginRowWithRpc(
  data: unknown,
  loginRpc: StudentLoginResult['loginRpc']
): StudentLoginResult | null {
  const parsed = parseLoginRow(data);
  if (!parsed) return null;
  return { ...parsed, loginRpc };
}

type RpcAttempt = { name: string; args: Record<string, string> };

/**
 * Student login — primary: `login_student(p_class_code, p_username, p_password)`.
 * Fallback: `login_school_user` for school-code accounts.
 */
export async function loginStudent(params: {
  classCode: string;
  username: string;
  password: string;
}): Promise<{
  data?: StudentLoginResult;
  error?: string;
  requiresPasswordSetup?: boolean;
}> {
  const code = params.classCode.toUpperCase();
  const username = params.username.toUpperCase();
  const password = params.password;

  const attempts: RpcAttempt[] = [
    {
      name: 'login_student',
      args: { p_class_code: code, p_username: username, p_password: password },
    },
    {
      name: 'login_school_user',
      args: {
        p_school_code: code,
        p_username: username,
        p_password: password,
        p_user_type: 'student',
      },
    },
  ];

  let lastError: string | undefined;
  let sawEmpty = false;

  for (const { name, args } of attempts) {
    const result = await supabase.rpc(name as never, args as never);
    if (result.error) {
      if (isMissingRpc(result.error)) continue;
      lastError = result.error.message ?? 'Login failed.';
      continue;
    }

    const row = asRow(result.data);
    if (row?.requires_password_setup === true) {
      return {
        requiresPasswordSetup: true,
        error: 'Your account has no password yet. Ask your teacher to reset your password.',
      };
    }

    const parsed = parseLoginRowWithRpc(
      result.data,
      name === 'login_student' ? 'login_student' : 'login_school_user'
    );
    if (parsed) return { data: parsed };

    if (result.data && Array.isArray(result.data) && result.data.length === 0) {
      sawEmpty = true;
    }
  }

  if (lastError) return { error: lastError };
  if (sawEmpty) return { error: 'Invalid credentials or school/class code.' };
  return { error: 'Could not sign in. Confirm your credentials and try again.' };
}

const LOGIN_CREDS_KEY = 'student_login_creds';

/** Session-only credentials for re-issuing a class-scoped student token before join. */
export function storeLoginCreds(username: string, password: string): void {
  try {
    sessionStorage.setItem(LOGIN_CREDS_KEY, JSON.stringify({ username, password }));
  } catch {
    /* ignore */
  }
}

export function clearLoginCreds(): void {
  sessionStorage.removeItem(LOGIN_CREDS_KEY);
}

function readLoginCreds(): { username: string; password: string } | null {
  try {
    const raw = sessionStorage.getItem(LOGIN_CREDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { username?: string; password?: string };
    if (!parsed.username || !parsed.password) return null;
    return { username: parsed.username, password: parsed.password };
  } catch {
    return null;
  }
}

/**
 * Re-login via `login_student(p_class_code, …)` to obtain a token that works with join/status v2.
 * Needed when the user signed in with `login_school_user` (school code field).
 */
export async function reissueStudentTokenForClass(classCode: string): Promise<string | null> {
  const creds = readLoginCreds();
  if (!creds) return null;

  const result = await supabase.rpc('login_student' as never, {
    p_class_code: classCode.trim().toUpperCase(),
    p_username: creds.username.toUpperCase(),
    p_password: creds.password,
  } as never);

  if (result.error) {
    console.warn('[studentLogin] reissueStudentTokenForClass failed', formatRpcError(result.error));
    return null;
  }

  const row = asRow(result.data);
  if (row?.requires_password_setup === true) return null;

  const parsed = parseLoginRow(result.data);
  return parsed?.sessionToken ?? null;
}
