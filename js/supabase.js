// Requires the supabase-js CDN script to load first.
(function () {
  const c = window.AURELIA_CONFIG;
  window.sb = (window.supabase && c && c.SUPABASE_URL)
    ? window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
})();
