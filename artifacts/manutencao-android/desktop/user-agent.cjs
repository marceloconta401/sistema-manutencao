// HTTP headers must remain ASCII even when the visible app name has accents.
// Supabase Auth stores User-Agent when creating a session; Latin-1 bytes from
// Electron's default accented product name are rejected by PostgreSQL UTF-8.
function asciiUserAgent(userAgent) {
  if (typeof userAgent !== "string" || !userAgent.trim()) {
    throw new TypeError("A browser User-Agent is required.");
  }
  const normalized = userAgent.normalize("NFKD").replace(/[^\x20-\x7E]/g, "");
  if (!normalized.trim()) throw new TypeError("An ASCII browser User-Agent is required.");
  return normalized;
}

module.exports = { asciiUserAgent };
