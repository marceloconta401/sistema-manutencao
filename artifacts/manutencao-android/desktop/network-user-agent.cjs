// HTTP header values must stay ASCII. Electron derives its default User-Agent
// from the accented display name; those Latin-1 bytes break Supabase Auth's
// UTF-8 session insert. This does not change the application's display name.
function toAsciiUserAgent(userAgent) {
  if (typeof userAgent !== "string" || !userAgent.trim()) {
    throw new TypeError("Electron must provide a non-empty User-Agent.");
  }
  return userAgent
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .replace(/[^\x20-\x7E]/g, "");
}

module.exports = { toAsciiUserAgent };
