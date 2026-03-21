-- Fix identity propagation for custom auth by deriving current_user_id() from per-request headers
-- NOTE: This does NOT make the system fully secure without real auth; it just makes RLS work consistently per request.

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v uuid;
  headers_json jsonb;
BEGIN
  -- 1) Prefer PostgREST request headers (works across HTTP requests)
  BEGIN
    headers_json := current_setting('request.headers', true)::jsonb;
    v := nullif(headers_json->>'x-app-user-id', '')::uuid;
    IF v IS NOT NULL THEN
      RETURN v;
    END IF;
  EXCEPTION WHEN others THEN
    -- ignore
  END;

  -- 2) Fallback to transaction-local config (legacy)
  BEGIN
    v := nullif(current_setting('app.current_user_id', true), '')::uuid;
  EXCEPTION WHEN others THEN
    v := NULL;
  END;

  RETURN v;
END;
$$;