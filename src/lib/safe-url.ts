/**
 * Normalize an untrusted external URL before exposing it as a browser link.
 * RSS/Atom fields are publisher-controlled, so checking only for a non-empty
 * string would allow executable schemes such as `javascript:`.
 */
export function safeHttpUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
