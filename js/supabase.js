// Requires the supabase-js CDN script to load first.
// New-style publishable keys (sb_publishable_...) are NOT JWTs, so they must not be sent as a Bearer token.
// This fetch wrapper drops that header; signed-in users still send their own session JWT.
(function () {
  const c = window.AURELIA_CONFIG;
  if (!(window.supabase && c && c.SUPABASE_URL)) { window.sb = null; return; }
  const key = c.SUPABASE_KEY;
  window.sb = window.supabase.createClient(c.SUPABASE_URL, key, {
    auth: { persistSession: true, autoRefreshToken: true },
    global: {
      fetch: (url, opts = {}) => {
        const h = new Headers(opts.headers || {});
        if (!key.startsWith("eyJ") && h.get("Authorization") === "Bearer " + key) h.delete("Authorization");
        return fetch(url, { ...opts, headers: h });
      }
    }
  });
})();
