/**
 * Classify TAURI_SIGNING_PRIVATE_KEY content for CI / local checks.
 * GitHub secrets sometimes strip newlines or add odd whitespace.
 */

export function normalizeSigningKeyInput(rawIn) {
  let raw = String(rawIn ?? "").trim();
  raw = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.includes("\n") && raw.includes("\\n")) raw = raw.replace(/\\n/g, "\n");
  return raw;
}

/**
 * Recover missing newline between comment line and base64 line (common paste / secret-UI bug).
 */
export function recoverMinisignNewlines(raw) {
  const t = raw.trim();
  if (t.includes("\n")) return raw;
  if (
    /untrusted comment:/i.test(t) &&
    /minisign/i.test(t) &&
    /secret|encrypted/i.test(t) &&
    !/minisign public key/i.test(t)
  ) {
    const m = t.match(/([A-Za-z0-9+/]{60,}={0,2})$/);
    if (m && m.index !== undefined && m.index > 30) {
      return `${t.slice(0, m.index).trimEnd()}\n${m[0]}`;
    }
  }
  return raw;
}

export function classifySigningKey(rawIn) {
  let raw = normalizeSigningKeyInput(rawIn);
  raw = recoverMinisignNewlines(raw);

  const ascii = raw.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
  const preview = ascii.slice(0, 56).replace(/[^\x20-\x7E]/g, "?");
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);

  function isPrivateMinisignText(s) {
    if (/minisign encrypted secret key/i.test(s) || /minisign secret key/i.test(s)) return true;
    const L = s.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (L.length < 2) return false;
    const a = L[0].toLowerCase();
    if (!a.includes("untrusted") || !a.includes("comment")) return false;
    if (/minisign public key/i.test(a) && !/secret|encrypted/i.test(a)) return false;
    if (/encrypted secret|secret key/i.test(a)) return true;
    return false;
  }

  /** Whole .pub file pasted by mistake (two lines, first is public). */
  function isPublicKeyOnly(s) {
    const L = s.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (L.length < 1) return false;
    const a = L[0].toLowerCase();
    if (/minisign public key/i.test(a) && !/secret|encrypted/i.test(a)) return true;
    return /minisign public key/i.test(s) && !/minisign encrypted secret key|minisign secret key/i.test(s);
  }

  let looksValid =
    raw.length >= 60 &&
    !isPublicKeyOnly(raw) &&
    (isPrivateMinisignText(raw) || isPrivateMinisignText(ascii));

  /** Single-line base64 of entire UTF-8 key file (some teams wrap the file). */
  if (!looksValid) {
    const one = raw.replace(/\s/g, "");
    if (one.length >= 120 && /^[A-Za-z0-9+/]+=*$/.test(one)) {
      try {
        const dec = Buffer.from(one, "base64").toString("utf8");
        if (isPrivateMinisignText(dec) && !isPublicKeyOnly(dec)) looksValid = true;
      } catch {
        /* ignore */
      }
    }
  }

  return {
    raw,
    looksValid,
    preview,
    lineCount: lines.length,
    hasSecretMarker:
      /minisign encrypted secret key/i.test(raw) || /minisign secret key/i.test(raw),
    hasPublicMarker: isPublicKeyOnly(raw),
  };
}
