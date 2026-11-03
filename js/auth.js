// Auth helpers + login/register/reset pages. Security is enforced by Supabase RLS, not by this script.
const $ = id => document.getElementById(id);
const say = (el, text, kind) => { el.textContent = text || ""; el.className = "msg " + (kind || "err"); };
const SITE = location.origin + location.pathname.replace(/[^/]*$/, "");

function friendly(e) {
  const m = (e && e.message || "").toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("not confirmed")) return "Please verify your email first — check your inbox for the confirmation link.";
  if (m.includes("already registered")) return "An account with this email already exists. Try signing in.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a few minutes and try again.";
  if (m.includes("password")) return e.message;
  return "Something went wrong. Please try again.";
}
function safeNext() {
  const n = new URLSearchParams(location.search).get("next") || "";
  return /^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(n) ? n : "guest-dashboard.html";
}
window.requireAuth = async function () {
  if (!sb) { document.body.innerHTML = '<p class="state err">Database connection is not configured.</p>'; return null; }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "login.html?next=" + encodeURIComponent(location.pathname.split("/").pop() + location.search); return null; }
  return session;
};
window.signOut = async () => { await sb.auth.signOut(); location.href = "login.html"; };
const emailOk = v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
async function busy(btn, label, fn) { const t = btn.textContent; btn.disabled = true; btn.textContent = label; try { await fn(); } finally { btn.disabled = false; btn.textContent = t; } }

addEventListener("DOMContentLoaded", async () => {
  if ($("login-form")) {
    const fm = $("login-msg");
    if (sb) { const { data: { session } } = await sb.auth.getSession(); if (session && !location.hash.includes("type=recovery")) { location.replace(safeNext()); return; } }
    $("login-form").addEventListener("submit", e => { e.preventDefault();
      const email = $("email").value.trim(), pw = $("password").value;
      if (!emailOk(email)) return say(fm, "Enter a valid email address.");
      if (!pw) return say(fm, "Enter your password.");
      busy($("login-btn"), "Signing in…", async () => {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) return say(fm, friendly(error));
        location.href = safeNext();
      }); });
    $("show-reset").addEventListener("click", () => { $("login-box").classList.add("hidden"); $("reset-box").classList.remove("hidden"); });
    $("back-login").addEventListener("click", () => { $("reset-box").classList.add("hidden"); $("login-box").classList.remove("hidden"); });
    $("reset-form").addEventListener("submit", e => { e.preventDefault();
      const email = $("reset-email").value.trim(), rm = $("reset-msg");
      if (!emailOk(email)) return say(rm, "Enter a valid email address.");
      busy($("reset-btn"), "Sending…", async () => {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: SITE + "login.html" });
        if (error) return say(rm, friendly
