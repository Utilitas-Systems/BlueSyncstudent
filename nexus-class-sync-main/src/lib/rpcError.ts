/** Supabase PostgREST errors are plain objects — not `instanceof Error`. */
export function formatRpcError(error: unknown, fallback = 'Request failed.'): string {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    const e = error as { message?: string; code?: string; details?: string; hint?: string };
    if (e.message?.trim()) return e.message.trim();
    if (e.details?.trim()) return e.details.trim();
    if (e.code) return `${fallback} (${e.code})`;
  }
  return fallback;
}
